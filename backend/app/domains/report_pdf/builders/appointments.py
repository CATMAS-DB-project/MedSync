"""Appointments Summary PDF Report Builder."""

import io

from reportlab.lib import colors
from reportlab.platypus import Flowable, Paragraph, Table, TableStyle

from app.domains.report_pdf.builders.base import (
    build_pdf_document,
    format_date,
    format_int,
    render_empty_state,
    render_report_header,
)
from app.domains.report_pdf.schemas import ReportMetadata
from app.domains.report_pdf.styles import (
    BG_ALT,
    BG_LIGHT,
    BORDER_COLOR,
    PRIMARY,
    USABLE_WIDTH_PORTRAIT,
    WHITE,
    get_report_styles,
)


def build_appointments_summary_pdf(
    data: list[dict],
    metadata: ReportMetadata,
) -> io.BytesIO:
    """Compiles the Appointments Summary report into an in-memory PDF buffer."""
    styles = get_report_styles()
    usable_width = USABLE_WIDTH_PORTRAIT
    story: list[Flowable] = []

    # Render top branding & metadata header
    story.extend(render_report_header(metadata, styles, usable_width))

    if not data:
        story.append(
            render_empty_state(
                "No appointment activity records found for the selected branch and date range.",
                styles,
                usable_width,
            )
        )
        return build_pdf_document(story, landscape_mode=False)

    # Column widths (Total = ~523 pt)
    col_widths = [103.0, 105.0, 105.0, 105.0, 105.0]

    # Table Header Row
    table_data: list[list[Flowable]] = [
        [
            Paragraph("Appointment Date", styles["table_header_center"]),
            Paragraph("Scheduled", styles["table_header_right"]),
            Paragraph("Completed", styles["table_header_right"]),
            Paragraph("Cancelled", styles["table_header_right"]),
            Paragraph("Total Appts", styles["table_header_right"]),
        ]
    ]

    total_scheduled = 0
    total_completed = 0
    total_cancelled = 0
    total_all = 0

    # Populate Data Rows
    for row in data:
        sched = row.get("scheduled_count") or 0
        comp = row.get("completed_count") or 0
        canc = row.get("cancelled_count") or 0
        tot = row.get("total_count") or 0

        total_scheduled += sched
        total_completed += comp
        total_cancelled += canc
        total_all += tot

        table_data.append(
            [
                Paragraph(
                    format_date(row.get("appointment_date")),
                    styles["table_cell_center"],
                ),
                Paragraph(format_int(sched), styles["table_cell_right"]),
                Paragraph(format_int(comp), styles["table_cell_right"]),
                Paragraph(format_int(canc), styles["table_cell_right"]),
                Paragraph(format_int(tot), styles["table_cell_right"]),
            ]
        )

    # Total Summary Row
    table_data.append(
        [
            Paragraph("Period Total", styles["table_total"]),
            Paragraph(format_int(total_scheduled), styles["table_total_right"]),
            Paragraph(format_int(total_completed), styles["table_total_right"]),
            Paragraph(format_int(total_cancelled), styles["table_total_right"]),
            Paragraph(format_int(total_all), styles["table_total_right"]),
        ]
    )

    t = Table(table_data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")

    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -2), 0.5, BORDER_COLOR),
        ("BACKGROUND", (0, -1), (-1, -1), BG_ALT),
        ("LINEABOVE", (0, -1), (-1, -1), 1.25, colors.HexColor("#A0AEC0")),
        ("BOX", (0, 0), (-1, -1), 0.75, BORDER_COLOR),
    ]

    # Alternating row background for data rows
    for i in range(1, len(data) + 1):
        bg = WHITE if i % 2 != 0 else BG_LIGHT
        t_style.append(("BACKGROUND", (0, i), (-1, i), bg))

    t.setStyle(TableStyle(t_style))
    story.append(t)

    return build_pdf_document(story, landscape_mode=False)
