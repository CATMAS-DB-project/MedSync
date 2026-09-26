## 3. Treatment Catalogue

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/treatments` | list catalogue, filter `?category=` | Any |
| POST | `/treatments` | add new service (BR-6: Admin/BM only) | A, BM |
| GET | `/treatments/{service_code}` | detail | Any |
| PATCH | `/treatments/{service_code}` | update name/price/category | A, BM |

**Note:** no DELETE — `appointment_treatment.price_at_time` snapshots the
price at time of use, but the catalogue row itself should stay to keep
historical FK integrity. Deactivate via a future `is_active` flag if
retirement is ever needed, rather than deleting.
