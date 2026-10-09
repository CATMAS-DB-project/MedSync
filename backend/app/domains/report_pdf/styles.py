"""Design tokens, styles, and NumberedCanvas for MedSync PDF reports."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas

# --- Brand Color Palette ---
PRIMARY = colors.HexColor("#1A365D")  # Dark Navy
SECONDARY = colors.HexColor("#2B6CB0")  # Slate Blue
ACCENT = colors.HexColor("#3182CE")
TEXT_DARK = colors.HexColor("#2D3748")  # Charcoal
TEXT_MUTED = colors.HexColor("#718096")  # Muted Gray
BG_LIGHT = colors.HexColor("#F7FAFC")  # Crisp Off-White
BG_ALT = colors.HexColor("#EDF2F7")  # Very Light Slate
BORDER_COLOR = colors.HexColor("#E2E8F0")  # Border Gray
WHITE = colors.HexColor("#FFFFFF")
STATUS_SUCCESS = colors.HexColor("#22543D")
STATUS_SUCCESS_BG = colors.HexColor("#C6F6D5")
STATUS_WARNING = colors.HexColor("#744210")
STATUS_WARNING_BG = colors.HexColor("#FEEBC8")
STATUS_DANGER = colors.HexColor("#742A2A")
STATUS_DANGER_BG = colors.HexColor("#FED7D7")

# --- Page Geometry ---
PAGE_MARGIN = 36.0  # 0.5 inch margins
PAGE_WIDTH_PORTRAIT, PAGE_HEIGHT_PORTRAIT = A4
PAGE_WIDTH_LANDSCAPE, PAGE_HEIGHT_LANDSCAPE = landscape(A4)

USABLE_WIDTH_PORTRAIT = PAGE_WIDTH_PORTRAIT - (PAGE_MARGIN * 2)  # ~523.27 pt
USABLE_WIDTH_LANDSCAPE = PAGE_WIDTH_LANDSCAPE - (PAGE_MARGIN * 2)  # ~769.89 pt


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas that accumulates pages and stamps accurate 'Page X of Y' footers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict] = []

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def _draw_page_decorations(self, total_pages: int) -> None:
        self.saveState()
        w, _ = self._pagesize

        # Running footer line
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(PAGE_MARGIN, 32, w - PAGE_MARGIN, 32)

        # Footer metadata
        self.setFont("Helvetica", 7.5)
        self.setFillColor(TEXT_MUTED)
        self.drawString(
            PAGE_MARGIN,
            20,
            "MedSync Healthcare Management System — Confidential & Official Audit Report",
        )
        self.drawRightString(
            w - PAGE_MARGIN,
            20,
            f"Page {self._pageNumber} of {total_pages}",
        )
        self.restoreState()


def get_report_styles() -> dict[str, ParagraphStyle]:
    """Generates a cohesive set of ParagraphStyle objects for clinical reports."""
    base = getSampleStyleSheet()

    styles: dict[str, ParagraphStyle] = {
        "brand_eyebrow": ParagraphStyle(
            "ReportBrandEyebrow",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=SECONDARY,
            alignment=TA_LEFT,
        ),
        "title": ParagraphStyle(
            "ReportTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=PRIMARY,
            alignment=TA_LEFT,
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=TEXT_MUTED,
            alignment=TA_LEFT,
        ),
        "meta_label": ParagraphStyle(
            "ReportMetaLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=TEXT_MUTED,
            alignment=TA_LEFT,
        ),
        "meta_value": ParagraphStyle(
            "ReportMetaValue",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=TEXT_DARK,
            alignment=TA_LEFT,
        ),
        "section_heading": ParagraphStyle(
            "ReportSectionHeading",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=PRIMARY,
            alignment=TA_LEFT,
        ),
        "table_header": ParagraphStyle(
            "ReportTableHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=WHITE,
            alignment=TA_LEFT,
        ),
        "table_header_center": ParagraphStyle(
            "ReportTableHeaderCenter",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=WHITE,
            alignment=TA_CENTER,
        ),
        "table_header_right": ParagraphStyle(
            "ReportTableHeaderRight",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=WHITE,
            alignment=TA_RIGHT,
        ),
        "table_cell": ParagraphStyle(
            "ReportTableCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10.5,
            textColor=TEXT_DARK,
            alignment=TA_LEFT,
        ),
        "table_cell_center": ParagraphStyle(
            "ReportTableCellCenter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10.5,
            textColor=TEXT_DARK,
            alignment=TA_CENTER,
        ),
        "table_cell_right": ParagraphStyle(
            "ReportTableCellRight",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10.5,
            textColor=TEXT_DARK,
            alignment=TA_RIGHT,
        ),
        "table_total": ParagraphStyle(
            "ReportTableTotal",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=TEXT_DARK,
            alignment=TA_LEFT,
        ),
        "table_total_right": ParagraphStyle(
            "ReportTableTotalRight",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=TEXT_DARK,
            alignment=TA_RIGHT,
        ),
        "card_title": ParagraphStyle(
            "ReportCardTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER,
        ),
        "card_value": ParagraphStyle(
            "ReportCardValue",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=PRIMARY,
            alignment=TA_CENTER,
        ),
        "card_subtitle": ParagraphStyle(
            "ReportCardSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9.5,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER,
        ),
        "empty_state": ParagraphStyle(
            "ReportEmptyState",
            parent=base["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=9.5,
            leading=13,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER,
        ),
    }
    return styles
