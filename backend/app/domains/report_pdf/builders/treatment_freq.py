"""Treatment Frequency PDF Report Builder."""

import io

from reportlab.lib import colors
from reportlab.platypus import Flowable, Paragraph, Table, TableStyle

from app.domains.report_pdf.builders.base import (
    build_pdf_document,
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


def build_treatment_frequency_pdf(
    data: list[dict],
    metadata: ReportMetadata,
) -> io.BytesIO:
    """Compiles the Treatment Frequency report into an in-memory PDF buffer."""
    styles = get_report_styles()
    usable_width = USABLE_WIDTH_PORTRAIT
    story: list[Flowable] = []

    story.extend(render_report_header(metadata, styles, usable_width))

    if not data:
        story.append(
            render_empty_state(
                "No treatment delivery records found matching the specified parameters.",
                styles,
                usable_width,
            )
        )
        return build_pdf_document(story, landscape_mode=False)

    # Column widths (Total = ~523.27 pt)
    col_widths = [80.0, 230.0, 120.0, 93.27]

    table_data: list[list[Flowable]] = [
        [
            Paragraph("Service Code", styles["table_header_center"]),
            Paragraph("Treatment Name", styles["table_header"]),
            Paragraph("Category", styles["table_header"]),
            Paragraph("Utilization", styles["table_header_right"]),
        ]
    ]

    total_procedures = 0

    for row in data:
        code = row.get("service_code") or "—"
        name = row.get("treatment_name") or "Unknown"
        cat = row.get("category") or "—"
        count = row.get("treatment_count") or 0

        total_procedures += count

        table_data.append(
            [
                Paragraph(str(code), styles["table_cell_center"]),
                Paragraph(str(name), styles["table_cell"]),
                Paragraph(str(cat), styles["table_cell"]),
                Paragraph(format_int(count), styles["table_cell_right"]),
            ]
        )

    # Summary Row
    table_data.append(
        [
            Paragraph("", styles["table_total"]),
            Paragraph("Total Treatments Delivered", styles["table_total"]),
            Paragraph("", styles["table_total"]),
            Paragraph(format_int(total_procedures), styles["table_total_right"]),
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
