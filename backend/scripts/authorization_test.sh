#!/usr/bin/env bash
# Real-database authorization checks.
#
# Required environment:
#   BASE                 API base URL, default http://localhost:8000/api/v1
#   RECEPTION_TOKEN      Receptionist access token
#   DOCTOR_A_TOKEN       Doctor A access token
#   DOCTOR_A_ID          Doctor A staff_id
#   DOCTOR_B_APPOINTMENT Appointment assigned to Doctor B
#   CROSS_BRANCH_PATIENT Patient registered at a different branch
#   RECEPTION_BRANCH     Receptionist's branch_id
#   CROSS_BRANCH_BODY    Valid JSON patch body, default address update
#
# Optional:
#   DOCTOR_B_TOKEN       If set, validates Doctor B can see their own appointment

set -euo pipefail

BASE="${BASE:-http://localhost:8000/api/v1}"
: "${RECEPTION_TOKEN:?Set RECEPTION_TOKEN}"
: "${DOCTOR_A_TOKEN:?Set DOCTOR_A_TOKEN}"
: "${DOCTOR_A_ID:?Set DOCTOR_A_ID}"
: "${DOCTOR_B_APPOINTMENT:?Set DOCTOR_B_APPOINTMENT}"
: "${CROSS_BRANCH_PATIENT:?Set CROSS_BRANCH_PATIENT}"
: "${RECEPTION_BRANCH:?Set RECEPTION_BRANCH}"

CROSS_BRANCH_BODY="${CROSS_BRANCH_BODY:-{\"address\":\"authorization-test\"}}"

request() {
    local token="$1"
    local method="$2"
    local path="$3"
    shift 3
    curl -sS -w "\n%{http_code}" -X "$method" "$BASE$path" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" "$@"
}

body() {
    printf '%s\n' "$1" | sed '$d'
}

status() {
    printf '%s\n' "$1" | tail -n1
}

echo "1. Receptionist can read a patient from another branch"
response=$(request "$RECEPTION_TOKEN" GET "/patients/$CROSS_BRANCH_PATIENT")
[[ "$(status "$response")" == "200" ]] || {
    echo "$response"
    exit 1
}

echo "2. Receptionist cannot modify a patient from another branch"
response=$(request "$RECEPTION_TOKEN" PATCH \
    "/patients/$CROSS_BRANCH_PATIENT" -d "$CROSS_BRANCH_BODY")
[[ "$(status "$response")" == "403" ]] || {
    echo "$response"
    exit 1
}

echo "3. Receptionist branch is used for appointment creation"
response=$(request "$RECEPTION_TOKEN" POST /appointments -d "{
    \"patient_id\": $CROSS_BRANCH_PATIENT,
    \"doctor_staff_id\": $DOCTOR_A_ID,
    \"branch_id\": 999999,
    \"appointment_date\": \"2099-01-01\",
    \"appointment_time\": \"09:00:00\",
    \"is_walk_in\": true
}")
appointment_status=$(status "$response")
if [[ "$appointment_status" != "201" && "$appointment_status" != "409" ]]; then
    echo "$response"
    exit 1
fi

echo "4. Doctor cannot read another doctor's appointment"
response=$(request "$DOCTOR_A_TOKEN" GET \
    "/appointments/$DOCTOR_B_APPOINTMENT")
[[ "$(status "$response")" == "404" ]] || {
    echo "$response"
    exit 1
}

if [[ -n "${DOCTOR_B_TOKEN:-}" ]]; then
    echo "5. Doctor B can read their own appointment"
    response=$(request "$DOCTOR_B_TOKEN" GET \
        "/appointments/$DOCTOR_B_APPOINTMENT")
    [[ "$(status "$response")" == "200" ]] || {
        echo "$response"
        exit 1
    }
fi

echo "Authorization integration checks passed"
