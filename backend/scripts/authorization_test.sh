#!/usr/bin/env bash
# Run real API/database authorization checks without caller-supplied IDs.
#
# Prerequisites:
#   - API is running at BASE
#   - jq and curl are installed
#   - seed users exist (credentials can be overridden below)
#   - at least two branches exist
#   - at least one patient is registered outside the receptionist's branch
#
# Usage:
#   ./backend/scripts/authorization_test.sh
#   BASE=http://localhost:8000/api/v1 KEEP_DATA=1 \
#     ./backend/scripts/authorization_test.sh
#
# Optional environment variables:
#   BASE, ADMIN_USER, ADMIN_PASS, RECEPTION_USER, RECEPTION_PASS,
#   DOCTOR_USER, DOCTOR_PASS, KEEP_DATA

set -euo pipefail

BASE="${BASE:-http://localhost:8000/api/v1}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"
RECEPTION_USER="${RECEPTION_USER:-reception}"
RECEPTION_PASS="${RECEPTION_PASS:-admin123}"
DOCTOR_USER="${DOCTOR_USER:-doctor}"
DOCTOR_PASS="${DOCTOR_PASS:-admin123}"
KEEP_DATA="${KEEP_DATA:-0}"
SUFFIX="$(date +%s)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { printf '\n%b▶ %s%b\n' "$YELLOW" "$*" "$NC"; }
ok() { printf '%b✓ %s%b\n' "$GREEN" "$*" "$NC"; }
fail() {
    printf '%b✗ %s%b\n' "$RED" "$*" "$NC" >&2
    exit 1
}

command -v curl >/dev/null || fail "curl is required"
command -v jq >/dev/null || fail "jq is required"

login() {
    local response
    response=$(curl -fsS -X POST "$BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$1\",\"password\":\"$2\"}") \
        || fail "login request failed for user '$1'"
    jq -er '.access_token // .data.access_token' <<< "$response"
}

# request <token> <method> <path> [curl args...]
# Prints the response body followed by its HTTP status code.
request() {
    local token="$1"
    local method="$2"
    local path="$3"
    shift 3
    curl -sS -w '\n%{http_code}' -X "$method" "$BASE$path" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" "$@"
}

body() { printf '%s\n' "$1" | sed '$d'; }
status() { printf '%s\n' "$1" | tail -n1; }
json_value() {
    local response="$1"
    local filter="$2"
    shift 2
    body "$response" | jq -r "$@" "$filter"
}

created_appointments=()
cleanup() {
    [[ "$KEEP_DATA" == "1" ]] && return
    [[ -n "${TOKEN_RECEPTION:-}" ]] || return
    for appointment_id in "${created_appointments[@]}"; do
        curl -sS -o /dev/null -X POST \
            "$BASE/appointments/$appointment_id/cancel" \
            -H "Authorization: Bearer $TOKEN_RECEPTION" \
            -H "Content-Type: application/json" \
            -d '{"reason":"authorization test cleanup"}' || true
    done
}
trap cleanup EXIT

step "0. Logging in as admin, receptionist, and doctor"
TOKEN_ADMIN="$(login "$ADMIN_USER" "$ADMIN_PASS")"
TOKEN_RECEPTION="$(login "$RECEPTION_USER" "$RECEPTION_PASS")"
TOKEN_DOCTOR="$(login "$DOCTOR_USER" "$DOCTOR_PASS")"
ok "all logins succeeded"

step "1. Discovering authenticated users and branches"
ME_RECEPTION=$(request "$TOKEN_RECEPTION" GET /auth/me)
[[ "$(status "$ME_RECEPTION")" == "200" ]] ||
    fail "could not read receptionist profile: $(body "$ME_RECEPTION")"
RECEPTION_BRANCH="$(json_value "$ME_RECEPTION" '.branch_id // .data.branch_id')"

ME_DOCTOR=$(request "$TOKEN_DOCTOR" GET /auth/me)
[[ "$(status "$ME_DOCTOR")" == "200" ]] ||
    fail "could not read doctor profile: $(body "$ME_DOCTOR")"
DOCTOR_A_ID="$(json_value "$ME_DOCTOR" '.staff_id // .data.staff_id')"
[[ "$RECEPTION_BRANCH" != "null" && "$DOCTOR_A_ID" != "null" ]] ||
    fail "auth/me did not return branch_id and staff_id"
ok "reception branch=$RECEPTION_BRANCH, Doctor A staff_id=$DOCTOR_A_ID"

BRANCHES=$(request "$TOKEN_RECEPTION" GET '/branches?page_size=100')
[[ "$(status "$BRANCHES")" == "200" ]] ||
    fail "could not list branches: $(body "$BRANCHES")"
OTHER_BRANCH="$(json_value "$BRANCHES" \
    '.data.items[]? | select(.branch_id != ($rb|tonumber)) | .branch_id' \
    --arg rb "$RECEPTION_BRANCH" 2>/dev/null | head -n1)" || true
[[ -n "$OTHER_BRANCH" && "$OTHER_BRANCH" != "null" ]] ||
    fail "no branch other than $RECEPTION_BRANCH is available"

step "2. Creating a temporary Receptionist and cross-branch patient"
OTHER_RECEPTION_STAFF=$(request "$TOKEN_ADMIN" POST /staff -d "{
    \"nic\": \"AUTHR-$SUFFIX\",
    \"first_name\": \"Authorization\",
    \"last_name\": \"Receptionist\",
    \"date_of_birth\": \"1988-01-01\",
    \"gender\": \"Female\",
    \"branch_id\": $OTHER_BRANCH,
    \"job_title\": \"Receptionist\",
    \"hire_date\": \"2026-01-01\"
}")
[[ "$(status "$OTHER_RECEPTION_STAFF")" == "201" ]] ||
    fail "could not create temporary Receptionist: $(body "$OTHER_RECEPTION_STAFF")"
OTHER_RECEPTION_STAFF_ID="$(json_value "$OTHER_RECEPTION_STAFF" \
    '.data.staff_id // .staff_id')"
OTHER_RECEPTION_PASSWORD="AuthTest-$SUFFIX"
OTHER_RECEPTION_ACCOUNT=$(request "$TOKEN_ADMIN" POST \
    "/staff/$OTHER_RECEPTION_STAFF_ID/account" -d "{
    \"username\": \"auth_reception_$SUFFIX\",
    \"password\": \"$OTHER_RECEPTION_PASSWORD\",
    \"role_name\": \"Receptionist\"
}")
[[ "$(status "$OTHER_RECEPTION_ACCOUNT")" == "201" ]] ||
    fail "could not create temporary Receptionist account: $(body "$OTHER_RECEPTION_ACCOUNT")"
TOKEN_OTHER_RECEPTION="$(login "auth_reception_$SUFFIX" "$OTHER_RECEPTION_PASSWORD")"

CROSS_PATIENT=$(request "$TOKEN_OTHER_RECEPTION" POST /patients -d "{
    \"nic_passport_no\": \"AUTH-PAT-$SUFFIX\",
    \"first_name\": \"Authorization\",
    \"last_name\": \"CrossBranch\",
    \"date_of_birth\": \"1990-01-01\",
    \"gender\": \"Male\",
    \"registered_branch_id\": 999999
}")
[[ "$(status "$CROSS_PATIENT")" == "201" ]] ||
    fail "could not create cross-branch patient: $(body "$CROSS_PATIENT")"
CROSS_BRANCH_PATIENT="$(json_value "$CROSS_PATIENT" \
    '.data.patient_id // .patient_id')"
ok "patient_id=$CROSS_BRANCH_PATIENT registered in branch=$OTHER_BRANCH"

step "3. Creating temporary Doctor B and an appointment"
STAFF_B=$(request "$TOKEN_ADMIN" POST /staff -d "{
    \"nic\": \"AUTHB-$SUFFIX\",
    \"first_name\": \"Authorization\",
    \"last_name\": \"DoctorB\",
    \"date_of_birth\": \"1985-01-01\",
    \"gender\": \"Male\",
    \"branch_id\": $RECEPTION_BRANCH,
    \"job_title\": \"Doctor\",
    \"hire_date\": \"2026-01-01\"
}")
[[ "$(status "$STAFF_B")" == "201" ]] ||
    fail "could not create temporary Doctor B: $(body "$STAFF_B")"
DOCTOR_B_ID="$(json_value "$STAFF_B" '.data.staff_id // .staff_id')"

DOCTOR_PROFILE=$(request "$TOKEN_ADMIN" POST "/staff/$DOCTOR_B_ID/doctor" -d "{
    \"license_no\": \"AUTHB-LIC-$SUFFIX\",
    \"years_of_experience\": 3,
    \"consultation_fee\": 1500.00
}")
[[ "$(status "$DOCTOR_PROFILE")" == "201" ]] ||
    fail "could not create Doctor B profile: $(body "$DOCTOR_PROFILE")"

APPOINTMENT_B=$(request "$TOKEN_RECEPTION" POST /appointments -d "{
    \"patient_id\": $CROSS_BRANCH_PATIENT,
    \"doctor_staff_id\": $DOCTOR_B_ID,
    \"branch_id\": $RECEPTION_BRANCH,
    \"appointment_date\": \"2099-06-01\",
    \"appointment_time\": \"11:00:00\",
    \"is_walk_in\": false
}")
[[ "$(status "$APPOINTMENT_B")" == "201" ]] ||
    fail "could not create Doctor B appointment: $(body "$APPOINTMENT_B")"
DOCTOR_B_APPOINTMENT="$(json_value "$APPOINTMENT_B" \
    '.data.appointment_id // .appointment_id')"
created_appointments+=("$DOCTOR_B_APPOINTMENT")
ok "Doctor B appointment_id=$DOCTOR_B_APPOINTMENT"

step "4. Receptionist can read a cross-branch patient"
RESPONSE=$(request "$TOKEN_RECEPTION" GET "/patients/$CROSS_BRANCH_PATIENT")
[[ "$(status "$RESPONSE")" == "200" ]] ||
    fail "expected HTTP 200: $(body "$RESPONSE")"
ok "cross-branch patient read allowed"

step "5. Receptionist cannot modify a cross-branch patient"
RESPONSE=$(request "$TOKEN_RECEPTION" PATCH \
    "/patients/$CROSS_BRANCH_PATIENT" -d '{"address":"authorization-test"}')
[[ "$(status "$RESPONSE")" == "403" ]] ||
    fail "expected HTTP 403: $(body "$RESPONSE")"
ok "cross-branch patient write rejected"

step "6. Appointment branch is derived from the receptionist"
RESPONSE=$(request "$TOKEN_RECEPTION" POST /appointments -d "{
    \"patient_id\": $CROSS_BRANCH_PATIENT,
    \"doctor_staff_id\": $DOCTOR_B_ID,
    \"branch_id\": 999999,
    \"appointment_date\": \"2099-07-15\",
    \"appointment_time\": \"14:00:00\",
    \"is_walk_in\": true
}")
CODE="$(status "$RESPONSE")"
[[ "$CODE" == "201" || "$CODE" == "409" ]] ||
    fail "expected HTTP 201 or 409: $(body "$RESPONSE")"
if [[ "$CODE" == "201" ]]; then
    DERIVED_BRANCH="$(json_value "$RESPONSE" '.data.branch_id // .branch_id')"
    [[ "$DERIVED_BRANCH" == "$RECEPTION_BRANCH" ]] ||
        fail "expected branch_id=$RECEPTION_BRANCH, got $DERIVED_BRANCH"
    created_appointments+=("$(json_value "$RESPONSE" \
        '.data.appointment_id // .appointment_id')")
    ok "branch_id derived as $DERIVED_BRANCH"
else
    ok "slot conflict returned 409; request was accepted by authorization"
fi

step "7. Doctor A cannot read or complete Doctor B's appointment"
RESPONSE=$(request "$TOKEN_DOCTOR" GET \
    "/appointments/$DOCTOR_B_APPOINTMENT")
[[ "$(status "$RESPONSE")" == "404" ]] ||
    fail "expected HTTP 404 for appointment read: $(body "$RESPONSE")"
RESPONSE=$(request "$TOKEN_DOCTOR" POST \
    "/appointments/$DOCTOR_B_APPOINTMENT/complete")
[[ "$(status "$RESPONSE")" == "404" ]] ||
    fail "expected HTTP 404 for appointment completion: $(body "$RESPONSE")"
ok "Doctor ownership enforced"

step "8. Doctor A cannot log a treatment for Doctor B"
RESPONSE=$(request "$TOKEN_DOCTOR" POST \
    "/appointments/$DOCTOR_B_APPOINTMENT/treatments" \
    -d '{"service_code":"CON-001"}')
[[ "$(status "$RESPONSE")" == "404" ]] ||
    fail "expected HTTP 404 for treatment write: $(body "$RESPONSE")"
ok "treatment ownership enforced"

step "9. Doctor A's appointment list excludes Doctor B's appointment"
RESPONSE=$(request "$TOKEN_DOCTOR" GET "/appointments?page_size=100")
[[ "$(status "$RESPONSE")" == "200" ]] ||
    fail "could not list Doctor A appointments: $(body "$RESPONSE")"
LEAKED="$(body "$RESPONSE" | jq --arg id "$DOCTOR_B_APPOINTMENT" \
    '[.data.items[]? | select((.appointment_id | tostring) == $id)] | length')"
[[ "$LEAKED" == "0" ]] ||
    fail "Doctor B's appointment leaked into Doctor A's list"
ok "Doctor appointment list is ownership-scoped"

if [[ "$KEEP_DATA" == "1" ]]; then
    step "Cleanup skipped (KEEP_DATA=1)"
    echo "Doctor B staff_id=$DOCTOR_B_ID"
    echo "Doctor B appointment_id=$DOCTOR_B_APPOINTMENT"
else
    ok "created appointments will be cancelled during cleanup"
fi

printf '\n%bAuthorization checks passed%b\n' "$GREEN" "$NC"
