## 7. Appointments

| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/appointments` | list/filter `?branch_id=&doctor_id=&date=&status=&patient_id=` | R, D, A, BM |
| POST | `/appointments` | book (Scheduled) or walk-in (`is_walk_in=true`) | R |
| GET | `/appointments/{appointment_id}` | detail | R, D, A, BM |
| POST | `/appointments/{appointment_id}/cancel` | cancel with required reason | R |
| POST | `/appointments/{appointment_id}/complete` | mark Completed — triggers invoice auto-creation | D |
| GET | `/appointments/availability` | slot grid, `?doctor_id=&date=` → list of {time, available} | R |
Rescheduling is performed by cancelling the existing appointment and creating a
new appointment. The API does not keep a reschedule history.

**SQL notes:**
- `POST` on appointments must surface the BR-1 overlap trigger's rejection as
  a 409 Conflict, not a 500 — the frontend's
  "conflict shown right at the time picker" behavior depends on this.
- `GET /appointments/availability` performs one database query for the
  doctor's non-cancelled appointments on the requested date. The backend
  generates the clinic slot grid and availability flags using the configured
  opening time, closing time, and slot interval.
