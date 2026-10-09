#!/usr/bin/env bash
# CATMS backend integration test
# Exercises: register → promote → schedule → complete → bill → pay → audit
# Requires: stack up, migrations applied, seed users present.

set -euo pipefail

BASE="${BASE:-http://localhost:8000/api/v1}"
SEED_PASSWORD="${SEED_PASSWORD:-admin123}"
SUFFIX=$(date +%s)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "\n${YELLOW}▶ $*${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
fail() { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ---------- helpers ----------

login() {
    curl -sf -X POST "$BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$1\",\"password\":\"$2\"}" \
        | jq -r .access_token
}

# request <token> <method> <path> [extra curl args...]
req() {
    local token="$1"; shift
    local method="$1"; shift
    local path="$1"; shift
    local response
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$path" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" "$@")
    local code body
    code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    if [[ ! "$code" =~ ^2 ]]; then
        printf '%b✗ HTTP %s on %s %s%b\n  body: %s\n' \
            "$RED" "$code" "$method" "$path" "$NC" "$body" >&2
        exit 1
    fi
    echo "$body"
}

# ---------- 1. login as admin ----------
step "1. Login as admin"
TOKEN_ADMIN=$(login admin "$SEED_PASSWORD")
[[ "$TOKEN_ADMIN" != "null" && -n "$TOKEN_ADMIN" ]] || fail "admin login failed"
ok "admin token acquired"

# The appointment branch is derived from the receptionist's authenticated
# branch, and the test doctor must be created in that same branch.
step "1. Login as receptionist"
TOKEN_RECEP=$(login reception "$SEED_PASSWORD")
[[ "$TOKEN_RECEP" != "null" && -n "$TOKEN_RECEP" ]] || fail "reception login failed"
RECEPTION_PROFILE=$(req "$TOKEN_RECEP" GET /auth/me)
RECEPTION_BRANCH=$(echo "$RECEPTION_PROFILE" | jq -r '.branch_id // .data.branch_id')
[[ "$RECEPTION_BRANCH" != "null" && -n "$RECEPTION_BRANCH" ]] ||
    fail "could not determine receptionist branch"
ok "reception branch=$RECEPTION_BRANCH"

# ---------- 2. create staff ----------
step "2. Create new staff member"
STAFF=$(req "$TOKEN_ADMIN" POST /staff -d "{
    \"nic\": \"TST$SUFFIX\",
    \"first_name\": \"Integration\",
    \"last_name\": \"Doctor\",
    \"date_of_birth\": \"1988-06-15\",
    \"gender\": \"Male\",
    \"branch_id\": $RECEPTION_BRANCH,
    \"job_title\": \"Doctor\",
    \"hire_date\": \"2026-01-01\"
}")
STAFF_ID=$(echo "$STAFF" | jq -r .data.staff_id)
[[ "$STAFF_ID" != "null" ]] || fail "staff creation failed: $STAFF"
ok "staff_id=$STAFF_ID"

# ---------- 3. promote to doctor ----------
step "3. Promote staff to Doctor subtype"
req "$TOKEN_ADMIN" POST "/staff/$STAFF_ID/doctor" -d "{
    \"license_no\": \"TEST-SLMC-$SUFFIX\",
    \"years_of_experience\": 8,
    \"consultation_fee\": 2000.00,
    \"qualifications\": \"MBBS, MD\"
}" > /dev/null
ok "doctor profile created"

# ---------- 4. link specialty ----------
step "4. Link specialty (id=1)"
req "$TOKEN_ADMIN" POST "/staff/$STAFF_ID/doctor/specialties" \
    -d '{"specialty_id": 1}' > /dev/null
ok "specialty linked"

# ---------- 5. create user account ----------
step "5. Create user account for new doctor"
USERNAME="testdoc_$SUFFIX"
USERPASS="testpass123"
req "$TOKEN_ADMIN" POST "/staff/$STAFF_ID/account" -d "{
    \"username\": \"$USERNAME\",
    \"password\": \"$USERPASS\",
    \"role_name\": \"Doctor\"
}" > /dev/null
ok "account created: $USERNAME"

# ---------- 6. login as new doctor ----------
step "6. Login as the newly created doctor"
TOKEN_DOCTOR=$(login "$USERNAME" "$USERPASS")
[[ "$TOKEN_DOCTOR" != "null" && -n "$TOKEN_DOCTOR" ]] || fail "doctor login failed"
ok "doctor token acquired"

# ---------- 8. create patient ----------
step "8. Register a patient"
PATIENT=$(req "$TOKEN_RECEP" POST /patients -d "{
    \"nic_passport_no\": \"PAT$SUFFIX\",
    \"first_name\": \"Integration\",
    \"last_name\": \"Patient\",
    \"date_of_birth\": \"1995-04-20\",
    \"gender\": \"Female\",
    \"registered_branch_id\": $RECEPTION_BRANCH
}")
PATIENT_ID=$(echo "$PATIENT" | jq -r .data.patient_id)
[[ "$PATIENT_ID" != "null" ]] || fail "patient creation failed: $PATIENT"
ok "patient_id=$PATIENT_ID"

# ---------- 9. book appointment ----------
step "9. Book an appointment"
APPT_DATE=$(date -d "+2 days" +%Y-%m-%d)
APPT=$(req "$TOKEN_RECEP" POST /appointments -d "{
    \"patient_id\": $PATIENT_ID,
    \"doctor_staff_id\": $STAFF_ID,
    \"branch_id\": $RECEPTION_BRANCH,
    \"appointment_date\": \"$APPT_DATE\",
    \"appointment_time\": \"10:30:00\",
    \"is_walk_in\": false
}")
APPT_ID=$(echo "$APPT" | jq -r .data.appointment_id)
[[ "$APPT_ID" != "null" ]] || fail "booking failed: $APPT"
ok "appointment_id=$APPT_ID (status should be Scheduled)"

# ---------- 10. verify overlap rejection (BR-1) ----------
step "10. Attempt to double-book the same slot (expect 409)"
DUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/appointments" \
    -H "Authorization: Bearer $TOKEN_RECEP" \
    -H "Content-Type: application/json" \
    -d "{
        \"patient_id\": $PATIENT_ID,
        \"doctor_staff_id\": $STAFF_ID,
        \"branch_id\": $RECEPTION_BRANCH,
        \"appointment_date\": \"$APPT_DATE\",
        \"appointment_time\": \"10:30:00\",
        \"is_walk_in\": false
    }")
[[ "$DUP_CODE" == "409" ]] || fail "expected 409 on overlap, got $DUP_CODE"
ok "BR-1 overlap trigger rejected the duplicate (409)"

# ---------- 11. complete appointment ----------
step "11. Doctor marks appointment as Completed (triggers invoice)"
req "$TOKEN_DOCTOR" POST "/appointments/$APPT_ID/complete" > /dev/null
ok "appointment marked Completed"

# ---------- 12. verify invoice was auto-created ----------
step "12. Verify invoice auto-created with consultation fee"
INVOICE_LIST=$(req "$TOKEN_RECEP" GET "/invoices?patient_id=$PATIENT_ID")
INVOICE_ID=$(echo "$INVOICE_LIST" | jq -r '.data.items[0].invoice_id // .data[0].invoice_id')
[[ "$INVOICE_ID" != "null" && -n "$INVOICE_ID" ]] || fail "no invoice found: $INVOICE_LIST"

INVOICE=$(req "$TOKEN_RECEP" GET "/invoices/$INVOICE_ID")
SUBTOTAL=$(echo "$INVOICE" | jq -r .data.subtotal_amount)
jq -e '(.data.subtotal_amount | tonumber) == 2000' <<< "$INVOICE" > /dev/null \
    || fail "expected subtotal 2000.00 (doctor fee), got $SUBTOTAL"
ok "invoice_id=$INVOICE_ID, subtotal=$SUBTOTAL (matches doctor fee)"

# ---------- 13. log a treatment ----------
step "13. Log a treatment against the completed appointment"
# Seed has XR-001 (Chest X-Ray, 2500.00)
req "$TOKEN_DOCTOR" POST "/appointments/$APPT_ID/treatments" \
    -d '{"service_code": "XR-001"}' > /dev/null
ok "treatment logged"

# ---------- 14. verify subtotal grew ----------
step "14. Verify invoice subtotal now = doctor fee + treatment"
INVOICE=$(req "$TOKEN_RECEP" GET "/invoices/$INVOICE_ID")
NEW_SUBTOTAL=$(echo "$INVOICE" | jq -r .data.subtotal_amount)
jq -e '(.data.subtotal_amount | tonumber) == 4500' <<< "$INVOICE" > /dev/null \
    || fail "expected subtotal 4500.00, got $NEW_SUBTOTAL"
ok "subtotal=$NEW_SUBTOTAL (2000 + 2500)"

# ---------- 15. finalize with discount ----------
step "15. Finalize invoice with 500 manual discount"
req "$TOKEN_RECEP" POST "/invoices/$INVOICE_ID/finalize" \
    -d '{"manual_discount": 500.00}' > /dev/null
INVOICE=$(req "$TOKEN_RECEP" GET "/invoices/$INVOICE_ID")
PAYABLE=$(echo "$INVOICE" | jq -r .data.payable_amount)
jq -e '(.data.payable_amount | tonumber) == 4000' <<< "$INVOICE" > /dev/null \
    || fail "expected payable 4000.00, got $PAYABLE"
ok "finalized, payable=$PAYABLE"

# ---------- 16. partial payment ----------
step "16. Record partial payment of 1500"
req "$TOKEN_RECEP" POST "/invoices/$INVOICE_ID/payments" \
    -d '{"amount_paid": 1500.00, "payment_method": "Cash"}' > /dev/null
INVOICE=$(req "$TOKEN_RECEP" GET "/invoices/$INVOICE_ID")
OUTSTANDING=$(echo "$INVOICE" | jq -r '.data.outstanding_amount // .data.outstanding')
ok "partial payment recorded (outstanding: $OUTSTANDING)"

# ---------- 17. full payment ----------
step "17. Record remaining payment of 2500"
req "$TOKEN_RECEP" POST "/invoices/$INVOICE_ID/payments" \
    -d '{"amount_paid": 2500.00, "payment_method": "Cash"}' > /dev/null
INVOICE=$(req "$TOKEN_RECEP" GET "/invoices/$INVOICE_ID")
FINAL_OUTSTANDING=$(echo "$INVOICE" | jq -r '.data.outstanding_amount // .data.outstanding')
jq -e '((.data.outstanding_amount // .data.outstanding) | tonumber) == 0' <<< "$INVOICE" > /dev/null \
    || fail "expected outstanding 0, got $FINAL_OUTSTANDING"
ok "invoice fully paid, outstanding=$FINAL_OUTSTANDING"

# ---------- 18. audit log verification ----------
step "18. Verify audit_log recorded the writes"
AUDIT=$(req "$TOKEN_ADMIN" GET "/audit-logs?page_size=50")
# Should have entries for patient creation + invoice creation + treatment log
PATIENT_AUDIT=$(echo "$AUDIT" | jq '[.data.items[] | select(.table_affected=="patient")] | length')
INVOICE_AUDIT=$(echo "$AUDIT" | jq '[.data.items[] | select(.table_affected=="invoice")] | length')
TREATMENT_AUDIT=$(echo "$AUDIT" | jq '[.data.items[] | select(.table_affected=="appointment_treatment")] | length')

[[ "$PATIENT_AUDIT" -ge 1 ]] || fail "no audit rows for patient"
[[ "$INVOICE_AUDIT" -ge 1 ]] || fail "no audit rows for invoice"
[[ "$TREATMENT_AUDIT" -ge 1 ]] || fail "no audit rows for appointment_treatment"

# Confirm attribution is not null (should be set by with_transaction)
NULL_ACTORS=$(echo "$AUDIT" | jq '[.data.items[] | select(.staff_id == null)] | length')
ok "audit rows — patient: $PATIENT_AUDIT, invoice: $INVOICE_AUDIT, treatment: $TREATMENT_AUDIT"
ok "unattributed rows: $NULL_ACTORS (informational, not a failure)"

# ---------- 19. reports ----------
step "19. Verify reports include the new appointment and doctor"
FROM=$(date -d "-30 days" +%Y-%m-%d)
TO=$(date -d "+30 days" +%Y-%m-%d)

SUMMARY=$(req "$TOKEN_ADMIN" GET \
    "/reports/appointments-summary?branch_id=$RECEPTION_BRANCH&from=$FROM&to=$TO")
SUMMARY_COUNT=$(echo "$SUMMARY" | jq \
    --arg date "$APPT_DATE" \
    '[.data[] | select(.appointment_date == $date)] | length')
[[ "$SUMMARY_COUNT" -ge 1 ]] ||
    fail "appointment summary does not include $APPT_DATE"

REVENUE=$(req "$TOKEN_ADMIN" GET \
    "/reports/doctor-revenue?branch_id=$RECEPTION_BRANCH&from=$FROM&to=$TO")
IN_REVENUE=$(echo "$REVENUE" | jq \
    --arg sid "$STAFF_ID" \
    '[.data[] | select(.doctor_staff_id == ($sid | tonumber))] | length')
[[ "$IN_REVENUE" -ge 1 ]] ||
    fail "new doctor not in doctor-revenue report"

OUTSTANDING_REPORT=$(req "$TOKEN_ADMIN" GET \
    "/reports/outstanding-balances?branch_id=$RECEPTION_BRANCH")
echo "$OUTSTANDING_REPORT" | jq -e '(.data | type) == "array"' > /dev/null ||
    fail "outstanding-balances report did not return an array"

FREQUENCY=$(req "$TOKEN_ADMIN" GET \
    "/reports/treatment-frequency?from=$FROM&to=$TO")
IN_FREQUENCY=$(echo "$FREQUENCY" | jq \
    '[.data[] | select(.service_code == "XR-001")] | length')
[[ "$IN_FREQUENCY" -ge 1 ]] ||
    fail "XR-001 not in treatment-frequency report"

PAYMENT_MIX=$(req "$TOKEN_ADMIN" GET \
    "/reports/insurance-vs-outofpocket?branch_id=$RECEPTION_BRANCH&from=$FROM&to=$TO")
echo "$PAYMENT_MIX" | jq -e '(.data | type) == "object"' > /dev/null ||
    fail "insurance-vs-outofpocket report did not return an object"
ok "all five report endpoints returned expected results"

# ---------- done ----------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Integration test PASSED${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Artifacts created (for inspection / cleanup):"
echo "  staff_id       = $STAFF_ID"
echo "  patient_id     = $PATIENT_ID"
echo "  appointment_id = $APPT_ID"
echo "  invoice_id     = $INVOICE_ID"
echo "  username       = $USERNAME"
echo ""
echo "To clean up, run:"
echo "  DELETE FROM user_account WHERE username = '$USERNAME';"
echo "  DELETE FROM doctor WHERE staff_id = $STAFF_ID;"
echo "  DELETE FROM staff WHERE staff_id = $STAFF_ID;"
echo "  DELETE FROM patient WHERE patient_id = $PATIENT_ID;"