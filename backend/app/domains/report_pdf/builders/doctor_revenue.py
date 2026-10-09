"""Doctor Revenue PDF Report Builder."""

import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.platypus import Flowable, Paragraph, Table, TableStyle

from app.domains.report_pdf.builders.base import (
    build_pdf_document,
    format_currency,
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


def build_doctor_revenue_pdf(
    data: list[dict],
    metadata: ReportMetadata,
) -> io.BytesIO:
    """Compiles the Doctor Revenue ranking report into an in-memory PDF buffer."""
    styles = get_report_styles()
    usable_width = USABLE_WIDTH_PORTRAIT
    story: list[Flowable] = []

    story.extend(render_report_header(metadata, styles, usable_width))

    if not data:
        story.append(
            render_empty_state(
                "No doctor revenue records found for the selected branch and date range.",
                styles,
                usable_width,
            )
        )
        return build_pdf_document(story, landscape_mode=False)

    # Column widths (Total = 523 pt)
    col_widths = [45.0, 165.0, 135.0, 80.0, 98.0]

    table_data: list[list[Flowable]] = [
        [
            Paragraph("Rank", styles["table_header_center"]),
            Paragraph("Doctor Name", styles["table_header"]),
            Paragraph("Branch", styles["table_header"]),
            Paragraph("Appts", styles["table_header_right"]),
            Paragraph("Revenue", styles["table_header_right"]),
        ]
    ]

    total_appts = 0
    total_rev = Decimal(0)

    for row in data:
        rank = row.get("revenue_rank") or "-"
        doc_name = row.get("doctor_name") or "Unknown"
        branch_name = row.get("branch_name") or "—"
        appts = row.get("appointment_count") or 0
        rev = row.get("revenue") or Decimal(0)

        total_appts += appts
        if rev:
            total_rev += Decimal(str(rev))

        table_data.append(
            [
                Paragraph(str(rank), styles["table_cell_center"]),
                Paragraph(str(doc_name), styles["table_cell"]),
                Paragraph(str(branch_name), styles["table_cell"]),
                Paragraph(format_int(appts), styles["table_cell_right"]),
                Paragraph(format_currency(rev), styles["table_cell_right"]),
            ]
        )

    # Period/Branch Total Row
    table_data.append(
        [
            Paragraph("", styles["table_total"]),
            Paragraph("Total", styles["table_total"]),
            Paragraph("", styles["table_total"]),
            Paragraph(format_int(total_appts), styles["table_total_right"]),
            Paragraph(format_currency(total_rev), styles["table_total_right"]),
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

    for i in range(1, len(data) + 1):
        bg = WHITE if i % 2 != 0 else BG_LIGHT
        t_style.append(("BACKGROUND", (0, i), (-1, i), bg))

    t.setStyle(TableStyle(t_style))
    story.append(t)

    return build_pdf_document(story, landscape_mode=False)
