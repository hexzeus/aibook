from fpdf import FPDF
from io import BytesIO
from typing import Dict, List, Optional
import unicodedata
import re
import httpx
from PIL import Image
import tempfile
import os


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

    def _download_and_prepare_image(self, image_url: str) -> Optional[str]:
        """Download and prepare image for PDF embedding

        Args:
            image_url: URL or data URL of the image

        Returns:
            str: Path to temporary image file, or None if failed
        """
        try:
            # Check if it's a data URL (base64 encoded)
            if image_url.startswith('data:image/'):
                print(f"[PDF] Processing base64 data URL", flush=True)
                import base64
                # Extract base64 data from data URL
                header, encoded = image_url.split(',', 1)
                img_data = base64.b64decode(encoded)
            else:
                # Regular URL - download it
                print(f"[PDF] Downloading image from URL", flush=True)
                with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                    response = client.get(image_url)
                    response.raise_for_status()
                    img_data = response.content

            # Open with PIL
            img = Image.open(BytesIO(img_data))

            # Convert to RGB if needed
            if img.mode == 'RGBA':
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Save to temporary file (FPDF needs file path)
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            img.save(temp_file.name, format='JPEG', quality=90, optimize=True)
            temp_file.close()

            return temp_file.name

        except Exception as e:
            print(f"[PDF] Failed to download/prepare image: {str(e)}", flush=True)
            import traceback
            print(f"[PDF] Traceback: {traceback.format_exc()}", flush=True)
            return None

    def export_book(self, book_data: Dict) -> BytesIO:
        """Export book to professional PDF with natural page breaks"""

        pdf = FPDF()
        # Enable automatic page breaks like a real book
        pdf.set_auto_page_break(auto=True, margin=self.margin_bottom)
        pdf.set_margins(self.margin_left, self.margin_top, self.margin_right)

        pages = book_data.get('pages', [])
        temp_files = []  # Track temp files for cleanup

        try:
            # Create cover page (title page)
            self._create_cover_page(pdf, book_data)

            # Track actual PDF page number for footer
            self.pdf_page_number = 1

            # Add each content page - allow natural flow
            for idx, page in enumerate(pages):
                # Page 1 is the title page (cover), so actual content starts at page 2
                content_page_number = idx + 1
                is_first_content_page = (idx == 0)
                temp_file = self._create_content_page_natural(pdf, page, content_page_number, is_first_content_page)
                if temp_file:
                    temp_files.append(temp_file)

            # Output to buffer
            buffer = BytesIO()
            pdf_bytes = pdf.output()
            buffer.write(pdf_bytes)
            buffer.seek(0)

            return buffer

        finally:
            # Clean up temporary image files
            for temp_file in temp_files:
                try:
                    if os.path.exists(temp_file):
                        os.unlink(temp_file)
                except Exception as e:
                    print(f"[PDF] Failed to delete temp file {temp_file}: {str(e)}")

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

    def _create_content_page_natural(self, pdf: FPDF, page_data: Dict, page_num: int, is_first: bool = False) -> Optional[str]:
        """Create content page with natural flow - content can span multiple PDF pages

        Args:
            is_first: If True, don't add a new page (cover already started one)

        Returns:
            Optional[str]: Path to temporary image file if one was created, None otherwise
        """

        content = self._clean_text(page_data.get('content', ''))
        section = self._clean_text(page_data.get('section', ''))
        illustration_url = page_data.get('illustration_url')

        # Add new page ONLY if not the first content page
        # (The cover page already added the first page)
        if not is_first:
            pdf.add_page()

        # Elegant top border
        pdf.set_draw_color(*self.primary_color)
        pdf.set_line_width(0.5)
        pdf.line(self.margin_left, 22, self.page_width - self.margin_right, 22)

        pdf.set_y(self.margin_top)

        # Section header if exists
        if section:
            pdf.set_font('Arial', 'B', 12)
            pdf.set_text_color(*self.primary_color)
            pdf.cell(0, 8, section, align='L', ln=True)
            pdf.ln(3)

        # Add illustration if present (at top of page - marketplace standard)
        temp_img_file = None
        if illustration_url:
            temp_img_file = self._download_and_prepare_image(illustration_url)
            if temp_img_file:
                try:
                    # Open image to get dimensions
                    from PIL import Image
                    img = Image.open(temp_img_file)
                    img_ratio = img.height / img.width

                    # Calculate image dimensions to fit in content area
                    max_img_width = self.content_width  # 150mm
                    img_height = max_img_width * img_ratio

                    # Limit height to leave space for text (max 100mm)
                    if img_height > 100:
                        img_height = 100
                        max_img_width = img_height / img_ratio

                    # Store Y position before image
                    y_before = pdf.get_y()

                    # Add image centered horizontally
                    x_pos = self.margin_left + (self.content_width - max_img_width) / 2
                    pdf.image(temp_img_file,
                             x=x_pos,
                             y=y_before,
                             w=max_img_width)

                    # Move Y position AFTER the image height + spacing
                    pdf.set_y(y_before + img_height + 10)  # 10mm spacing after image

                except Exception as e:
                    print(f"[PDF] Failed to add image to PDF: {str(e)}")

        # Render content with natural markdown formatting
        self._render_markdown_content(pdf, content, page_num)

        return temp_img_file

    def _render_markdown_content(self, pdf: FPDF, content: str, page_num: int):
        """Render content with proper markdown formatting and natural page breaks"""

        # Professional book typography settings
        base_font_size = 11
        line_spacing = 6

        # Parse content into structured elements
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]

        if not paragraphs:
            return

        pdf.set_text_color(*self.text_color)

        for para in paragraphs:
            # Check if we need a page break (leave room for page number)
            if pdf.get_y() > self.page_height - self.margin_bottom - 15:
                # Add page number to current page before break
                self._add_page_number(pdf, page_num)
                pdf.add_page()
                pdf.set_y(self.margin_top)

            # Main heading (# )
            if para.startswith('# '):
                para = para.lstrip('#').strip()
                pdf.set_font('Arial', 'B', 16)
                pdf.set_text_color(*self.primary_color)
                pdf.multi_cell(0, 9, para, align='L')
                pdf.ln(3)
                pdf.set_text_color(*self.text_color)

            # Subheading (## )
            elif para.startswith('## '):
                para = para.lstrip('#').strip()
                pdf.set_font('Arial', 'B', 13)
                pdf.set_text_color(*self.secondary_color)
                pdf.multi_cell(0, 8, para, align='L')
                pdf.ln(2)
                pdf.set_text_color(*self.text_color)

            # Bold text (**text**)
            elif para.startswith('**') and para.endswith('**'):
                para = para.strip('*')
                pdf.set_font('Arial', 'B', base_font_size)
                pdf.multi_cell(0, line_spacing, para, align='L')
                pdf.ln(2)

            # Bullet point (- or *)
            elif para.startswith('- ') or para.startswith('* '):
                # Use simple dash instead of bullet character (not supported in Arial)
                bullet = '- '
                para = bullet + para[2:].strip()
                pdf.set_font('Arial', '', base_font_size)
                pdf.set_x(self.margin_left + 5)

                # Check if bullet point will cause page break
                if pdf.get_y() > self.page_height - self.margin_bottom - 20:
                    self._add_page_number(pdf, page_num)
                    pdf.add_page()
                    pdf.set_y(self.margin_top)

                pdf.multi_cell(self.content_width - 5, line_spacing, para, align='L')
                pdf.ln(1)

            # Regular paragraph
            else:
                pdf.set_font('Arial', '', base_font_size)
                # Justified text for professional book look
                pdf.multi_cell(0, line_spacing, para, align='J')
                pdf.ln(3)

        # Add page number to the last page of this content
        self._add_page_number(pdf, page_num)

    def _add_page_number(self, pdf: FPDF, page_num: int):
        """Add page number at bottom of page"""
        current_y = pdf.get_y()
        pdf.set_y(self.page_height - 18)
        pdf.set_font('Arial', 'I', 9)
        pdf.set_text_color(*self.secondary_color)
        pdf.cell(0, 10, f'Page {page_num}', align='C')
        pdf.set_y(current_y)  # Restore position
