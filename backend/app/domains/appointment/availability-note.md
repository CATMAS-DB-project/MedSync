# Availability Calculation Note

- Availability previously generated time slots inside PostgreSQL with `generate_series()` and related PostgreSQL-specific functions.
- This tightly coupled the service behavior to PostgreSQL and could create migration or database portability issues later.
- The backend now performs one database query to retrieve the doctor's active appointments for the requested date.
- Python generates the clinic slots using the configured opening time, closing time, and slot interval.
- Python marks slots unavailable when an active appointment uses the same time.
- Cancelled appointments are ignored and therefore leave their slots available.
- The database remains responsible for storing appointment data, while scheduling calculations stay in the backend service.
