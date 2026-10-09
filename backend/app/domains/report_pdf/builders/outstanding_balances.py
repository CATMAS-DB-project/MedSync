"""Outstanding Balances PDF Report Builder (Landscape)."""

import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.platypus import Flowable, Paragraph, Table, TableStyle

from app.domains.report_pdf.builders.base import (
    build_pdf_document,
    format_currency,
    render_empty_state,
    render_report_header,
)
from app.domains.report_pdf.schemas import ReportMetadata
from app.domains.report_pdf.styles import (
    BG_ALT,
    BG_LIGHT,
    BORDER_COLOR,
    PRIMARY,
    USABLE_WIDTH_LANDSCAPE,
    WHITE,
    get_report_styles,
)


def build_outstanding_balances_pdf(
    data: list[dict],
    metadata: ReportMetadata,
) -> io.BytesIO:
    """Compiles the Outstanding Balances report into an in-memory Landscape PDF buffer."""
    styles = get_report_styles()
    usable_width = USABLE_WIDTH_LANDSCAPE
    story: list[Flowable] = []

    story.extend(render_report_header(metadata, styles, usable_width))

    if not data:
        story.append(
            render_empty_state(
                "No outstanding balances found matching the specified parameters.",
                styles,
                usable_width,
            )
        )
        return build_pdf_document(story, landscape_mode=True)

    # Column widths (Total = ~769.89 pt)
    col_widths = [65.0, 60.0, 130.0, 65.0, 165.0, 95.0, 95.0, 94.89]

    table_data: list[list[Flowable]] = [
        [
            Paragraph("Invoice #", styles["table_header_center"]),
            Paragraph("Appt #", styles["table_header_center"]),
            Paragraph("Branch", styles["table_header"]),
            Paragraph("Patient ID", styles["table_header_center"]),
            Paragraph("Patient Name", styles["table_header"]),
            Paragraph("Payable", styles["table_header_right"]),
            Paragraph("Paid", styles["table_header_right"]),
            Paragraph("Balance Due", styles["table_header_right"]),
        ]
    ]

    tot_payable = Decimal(0)
    tot_paid = Decimal(0)
    tot_due = Decimal(0)

    for row in data:
        inv_id = row.get("invoice_id")
        appt_id = row.get("appointment_id")
        branch_name = row.get("branch_name") or "—"
        pat_id = row.get("patient_id")
        pat_name = row.get("patient_name") or "—"
        payable = row.get("payable_amount") or Decimal(0)
        paid = row.get("amount_paid") or Decimal(0)
        due = row.get("outstanding_amount") or Decimal(0)

        if payable:
            tot_payable += Decimal(str(payable))
        if paid:
            tot_paid += Decimal(str(paid))
        if due:
            tot_due += Decimal(str(due))

        table_data.append(
            [
                Paragraph(
                    f"INV-{inv_id}" if inv_id else "—", styles["table_cell_center"]
                ),
                Paragraph(
                    f"#{appt_id}" if appt_id else "—", styles["table_cell_center"]
                ),
                Paragraph(str(branch_name), styles["table_cell"]),
                Paragraph(
                    f"PAT-{pat_id}" if pat_id else "—", styles["table_cell_center"]
                ),
                Paragraph(str(pat_name), styles["table_cell"]),
                Paragraph(format_currency(payable), styles["table_cell_right"]),
                Paragraph(format_currency(paid), styles["table_cell_right"]),
                Paragraph(format_currency(due), styles["table_cell_right"]),
            ]
        )

    # Summary Row
    table_data.append(
        [
            Paragraph("", styles["table_total"]),
            Paragraph("", styles["table_total"]),
            Paragraph("Total Outstanding", styles["table_total"]),
            Paragraph("", styles["table_total"]),
            Paragraph("", styles["table_total"]),
            Paragraph(format_currency(tot_payable), styles["table_total_right"]),
            Paragraph(format_currency(tot_paid), styles["table_total_right"]),
            Paragraph(format_currency(tot_due), styles["table_total_right"]),
        ]
    )

    t = Table(table_data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")

    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
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

    return build_pdf_document(story, landscape_mode=True)
