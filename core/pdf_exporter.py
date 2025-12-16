from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from io import BytesIO
from typing import Dict


class PDFExporter:
    """Export books to PDF format"""

    def __init__(self):
        self.page_size = letter
        self.margin = 0.75 * inch

    def export_book(self, book_data: Dict) -> BytesIO:
        """
        Export complete book to PDF

        Args:
            book_data: Complete book data including pages

        Returns:
            BytesIO buffer containing PDF
        """

        buffer = BytesIO()

        # Create PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=self.page_size,
            leftMargin=self.margin,
            rightMargin=self.margin,
            topMargin=self.margin,
            bottomMargin=self.margin
        )

        # Build story (content flow)
        story = []
        styles = self._get_styles()

        # Add title page if first page is title page
        pages = book_data.get('pages', [])
        if pages and pages[0].get('is_title_page'):
            story.extend(self._create_title_page(book_data, pages[0], styles))
            pages = pages[1:]  # Skip title page in main content
        else:
            # Create title page from structure if no explicit title page
            story.extend(self._create_title_page_from_structure(book_data, styles))

        # Add content pages
        for page in pages:
            story.extend(self._create_content_page(page, styles))

        # Build PDF
        doc.build(story)

        buffer.seek(0)
        return buffer

    def _get_styles(self):
        """Create custom paragraph styles"""

        styles = getSampleStyleSheet()

        # Title style
        styles.add(ParagraphStyle(
            name='BookTitle',
            parent=styles['Title'],
            fontSize=32,
            textColor='#1a1a1a',
            spaceAfter=12,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))

        # Subtitle style
        styles.add(ParagraphStyle(
            name='BookSubtitle',
            parent=styles['Normal'],
            fontSize=18,
            textColor='#4a4a4a',
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica'
        ))

        # Section header style
        styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=styles['Heading2'],
            fontSize=16,
            textColor='#2c3e50',
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        ))

        # Body text style
        styles.add(ParagraphStyle(
            name='BookBody',
            parent=styles['Normal'],
            fontSize=12,
            leading=18,
            textColor='#2c3e50',
            alignment=TA_JUSTIFY,
            spaceAfter=12,
            fontName='Helvetica'
        ))

        return styles

    def _create_title_page(self, book_data: Dict, title_page: Dict, styles) -> list:
        """Create title page elements"""

        elements = []

        # Add spacing from top
        elements.append(Spacer(1, 2 * inch))

        # Book title
        title = book_data.get('title', 'Untitled Book')
        elements.append(Paragraph(title, styles['BookTitle']))
        elements.append(Spacer(1, 0.3 * inch))

        # Subtitle if exists
        subtitle = book_data.get('structure', {}).get('subtitle', '')
        if subtitle:
            elements.append(Paragraph(subtitle, styles['BookSubtitle']))

        elements.append(Spacer(1, 1 * inch))

        # Title page content (introduction)
        content = title_page.get('content', '')
        if content:
            # Split into paragraphs
            paragraphs = content.split('\n\n')
            for para in paragraphs:
                if para.strip():
                    elements.append(Paragraph(para.strip(), styles['BookBody']))
                    elements.append(Spacer(1, 0.2 * inch))

        # Page break after title page
        elements.append(PageBreak())

        return elements

    def _create_title_page_from_structure(self, book_data: Dict, styles) -> list:
        """Create title page from book structure"""

        elements = []

        # Add spacing from top
        elements.append(Spacer(1, 2.5 * inch))

        # Book title
        title = book_data.get('title', 'Untitled Book')
        elements.append(Paragraph(title, styles['BookTitle']))
        elements.append(Spacer(1, 0.3 * inch))

        # Subtitle if exists
        subtitle = book_data.get('structure', {}).get('subtitle', '')
        if subtitle:
            elements.append(Paragraph(subtitle, styles['BookSubtitle']))

        # Page break
        elements.append(PageBreak())

        return elements

    def _create_content_page(self, page_data: Dict, styles) -> list:
        """Create content page elements"""

        elements = []

        # Section header
        section = page_data.get('section', '')
        if section:
            elements.append(Paragraph(section, styles['SectionHeader']))

        # Page content
        content = page_data.get('content', '')

        # Split content into paragraphs
        paragraphs = content.split('\n\n')

        for para in paragraphs:
            para = para.strip()
            if para:
                # Handle different paragraph types
                if para.startswith('#'):
                    # Header
                    para = para.lstrip('#').strip()
                    elements.append(Paragraph(para, styles['SectionHeader']))
                else:
                    # Regular paragraph
                    elements.append(Paragraph(para, styles['BookBody']))

        # Add page break after each page
        elements.append(PageBreak())

        return elements
