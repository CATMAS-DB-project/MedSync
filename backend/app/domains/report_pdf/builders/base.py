"""Shared layout, header rendering, and document compilation for report builders."""

import io
from datetime import date, datetime
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    Flowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.domains.report_pdf.schemas import ReportMetadata
from app.domains.report_pdf.styles import (
    BG_LIGHT,
    BORDER_COLOR,
    PAGE_MARGIN,
    NumberedCanvas,
)


def format_currency(value: Decimal | float | None) -> str:
    """Format numeric value as USD currency string ($X,XXX.XX)."""
    if value is None:
        return "$0.00"
    try:
        val = float(value)
        return f"${val:,.2f}"
    except ValueError, TypeError:
        return "$0.00"


def format_int(value: int | None) -> str:
    """Format integer with thousands separator."""
    if value is None:
        return "0"
    try:
        return f"{int(value):,}"
    except ValueError, TypeError:
        return "0"


def format_date(value: date | datetime | str | None) -> str:
    """Format date to standard YYYY-MM-DD string."""
    if value is None:
        return "—"
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d")
    return str(value)


def render_report_header(
    metadata: ReportMetadata,
    styles: dict,
    usable_width: float,
) -> list[Flowable]:
    """Renders the standard MedSync branded report title and metadata block."""
    flowables: list[Flowable] = []

    # Eyebrow / Brand label
    flowables.append(
        Paragraph(
            "MEDSYNC HEALTHCARE SYSTEM &bull; CLINICAL & FINANCIAL INTELLIGENCE",
            styles["brand_eyebrow"],
        )
    )
    flowables.append(Spacer(1, 3))

    # Main Report Title
    flowables.append(Paragraph(metadata.title, styles["title"]))
    flowables.append(Spacer(1, 2))

    # Report Subtitle / Scope description
    if metadata.subtitle:
        flowables.append(Paragraph(metadata.subtitle, styles["subtitle"]))
        flowables.append(Spacer(1, 6))

    # Determine reporting period string
    if metadata.from_date and metadata.to_date:
        period_str = f"{format_date(metadata.from_date)} &nbsp;to&nbsp; {format_date(metadata.to_date)}"
    elif metadata.from_date:
        period_str = f"From {format_date(metadata.from_date)}"
    elif metadata.to_date:
        period_str = f"Up to {format_date(metadata.to_date)}"
    else:
        period_str = "All Historical Records"

    # Generated timestamp
    gen_time_str = metadata.generated_at.strftime("%Y-%m-%d %H:%M UTC")

    # Metadata grid items
    col_w = usable_width / 2.0

    left_meta = [
        Paragraph(
            f"<b>Branch:</b> &nbsp; {metadata.branch_name}",
            styles["meta_value"],
        )
    ]
    if metadata.patient_id is not None or metadata.patient_name is not None:
        p_name = metadata.patient_name or "N/A"
        p_id = f" (ID: {metadata.patient_id})" if metadata.patient_id else ""
        left_meta.append(
            Paragraph(
                f"<b>Patient:</b> &nbsp; {p_name}{p_id}",
                styles["meta_value"],
            )
        )
    elif metadata.category:
        left_meta.append(
            Paragraph(
                f"<b>Category Filter:</b> &nbsp; {metadata.category}",
                styles["meta_value"],
            )
        )

    right_meta = [
        Paragraph(f"<b>Period:</b> &nbsp; {period_str}", styles["meta_value"]),
        Paragraph(
            f"<b>Generated:</b> &nbsp; {gen_time_str} by <i>{metadata.generated_by}</i>",
            styles["meta_value"],
        ),
    ]

    meta_table_data = [
        [
            left_meta[0],
            right_meta[0],
        ]
    ]

    if len(left_meta) > 1 or len(right_meta) > 1:
        meta_table_data.append(
            [
                left_meta[1]
                if len(left_meta) > 1
                else Paragraph("", styles["meta_value"]),
                right_meta[1]
                if len(right_meta) > 1
                else Paragraph("", styles["meta_value"]),
            ]
        )
    elif len(right_meta) > 1:
        meta_table_data.append(
            [
                Paragraph("", styles["meta_value"]),
                right_meta[1],
            ]
        )

    meta_table = Table(
        meta_table_data,
        colWidths=[col_w, col_w],
        hAlign="LEFT",
    )
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#EDF2F7")),
            ]
        )
    )

    flowables.append(meta_table)
    flowables.append(Spacer(1, 12))
    return flowables


def render_empty_state(
    message: str,
    styles: dict,
    usable_width: float,
) -> Flowable:
    """Renders a styled container box when no records are available."""
    table = Table(
        [[Paragraph(message, styles["empty_state"])]],
        colWidths=[usable_width],
        hAlign="CENTER",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 22),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 22),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    return table


def build_pdf_document(
    story: list[Flowable], landscape_mode: bool = False
) -> io.BytesIO:
    """Compiles the flowables into an in-memory PDF buffer with NumberedCanvas."""
    buffer = io.BytesIO()
    pagesize = landscape(A4) if landscape_mode else A4
    doc = SimpleDocTemplate(
        buffer,
        pagesize=pagesize,
        leftMargin=PAGE_MARGIN,
        rightMargin=PAGE_MARGIN,
        topMargin=PAGE_MARGIN,
        bottomMargin=PAGE_MARGIN,
    )
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer
