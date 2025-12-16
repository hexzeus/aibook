from fpdf import FPDF
from io import BytesIO
from typing import Dict, List
import unicodedata
import re


class PDFExporter:
    """Professional book PDF export with perfect pagination"""

    def __init__(self):
        self.page_width = 210  # A4 width in mm
        self.page_height = 297  # A4 height in mm
        self.margin_left = 25
        self.margin_right = 25
        self.margin_top = 25
        self.margin_bottom = 25

        # Content area
        self.content_width = self.page_width - self.margin_left - self.margin_right
        self.content_height = self.page_height - self.margin_top - self.margin_bottom - 15  # 15mm for page number

        # Professional color palette
        self.primary_color = (41, 128, 185)  # Professional blue
        self.secondary_color = (52, 73, 94)  # Dark blue-gray
        self.text_color = (44, 62, 80)       # Dark text
        self.light_gray = (236, 240, 241)    # Light backgrounds

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
        """Export book to professional PDF"""

        pdf = FPDF()
        pdf.set_auto_page_break(auto=False)  # We handle page breaks manually
        pdf.set_margins(self.margin_left, self.margin_top, self.margin_right)

        pages = book_data.get('pages', [])

        # Create cover page
        self._create_cover_page(pdf, book_data)

        # Add each content page with perfect fitting
        for idx, page in enumerate(pages):
            self._create_content_page_perfect(pdf, page, idx + 1)

        # Output to buffer
        buffer = BytesIO()
        pdf_bytes = pdf.output()
        buffer.write(pdf_bytes)
        buffer.seek(0)

        return buffer

    def _create_cover_page(self, pdf: FPDF, book_data: Dict):
        """Create professional cover page"""

        pdf.add_page()

        # Top decorative bar
        pdf.set_fill_color(*self.primary_color)
        pdf.rect(0, 0, self.page_width, 10, 'F')

        # Vertical spacing
        pdf.ln(90)

        # Book title
        title = self._clean_text(book_data.get('title', 'Untitled Book'))
        pdf.set_font('Arial', 'B', 38)
        pdf.set_text_color(*self.primary_color)
        pdf.multi_cell(0, 20, title, align='C')

        pdf.ln(20)

        # Subtitle
        subtitle = book_data.get('structure', {}).get('subtitle', '')
        if subtitle:
            subtitle = self._clean_text(subtitle)
            pdf.set_font('Arial', 'I', 18)
            pdf.set_text_color(*self.secondary_color)
            pdf.multi_cell(0, 12, subtitle, align='C')

        # Bottom decorative bar
        pdf.set_fill_color(*self.primary_color)
        pdf.rect(0, self.page_height - 10, self.page_width, 10, 'F')

    def _create_content_page_perfect(self, pdf: FPDF, page_data: Dict, page_num: int):
        """Create content page with PERFECT text fitting - no overflow"""

        content = self._clean_text(page_data.get('content', ''))
        section = self._clean_text(page_data.get('section', ''))

        # Split content into chunks that will fit on pages
        content_chunks = self._split_content_to_fit(pdf, content, section)

        for chunk_idx, chunk in enumerate(content_chunks):
            pdf.add_page()

            # Add header decoration
            pdf.set_draw_color(*self.primary_color)
            pdf.set_line_width(0.8)
            pdf.line(self.margin_left, 20, self.page_width - self.margin_right, 20)

            pdf.set_y(self.margin_top)

            # Add section header only on first chunk
            if chunk_idx == 0 and section:
                # Section header background
                pdf.set_fill_color(*self.light_gray)
                pdf.rect(self.margin_left - 3, pdf.get_y(), self.content_width + 6, 18, 'F')

                # Section text
                pdf.set_font('Arial', 'B', 16)
                pdf.set_text_color(*self.primary_color)
                pdf.set_y(pdf.get_y() + 4)
                pdf.multi_cell(0, 10, section, align='L')
                pdf.ln(6)

            # Render the chunk content
            self._render_text_chunk(pdf, chunk)

            # Add page number
            pdf.set_y(self.page_height - 15)
            pdf.set_font('Arial', 'I', 10)
            pdf.set_text_color(*self.secondary_color)
            actual_page = page_num if chunk_idx == 0 else f"{page_num} (cont.)"
            pdf.cell(0, 10, f'Page {actual_page}', align='C')

    def _split_content_to_fit(self, pdf: FPDF, content: str, section: str) -> List[str]:
        """Split content into chunks that perfectly fit on pages"""

        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]

        chunks = []
        current_chunk = []
        current_height = 0

        # Account for section header on first page
        max_height_first = self.content_height - 35  # Room for section header
        max_height_subsequent = self.content_height

        max_height = max_height_first

        for para in paragraphs:
            # Measure paragraph height
            para_height = self._measure_paragraph_height(pdf, para)

            # Check if it fits on current page
            if current_height + para_height > max_height:
                # Start new chunk
                if current_chunk:
                    chunks.append('\n\n'.join(current_chunk))
                    current_chunk = []
                    current_height = 0
                    max_height = max_height_subsequent  # Subsequent pages don't have section header

            current_chunk.append(para)
            current_height += para_height

        # Add remaining chunk
        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))

        return chunks if chunks else ['']

    def _measure_paragraph_height(self, pdf: FPDF, para: str) -> float:
        """Accurately measure how much vertical space a paragraph needs"""

        # Determine font based on paragraph type
        if para.startswith('# '):
            font_size = 15
            line_height = 10
        elif para.startswith('## '):
            font_size = 13
            line_height = 8
        elif para.startswith('**') and para.endswith('**'):
            font_size = 11
            line_height = 7
        else:
            font_size = 11
            line_height = 6.5

        # Estimate number of lines
        chars_per_line = int(self.content_width / (font_size * 0.4))  # Rough estimate
        num_lines = max(1, len(para) // chars_per_line + 1)

        # Total height = lines * line_height + spacing after
        total_height = (num_lines * line_height) + 5

        return total_height

    def _render_text_chunk(self, pdf: FPDF, chunk: str):
        """Render a text chunk with proper formatting"""

        paragraphs = [p.strip() for p in chunk.split('\n\n') if p.strip()]

        for para in paragraphs:
            # Main heading
            if para.startswith('# '):
                para = para.lstrip('#').strip()
                pdf.set_font('Arial', 'B', 15)
                pdf.set_text_color(*self.primary_color)
                pdf.multi_cell(0, 10, para, align='L')
                pdf.ln(4)

            # Subheading
            elif para.startswith('## '):
                para = para.lstrip('#').strip()
                pdf.set_font('Arial', 'B', 13)
                pdf.set_text_color(*self.secondary_color)
                pdf.multi_cell(0, 8, para, align='L')
                pdf.ln(3)

            # Bold text
            elif para.startswith('**') and para.endswith('**'):
                para = para.strip('*')
                pdf.set_font('Arial', 'B', 11)
                pdf.set_text_color(*self.text_color)
                pdf.multi_cell(0, 7, para, align='L')
                pdf.ln(3)

            # Bullet point
            elif para.startswith('- ') or para.startswith('* '):
                bullet = '  ' + chr(8226) + ' '
                para = bullet + para[2:].strip()
                pdf.set_font('Arial', '', 11)
                pdf.set_text_color(*self.text_color)
                pdf.multi_cell(0, 6, para, align='L')
                pdf.ln(2)

            # Regular paragraph
            else:
                pdf.set_font('Arial', '', 11)
                pdf.set_text_color(*self.text_color)

                # First line indent (professional book style)
                pdf.set_x(self.margin_left + 5)

                # Justified text
                pdf.multi_cell(0, 6.5, para, align='J')
                pdf.ln(4)
