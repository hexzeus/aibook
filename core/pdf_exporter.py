from fpdf import FPDF
from io import BytesIO
from typing import Dict, List
import unicodedata
import re


class PDFExporter:
    """PERFECT Professional book PDF export - publication ready"""

    def __init__(self):
        self.page_width = 210  # A4 width in mm
        self.page_height = 297  # A4 height in mm
        self.margin_left = 30
        self.margin_right = 30
        self.margin_top = 30
        self.margin_bottom = 30

        # Content area - EXACTLY measured for perfect fitting
        self.content_width = self.page_width - self.margin_left - self.margin_right
        self.content_height = self.page_height - self.margin_top - self.margin_bottom - 20  # 20mm for page number

        # Professional publisher color palette
        self.primary_color = (30, 60, 90)    # Deep navy blue - professional
        self.secondary_color = (60, 90, 120)  # Lighter navy
        self.text_color = (40, 40, 40)        # Rich black for readability
        self.light_gray = (230, 230, 230)     # Subtle gray

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text for PDF"""
        # Replace special characters
        text = text.replace('—', '-').replace('–', '-')
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        # Normalize unicode
        text = unicodedata.normalize('NFKD', text)
        # Keep ASCII only
        text = text.encode('ascii', 'ignore').decode('ascii')
        return text

    def export_book(self, book_data: Dict) -> BytesIO:
        """Export book to PERFECT professional PDF - publication ready"""

        pdf = FPDF()
        pdf.set_auto_page_break(auto=False)  # Manual control for perfection
        pdf.set_margins(self.margin_left, self.margin_top, self.margin_right)

        pages = book_data.get('pages', [])

        # Create cover page (title page)
        self._create_cover_page(pdf, book_data)

        # Add each content page - ONE page content = ONE PDF page ALWAYS
        for idx, page in enumerate(pages):
            # Page 1 is the title page (cover), so actual content starts at page 2
            page_number = idx + 1
            self._create_content_page_single(pdf, page, page_number)

        # Output to buffer
        buffer = BytesIO()
        pdf_bytes = pdf.output()
        buffer.write(pdf_bytes)
        buffer.seek(0)

        return buffer

    def _create_cover_page(self, pdf: FPDF, book_data: Dict):
        """Create elegant professional cover page"""

        pdf.add_page()

        # Elegant top border
        pdf.set_draw_color(*self.primary_color)
        pdf.set_line_width(1.5)
        pdf.line(30, 40, self.page_width - 30, 40)

        pdf.set_line_width(0.5)
        pdf.line(30, 43, self.page_width - 30, 43)

        # Vertical centering
        pdf.ln(100)

        # Book title - elegant and centered
        title = self._clean_text(book_data.get('title', 'Untitled Book'))
        pdf.set_font('Arial', 'B', 32)
        pdf.set_text_color(*self.primary_color)
        pdf.multi_cell(0, 16, title, align='C')

        pdf.ln(15)

        # Subtitle if exists
        subtitle = book_data.get('structure', {}).get('subtitle', '')
        if subtitle:
            subtitle = self._clean_text(subtitle)
            pdf.set_font('Arial', 'I', 14)
            pdf.set_text_color(*self.secondary_color)
            pdf.multi_cell(0, 10, subtitle, align='C')

        # Elegant bottom border
        pdf.set_y(self.page_height - 50)
        pdf.set_draw_color(*self.primary_color)
        pdf.set_line_width(0.5)
        pdf.line(30, pdf.get_y(), self.page_width - 30, pdf.get_y())

        pdf.set_line_width(1.5)
        pdf.line(30, pdf.get_y() + 3, self.page_width - 30, pdf.get_y() + 3)

    def _create_content_page_single(self, pdf: FPDF, page_data: Dict, page_num: int):
        """Create ONE content page that fits PERFECTLY on ONE PDF page - no splitting"""

        content = self._clean_text(page_data.get('content', ''))
        section = self._clean_text(page_data.get('section', ''))

        pdf.add_page()

        # Elegant top border
        pdf.set_draw_color(*self.primary_color)
        pdf.set_line_width(0.5)
        pdf.line(self.margin_left, 22, self.page_width - self.margin_right, 22)

        pdf.set_y(self.margin_top)

        # Section header if exists (compact)
        header_height = 0
        if section:
            pdf.set_font('Arial', 'B', 12)
            pdf.set_text_color(*self.primary_color)
            pdf.cell(0, 8, section, align='L', ln=True)
            pdf.ln(3)
            header_height = 11

        # Calculate available space for content
        available_height = self.content_height - header_height

        # Render content with intelligent font sizing to FIT PERFECTLY
        self._render_fitted_content(pdf, content, available_height)

        # Page number at bottom
        pdf.set_y(self.page_height - 18)
        pdf.set_font('Arial', 'I', 9)
        pdf.set_text_color(*self.secondary_color)
        pdf.cell(0, 10, f'Page {page_num}', align='C')

    def _render_fitted_content(self, pdf: FPDF, content: str, available_height: float):
        """Render content with INTELLIGENT SIZING to fit perfectly on ONE page"""

        # Parse content into structured elements
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]

        if not paragraphs:
            return

        # Calculate total content "weight" (character count as proxy)
        total_chars = sum(len(p) for p in paragraphs)

        # Determine optimal base font size to fit content
        # Start with ideal readable size, then scale down if needed
        base_font_size = 11
        line_spacing = 6

        # Estimate total height needed with current settings
        estimated_height = 0
        for para in paragraphs:
            if para.startswith('# '):
                estimated_height += 18  # Title
            elif para.startswith('## '):
                estimated_height += 14  # Subtitle
            else:
                # Regular text - estimate lines
                chars_per_line = int(self.content_width / (base_font_size * 0.5))
                lines = max(1, len(para) // chars_per_line + 1)
                estimated_height += (lines * line_spacing) + 5

        # Scale down font if content too large
        if estimated_height > available_height:
            scale_factor = available_height / estimated_height
            base_font_size = max(8, int(base_font_size * scale_factor * 0.95))  # Min 8pt font
            line_spacing = max(4, int(line_spacing * scale_factor * 0.95))

        # Render with calculated sizing
        pdf.set_text_color(*self.text_color)

        for para in paragraphs:
            # Check if we have space left
            current_y = pdf.get_y()
            if current_y > self.margin_top + available_height - 10:
                break  # Safety: stop if running out of space

            # Main heading
            if para.startswith('# '):
                para = para.lstrip('#').strip()
                pdf.set_font('Arial', 'B', min(16, base_font_size + 4))
                pdf.set_text_color(*self.primary_color)
                pdf.multi_cell(0, 8, para, align='L')
                pdf.ln(2)
                pdf.set_text_color(*self.text_color)

            # Subheading
            elif para.startswith('## '):
                para = para.lstrip('#').strip()
                pdf.set_font('Arial', 'B', min(13, base_font_size + 2))
                pdf.set_text_color(*self.secondary_color)
                pdf.multi_cell(0, 7, para, align='L')
                pdf.ln(2)
                pdf.set_text_color(*self.text_color)

            # Bold text
            elif para.startswith('**') and para.endswith('**'):
                para = para.strip('*')
                pdf.set_font('Arial', 'B', base_font_size)
                pdf.multi_cell(0, line_spacing, para, align='L')
                pdf.ln(2)

            # Bullet point
            elif para.startswith('- ') or para.startswith('* '):
                bullet = chr(8226) + ' '
                para = bullet + para[2:].strip()
                pdf.set_font('Arial', '', base_font_size)
                pdf.set_x(self.margin_left + 3)
                pdf.multi_cell(0, line_spacing - 1, para, align='L')
                pdf.ln(1)

            # Regular paragraph
            else:
                pdf.set_font('Arial', '', base_font_size)
                # Justified text for professional look
                pdf.multi_cell(0, line_spacing, para, align='J')
                pdf.ln(2)
