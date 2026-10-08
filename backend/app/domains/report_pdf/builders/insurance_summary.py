"""Insurance vs. Out-of-Pocket Financial Summary PDF Report Builder."""

import io
from decimal import Decimal

from reportlab.platypus import Flowable, Paragraph, Spacer, Table, TableStyle

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


def build_insurance_summary_pdf(
    data: dict,
    metadata: ReportMetadata,
) -> io.BytesIO:
    """Compiles the Insurance vs Out-of-Pocket financial report into an in-memory PDF buffer."""
    styles = get_report_styles()
    usable_width = USABLE_WIDTH_PORTRAIT
    story: list[Flowable] = []

    story.extend(render_report_header(metadata, styles, usable_width))

    invoice_count = data.get("invoice_count") or 0
    subtotal = Decimal(str(data.get("subtotal_amount") or 0))
    insurance = Decimal(str(data.get("insurance_amount") or 0))
    out_of_pocket = Decimal(str(data.get("out_of_pocket_amount") or 0))

    if invoice_count == 0 and subtotal == 0:
        story.append(
            render_empty_state(
                "No completed billing records found for the selected branch and date range.",
                styles,
                usable_width,
            )
        )
        return build_pdf_document(story, landscape_mode=False)

    # 1. Metric Summary Cards (2x2 grid or 4 columns)
    card_w = usable_width / 4.0
    cards_data = [
        [
            Paragraph("SETTLED INVOICES", styles["card_title"]),
            Paragraph("GROSS BILLING", styles["card_title"]),
            Paragraph("INSURANCE COVERED", styles["card_title"]),
            Paragraph("OUT-OF-POCKET", styles["card_title"]),
        ],
        [
            Paragraph(format_int(invoice_count), styles["card_value"]),
            Paragraph(format_currency(subtotal), styles["card_value"]),
            Paragraph(format_currency(insurance), styles["card_value"]),
            Paragraph(format_currency(out_of_pocket), styles["card_value"]),
        ],
        [
            Paragraph("Completed Visits", styles["card_subtitle"]),
            Paragraph("Total Chargeable", styles["card_subtitle"]),
            Paragraph(
                f"{float((insurance / subtotal) * 100):.1f}% of Gross"
                if subtotal > 0
                else "0.0%",
                styles["card_subtitle"],
            ),
            Paragraph(
                f"{float((out_of_pocket / subtotal) * 100):.1f}% of Gross"
                if subtotal > 0
                else "0.0%",
                styles["card_subtitle"],
            ),
        ],
    ]

    cards_table = Table(cards_data, colWidths=[card_w] * 4, hAlign="CENTER")
    cards_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
                ("TOPPADDING", (0, 1), (-1, 1), 2),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 4),
                ("TOPPADDING", (0, 2), (-1, 2), 0),
                ("BOTTOMPADDING", (0, 2), (-1, 2), 6),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    story.append(cards_table)
    story.append(Spacer(1, 16))

    # 2. Detailed Breakdown Table
    story.append(
        Paragraph("Financial Distribution Breakdown", styles["section_heading"])
    )
    story.append(Spacer(1, 6))

    breakdown_widths = [160.0, 100.0, 75.0, 188.27]
    insurance_pct = (insurance / subtotal * 100) if subtotal > 0 else Decimal(0)
    oop_pct = (out_of_pocket / subtotal * 100) if subtotal > 0 else Decimal(0)

    breakdown_data: list[list[Flowable]] = [
        [
            Paragraph("Financial Component", styles["table_header"]),
            Paragraph("Amount", styles["table_header_right"]),
            Paragraph("Share (%)", styles["table_header_right"]),
            Paragraph("Description", styles["table_header"]),
        ],
        [
            Paragraph("Gross Subtotal Amount", styles["table_cell"]),
            Paragraph(format_currency(subtotal), styles["table_cell_right"]),
            Paragraph("100.0%", styles["table_cell_right"]),
            Paragraph(
                "Total list price before coverage & discounts", styles["table_cell"]
            ),
        ],
        [
            Paragraph("Insurance Deduction / Covered", styles["table_cell"]),
            Paragraph(format_currency(insurance), styles["table_cell_right"]),
            Paragraph(f"{float(insurance_pct):.1f}%", styles["table_cell_right"]),
            Paragraph("Claims absorbed by policy providers", styles["table_cell"]),
        ],
        [
            Paragraph("Patient Out-of-Pocket Liability", styles["table_cell"]),
            Paragraph(format_currency(out_of_pocket), styles["table_cell_right"]),
            Paragraph(f"{float(oop_pct):.1f}%", styles["table_cell_right"]),
            Paragraph("Direct liability payable by patients", styles["table_cell"]),
        ],
    ]

    breakdown_table = Table(breakdown_data, colWidths=breakdown_widths, hAlign="LEFT")
    breakdown_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("BACKGROUND", (0, 1), (-1, 1), WHITE),
                ("BACKGROUND", (0, 2), (-1, 2), BG_LIGHT),
                ("BACKGROUND", (0, 3), (-1, 3), WHITE),
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_COLOR),
            ]
        )
    )
    story.append(breakdown_table)
    story.append(Spacer(1, 14))

    # 3. Clinical & Operational KPI Summary Box
    avg_per_inv = (subtotal / invoice_count) if invoice_count > 0 else Decimal(0)
    avg_oop_per_inv = (
        (out_of_pocket / invoice_count) if invoice_count > 0 else Decimal(0)
    )

    summary_note = (
        f"<b>Key Operational Insights:</b> Across <b>{format_int(invoice_count)}</b> finalized invoices, "
        f"the average gross billing was <b>{format_currency(avg_per_inv)}</b>, with patients directly paying an average "
        f"of <b>{format_currency(avg_oop_per_inv)}</b> out of pocket. "
        f"Insurance carriers covered <b>{float(insurance_pct):.1f}%</b> of total medical charges."
    )

    callout_table = Table(
        [[Paragraph(summary_note, styles["meta_value"])]],
        colWidths=[usable_width],
        hAlign="LEFT",
    )
    callout_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_ALT),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(callout_table)

    return build_pdf_document(story, landscape_mode=False)
