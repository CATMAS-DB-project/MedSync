
## 12. Reports

| Method | Path | Description | Roles | REQ |
|---|---|---|---|---|
| GET | `/reports/appointments-summary` | `?branch_id=&from=&to=` daily counts by status | A, BM | RG-1 |
| GET | `/reports/doctor-revenue` | `?branch_id=&from=&to=` revenue per doctor | A, BM | RG-2 |
| GET | `/reports/outstanding-balances` | `?branch_id=` patients with unpaid dues | A, BM, C | RG-3 |
| GET | `/reports/treatment-frequency` | `?category=&from=&to=` counts per treatment/category | A, BM | RG-4 |
| GET | `/reports/insurance-vs-outofpocket` | `?branch_id=&from=&to=` | A, BM | RG-5 |

**SQL notes — this is where "advanced SQL" should actually live, not in
application code:**
- **Doctor revenue** is a natural window-function candidate — rank doctors
  within a branch using `RANK() OVER (PARTITION BY branch_id ORDER BY
  revenue DESC)` rather than sorting in Python/JS.
- **Appointments summary** benefits from `GROUP BY` with `FILTER (WHERE
  status = 'Completed')`-style conditional aggregation to get all three
  status counts in one query instead of three separate queries.
- Consider a Postgres **materialized view** for the heavier reports
  (doctor revenue, insurance vs out-of-pocket) refreshed on a schedule
  (`REFRESH MATERIALIZED VIEW CONCURRENTLY`), since PERF-4 allows up to 10
  seconds for report generation over a year of data and explicitly
  suggests pre-aggregation if raw queries are too slow.
- **Outstanding balances** reuses the same aggregation pattern as the
  invoice endpoint's outstanding-balance query — factor it into a shared
  SQL view (`CREATE VIEW v_invoice_outstanding AS ...`) so both the
  Billing endpoint and this report query the same logic instead of
  duplicating it.

---