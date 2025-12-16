from fpdf import FPDF
from io import BytesIO
from typing import Dict


class PDFExporter:
    """Export books to PDF format using fpdf2"""

    def __init__(self):
        self.page_width = 210  # A4 width in mm
        self.page_height = 297  # A4 height in mm
        self.margin = 20  # 20mm margin

    def export_book(self, book_data: Dict) -> BytesIO:
        """
        Export complete book to PDF

        Args:
            book_data: Complete book data including pages

        Returns:
            BytesIO buffer containing PDF
        """

        pdf = FPDF()
        pdf.set_auto_page_break(auto=False)

        # Add title page
        self._create_title_page(pdf, book_data)

        # Add content pages
        pages = book_data.get('pages', [])

        # Skip first page if it's a title page
        start_idx = 1 if pages and pages[0].get('is_title_page') else 0

        for page in pages[start_idx:]:
            self._create_content_page(pdf, page)

        # Output to BytesIO buffer
        buffer = BytesIO()
        pdf_output = pdf.output(dest='S').encode('latin-1')
        buffer.write(pdf_output)
        buffer.seek(0)

        return buffer

    def _create_title_page(self, pdf: FPDF, book_data: Dict):
        """Create title page"""

        pdf.add_page()

        # Add spacing from top
        pdf.ln(80)

        # Book title
        title = book_data.get('title', 'Untitled Book')
        pdf.set_font('Arial', 'B', 32)
        pdf.set_text_color(26, 26, 26)
        pdf.multi_cell(0, 15, title, align='C')

        pdf.ln(10)

        # Subtitle if exists
        subtitle = book_data.get('structure', {}).get('subtitle', '')
        if subtitle:
            pdf.set_font('Arial', '', 18)
            pdf.set_text_color(74, 74, 74)
            pdf.multi_cell(0, 10, subtitle, align='C')
            pdf.ln(20)

    def _create_content_page(self, pdf: FPDF, page_data: Dict):
        """Create content page"""

        pdf.add_page()

        # Section header
        section = page_data.get('section', '')
        if section:
            pdf.set_font('Arial', 'B', 16)
            pdf.set_text_color(44, 62, 80)
            pdf.multi_cell(0, 10, section, align='L')
            pdf.ln(5)

        # Page content
        content = page_data.get('content', '')

        # Reset font for body text
        pdf.set_font('Arial', '', 12)
        pdf.set_text_color(44, 62, 80)

        # Split content into paragraphs
        paragraphs = content.split('\n\n')

        for para in paragraphs:
            para = para.strip()
            if para:
                # Handle headers
                if para.startswith('#'):
                    para = para.lstrip('#').strip()
                    pdf.set_font('Arial', 'B', 14)
                    pdf.multi_cell(0, 8, para, align='L')
                    pdf.ln(3)
                    pdf.set_font('Arial', '', 12)
                else:
                    # Regular paragraph with justified alignment
                    pdf.multi_cell(0, 7, para, align='J')
                    pdf.ln(5)
