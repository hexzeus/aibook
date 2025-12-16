from fpdf import FPDF
from io import BytesIO
from typing import Dict
import unicodedata


class PDFExporter:
    """Export books to PDF format using fpdf2 - Professional book formatting"""

    def __init__(self):
        self.page_width = 210  # A4 width in mm
        self.page_height = 297  # A4 height in mm
        self.margin_left = 25
        self.margin_right = 25
        self.margin_top = 20
        self.margin_bottom = 20

        # Professional color palette
        self.primary_color = (41, 128, 185)  # Professional blue
        self.secondary_color = (52, 73, 94)  # Dark blue-gray
        self.accent_color = (231, 76, 60)    # Accent red
        self.text_color = (44, 62, 80)       # Dark text
        self.light_gray = (236, 240, 241)    # Light backgrounds

    def _clean_text(self, text: str) -> str:
        """Clean text for PDF compatibility - replace problematic characters"""
        # Replace em-dash with regular dash
        text = text.replace('—', '-')
        text = text.replace('–', '-')
        # Replace curly quotes with straight quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        # Remove other problematic Unicode characters
        text = unicodedata.normalize('NFKD', text)
        # Keep only ASCII-compatible characters
        text = text.encode('ascii', 'ignore').decode('ascii')
        return text

    def export_book(self, book_data: Dict) -> BytesIO:
        """
        Export complete book to PDF with professional formatting

        Args:
            book_data: Complete book data including pages

        Returns:
            BytesIO buffer containing PDF
        """

        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=self.margin_bottom)
        pdf.set_margins(self.margin_left, self.margin_top, self.margin_right)

        # Get pages
        pages = book_data.get('pages', [])

        # Create cover page (separate from content)
        self._create_cover_page(pdf, book_data)

        # Add all content pages (including first page)
        for page in pages:
            self._create_content_page(pdf, page)

        # Output to BytesIO buffer
        buffer = BytesIO()
        pdf_bytes = pdf.output()
        buffer.write(pdf_bytes)
        buffer.seek(0)

        return buffer

    def _create_cover_page(self, pdf: FPDF, book_data: Dict):
        """Create professional cover page"""

        pdf.add_page()

        # Decorative header bar
        pdf.set_fill_color(*self.primary_color)
        pdf.rect(0, 0, 210, 8, 'F')

        # Add vertical space
        pdf.ln(80)

        # Book title with color
        title = self._clean_text(book_data.get('title', 'Untitled Book'))
        pdf.set_font('Arial', 'B', 36)
        pdf.set_text_color(*self.primary_color)
        pdf.multi_cell(0, 18, title, align='C')

        pdf.ln(15)

        # Subtitle
        subtitle = book_data.get('structure', {}).get('subtitle', '')
        if subtitle:
            subtitle = self._clean_text(subtitle)
            pdf.set_font('Arial', 'I', 16)
            pdf.set_text_color(*self.secondary_color)
            pdf.multi_cell(0, 10, subtitle, align='C')

        # Decorative footer bar
        pdf.set_y(280)
        pdf.set_fill_color(*self.primary_color)
        pdf.rect(0, 289, 210, 8, 'F')

    def _create_content_page(self, pdf: FPDF, page_data: Dict):
        """Create beautifully formatted content page"""

        pdf.add_page()

        # Decorative header line
        pdf.set_draw_color(*self.primary_color)
        pdf.set_line_width(0.5)
        pdf.line(self.margin_left, 15, 210 - self.margin_right, 15)

        # Section header with colored background
        section = page_data.get('section', '')
        if section:
            section = self._clean_text(section)

            # Background box for section header
            pdf.set_fill_color(*self.light_gray)
            pdf.set_y(20)
            current_y = pdf.get_y()
            pdf.rect(self.margin_left - 5, current_y, 210 - self.margin_left - self.margin_right + 10, 15, 'F')

            # Section text
            pdf.set_y(current_y + 3)
            pdf.set_font('Arial', 'B', 18)
            pdf.set_text_color(*self.primary_color)
            pdf.multi_cell(0, 10, section, align='L')
            pdf.ln(8)

        # Page content
        content = self._clean_text(page_data.get('content', ''))

        # Split content into paragraphs
        paragraphs = content.split('\n\n')

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Check if we're near bottom of page
            if pdf.get_y() > 260:
                pdf.add_page()
                pdf.ln(10)

            # Handle different content types
            if para.startswith('# '):
                # Main heading
                para = para.lstrip('#').strip()
                pdf.set_font('Arial', 'B', 16)
                pdf.set_text_color(*self.primary_color)
                pdf.multi_cell(0, 10, para, align='L')
                pdf.ln(5)

            elif para.startswith('## '):
                # Subheading
                para = para.lstrip('#').strip()
                pdf.set_font('Arial', 'B', 14)
                pdf.set_text_color(*self.secondary_color)
                pdf.multi_cell(0, 8, para, align='L')
                pdf.ln(4)

            elif para.startswith('**') and para.endswith('**'):
                # Bold emphasis
                para = para.strip('*')
                pdf.set_font('Arial', 'B', 12)
                pdf.set_text_color(*self.text_color)
                pdf.multi_cell(0, 7, para, align='L')
                pdf.ln(3)

            elif para.startswith('- ') or para.startswith('* '):
                # Bullet point
                bullet = '  ' + chr(8226) + ' '  # Bullet character
                para = bullet + para[2:].strip()
                pdf.set_font('Arial', '', 11)
                pdf.set_text_color(*self.text_color)
                pdf.multi_cell(0, 6, para, align='L')
                pdf.ln(2)

            else:
                # Regular paragraph - human-readable formatting
                pdf.set_font('Arial', '', 11)
                pdf.set_text_color(*self.text_color)

                # First line indent for new paragraphs (like real books)
                pdf.set_x(self.margin_left + 5)

                # Justify text for professional look
                pdf.multi_cell(0, 6.5, para, align='J')
                pdf.ln(4)

        # Page number at bottom
        pdf.set_y(285)
        pdf.set_font('Arial', 'I', 9)
        pdf.set_text_color(*self.secondary_color)
        pdf.cell(0, 10, f'Page {pdf.page_no() - 1}', align='C')  # -1 to not count cover
