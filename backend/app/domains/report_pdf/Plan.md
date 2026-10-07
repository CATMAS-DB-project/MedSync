# Architectural & Implementation Plan: PDF Report Generation

**Domain Entity:** `app.domains.report_pdf`  
**Core Technologies:** `ReportLab` (Platypus engine), `asyncio.to_thread()`, `io.BytesIO()`, `FastAPI`, `asyncpg`

---

## 1. Executive Summary & Goals

This plan outlines the architecture for generating official, downloadable PDF reports in the MedSync system. The primary design goals are:

1. **Non-Blocking Asynchronous Concurrency:** PDF compilation is CPU-bound and synchronous. To protect FastAPI's `asyncio` event loop from freezing, all document rendering is offloaded to worker threads via `asyncio.to_thread()`.
2. **Zero Disk I/O (In-Memory Streaming):** All PDF documents are compiled directly into volatile memory buffers (`io.BytesIO`) and streamed over HTTP via `StreamingResponse`. This eliminates file collision risks, disk quota exhaustion, and temporary file deletion overhead.
3. **DRY & Reusable Architecture:** The PDF domain does not duplicate database logic. It directly leverages existing queries and views in `app.domains.report.service` (`appointments_summary`, `doctor_revenue`, `outstanding_balances`, etc.).
4. **Audit-Grade Clinical & Financial Formatting:** Uses ReportLab Platypus (`Table`, `Paragraph`, `NumberedCanvas`) to deliver clean branding, repeating table headers across page breaks, and accurate *"Page X of Y"* pagination.

---

## 2. Target Directory & Module Structure

```text
backend/app/domains/report_pdf/
├── __init__.py               # Domain export
├── Plan.md                   # This implementation roadmap
├── styles.py                 # Color palette, font styles, dimensions, and NumberedCanvas
├── builders/                 # ReportLab document builders per report type
│   ├── __init__.py
│   ├── base.py               # Shared header/footer layout and base builder
│   ├── appointments.py       # Appointments Summary report generator
│   ├── doctor_revenue.py     # Doctor Revenue ranking report generator
│   ├── outstanding_balances.py # Unpaid dues & aging balance generator
│   ├── treatment_freq.py     # Treatment frequency & catalog popularity generator
│   └── insurance_summary.py  # Insurance vs. Out-of-pocket financial summary
├── router.py                 # FastAPI endpoints for PDF downloads
└── schemas.py                # Query parameters and export options
```

---

## 3. End-to-End Pipeline & Request Flow

```
[ Frontend: "Export PDF" ]
           │  GET /api/v1/reports/pdf/{report_name}?branch_id=...&from=...&to=...
           ▼
[ FastAPI Route Handler (router.py) ]
   ├── 1. Authenticate & Enforce RBAC (Admin, Branch Manager, Receptionist)
   ├── 2. Validate Date Ranges & Branch Scopes (_effective_branch_id)
   │
   ├── 3. Fetch Raw Data Asynchronously (Main Thread / Event Loop)
   │      └── `data = await report_service.<query_function>(conn, ...)`
   │
   ├── 4. Offload PDF Compilation to Background Thread Pool
   │      └── `pdf_buffer = await asyncio.to_thread(build_pdf_report, data, meta)`
   │
   └── 5. Stream In-Memory Response
          └── `return StreamingResponse(pdf_buffer, media_type="application/pdf")`
```

---

## 4. Key Architectural Components

### A. Non-Blocking Execution with `asyncio.to_thread()`
* **Mechanism:** ReportLab is a synchronous C-extension/Python library. Running it directly inside `async def` would monopolize the main thread for 50–200ms per report.
* **Solution:**
  ```python
  pdf_buffer: io.BytesIO = await asyncio.to_thread(
      build_doctor_revenue_pdf,
      data=report_data,
      metadata=report_metadata,
  )
  ```
* **Benefit:** The main event loop remains non-blocking and handles incoming HTTP requests from other clinic staff during document compilation.

### B. In-Memory Streaming with `io.BytesIO()`
* **Mechanism:**
  ```python
  buffer = io.BytesIO()
  doc = SimpleDocTemplate(buffer, pagesize=A4, ...)
  doc.build(story, canvasmaker=NumberedCanvas)
  buffer.seek(0)  # Rewind read pointer to stream from start
  return StreamingResponse(
      buffer,
      media_type="application/pdf",
      headers={"Content-Disposition": f'attachment; filename="{filename}"'}
  )
  ```
* **Benefit:** Zero physical disk writes, zero storage leaks in Docker containers, and instant garbage collection once the HTTP socket stream terminates.

### C. Reusable Dynamic Header & "Page X of Y" Canvas (`styles.py`)
Standard ReportLab canvases cannot calculate the total page count on pass 1. We implement a custom two-pass `NumberedCanvas`:
* **Pass 1:** Record total page count in memory while rendering elements.
* **Pass 2:** Draw footer metadata, confidentiality notices, and exact `"Page 1 of 5"` on every page.

---

## 5. Supported Report Specifications

| Report Name | Path | Target Dataset | Orientation | Key Visual Elements |
|---|---|---|---|---|
| **Appointments Summary** | `/api/v1/reports/pdf/appointments-summary` | `service.appointments_summary` | Portrait | Daily totals, scheduled vs. completed vs. cancelled counts, period totals |
| **Doctor Revenue** | `/api/v1/reports/pdf/doctor-revenue` | `service.doctor_revenue` | Portrait | Doctor rank within branch, appointment volume, total revenue, cumulative branch sum |
| **Outstanding Balances** | `/api/v1/reports/pdf/outstanding-balances` | `service.outstanding_balances` | Landscape | Invoice #, patient details, payable amount, amount paid, overdue balance |
| **Treatment Frequency** | `/api/v1/reports/pdf/treatment-frequency` | `service.treatment_frequency` | Portrait | Service code, treatment name, category, utilization counts |
| **Insurance vs. Out-of-Pocket** | `/api/v1/reports/pdf/insurance-summary` | `service.insurance_vs_outofpocket` | Portrait | Metric cards (total invoices, gross billings, insurance deductions, patient dues) |

---

## 6. Phased Implementation Roadmap

### Phase 1: Environment & Dependency Verification
1. Add `reportlab` to `pyproject.toml` (`reportlab>=4.2.0`).
2. Verify package installation inside the Python virtual environment.

### Phase 2: Design System & Shared Canvas (`styles.py`, `builders/base.py`)
1. Define MedSync brand design tokens:
   * Primary: `#1A365D` (Dark Navy)
   * Secondary / Accent: `#2B6CB0` (Slate Blue)
   * Neutral Dark: `#2D3748`
   * Neutral Light / Alternating Rows: `#F7FAFC`
   * Border lines: `#E2E8F0`
2. Implement `NumberedCanvas` with dynamic total page count.
3. Build `render_header(title, subtitle, branch, date_range)` and standard table styling presets.

### Phase 3: Report Builders
Implement specialized builders under `app/domains/report_pdf/builders/`:
* Handle table auto-wrapping using `Paragraph` inside cells.
* Format currencies with thousands separators (`$1,234.56`).
* Add repeating headers on multi-page tables (`repeatRows=1`).
* Add bold summary/totals rows at the bottom of tables.

### Phase 4: API Router & Service Integration (`router.py`)
1. Create `router = APIRouter(prefix="/reports/pdf", tags=["reports-pdf"])`.
2. Connect endpoints to `app.domains.report.service` functions.
3. Enforce role-based security (`Admin`, `Branch Manager`, `Receptionist`) and branch boundaries.
4. Mount `report_pdf_router` in `app/main.py`.

### Phase 5: Verification & Quality Assurance
1. **Concurrency test:** Verify running multiple concurrent PDF requests does not block healthcheck `/api/health`.
2. **Edge case testing:** Empty datasets (0 rows) gracefully render an empty-state message rather than crashing ReportLab.
3. **Multi-page test:** Generate 100+ rows to verify table headers repeat and page numbering increments accurately.
