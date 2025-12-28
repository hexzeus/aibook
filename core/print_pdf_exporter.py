"""
Print-Ready PDF Exporter for professional book publishing
Supports industry-standard book sizes with proper margins and formatting
"""
from fpdf import FPDF
from typing import Dict, List, Optional
import re


class PrintPDFExporter:
    """Export books to print-ready PDF with professional formatting"""

    # Industry-standard book sizes (width, height in inches)
    BOOK_SIZES = {
        '6x9': (6, 9),              # Most common trade paperback
        '5.5x8.5': (5.5, 8.5),      # Digest size
        '5x8': (5, 8),              # Popular fiction
        '5.25x8': (5.25, 8),        # Standard fiction
        '8.5x11': (8.5, 11),        # Textbook/manual
        'a5': (5.83, 8.27)          # International standard
    }

    # Professional margin settings (inches)
    MARGINS = {
        'standard': {'top': 0.75, 'bottom': 0.75, 'inner': 0.875, 'outer': 0.625},
        'generous': {'top': 1.0, 'bottom': 1.0, 'inner': 1.0, 'outer': 0.75},
        'tight': {'top': 0.5, 'bottom': 0.5, 'inner': 0.75, 'outer': 0.5}
    }

    def __init__(
        self,
        book_size: str = '6x9',
        margin_preset: str = 'standard',
        font_family: str = 'Times',
        font_size: int = 11,
        line_spacing: float = 1.2
    ):
        """
        Initialize PDF exporter

        Args:
            book_size: Book size key (e.g., '6x9', '5.5x8.5')
            margin_preset: Margin preset ('standard', 'generous', 'tight')
            font_family: Font family ('Times', 'Helvetica', 'Courier')
            font_size: Base font size in points
            line_spacing: Line spacing multiplier
        """
        if book_size not in self.BOOK_SIZES:
            raise ValueError(f"Invalid book size. Choose from: {list(self.BOOK_SIZES.keys())}")

        if margin_preset not in self.MARGINS:
            raise ValueError(f"Invalid margin preset. Choose from: {list(self.MARGINS.keys())}")

        self.book_size = self.BOOK_SIZES[book_size]
        self.margins = self.MARGINS[margin_preset]
        self.font_family = font_family
        self.font_size = font_size
        self.line_spacing = line_spacing

        # Convert inches to mm (FPDF uses mm)
        self.page_width = self.book_size[0] * 25.4
        self.page_height = self.book_size[1] * 25.4

    def export(
        self,
        title: str,
        author: str,
        pages: List[Dict],
        subtitle: Optional[str] = None,
        include_toc: bool = True,
        include_copyright: bool = True,
        copyright_year: Optional[int] = None
    ) -> bytes:
        """
        Export book to print-ready PDF

        Args:
            title: Book title
            author: Author name
            pages: List of page dicts with 'content', 'section', etc.
            subtitle: Optional subtitle
            include_toc: Include table of contents
            include_copyright: Include copyright page
            copyright_year: Copyright year (defaults to current year)

        Returns:
            PDF file as bytes
        """
        pdf = FPDF(orientation='P', unit='mm', format=(self.page_width, self.page_height))
        pdf.set_auto_page_break(auto=True, margin=self.margins['bottom'] * 25.4)

        # Add fonts
        pdf.add_font(self.font_family, '', self.font_family + '.ttf', uni=True)
        pdf.set_font(self.font_family, '', self.font_size)

        # Title page (always recto/right page)
        self._add_title_page(pdf, title, author, subtitle)

        # Copyright page (verso/left page)
        if include_copyright:
            self._add_copyright_page(pdf, title, author, copyright_year)

        # Table of contents (if requested)
        if include_toc:
            toc_entries = self._build_toc(pages)
            if toc_entries:
                self._add_toc(pdf, toc_entries)

        # Content pages
        for i, page in enumerate(pages):
            # Skip title page content if it exists
            if page.get('is_title_page'):
                continue

            self._add_content_page(
                pdf,
                page.get('content', ''),
                page.get('section'),
                page.get('page_number', i + 1)
            )

        return pdf.output(dest='S').encode('latin-1')

    def _add_title_page(self, pdf: FPDF, title: str, author: str, subtitle: Optional[str]):
        """Add professional title page"""
        pdf.add_page()

        # Center title vertically and horizontally
        pdf.set_y(self.page_height / 3)

        # Title
        pdf.set_font(self.font_family, 'B', self.font_size + 10)
        pdf.multi_cell(0, 10, title, align='C')

        # Subtitle
        if subtitle:
            pdf.ln(5)
            pdf.set_font(self.font_family, 'I', self.font_size + 2)
            pdf.multi_cell(0, 8, subtitle, align='C')

        # Author
        pdf.ln(15)
        pdf.set_font(self.font_family, '', self.font_size + 4)
        pdf.multi_cell(0, 10, author, align='C')

    def _add_copyright_page(self, pdf: FPDF, title: str, author: str, copyright_year: Optional[int]):
        """Add copyright/legal page"""
        from datetime import datetime

        pdf.add_page()

        year = copyright_year or datetime.now().year

        pdf.set_y(self.page_height - 60)
        pdf.set_font(self.font_family, '', 9)

        copyright_text = f"""Copyright © {year} by {author}

All rights reserved. No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.

First Edition

ISBN: [To be assigned]

Published by {author}"""

        pdf.multi_cell(0, 5, copyright_text, align='L')

    def _build_toc(self, pages: List[Dict]) -> List[Dict]:
        """Build table of contents from pages"""
        toc = []
        current_chapter = None

        for page in pages:
            section = page.get('section', '')
            page_num = page.get('page_number', 0)

            # Detect chapter headings
            if section and (section.lower().startswith('chapter') or
                          page.get('chapter_number') is not None):
                toc.append({
                    'title': section,
                    'page': page_num,
                    'level': 1
                })
                current_chapter = section

        return toc

    def _add_toc(self, pdf: FPDF, toc_entries: List[Dict]):
        """Add table of contents"""
        pdf.add_page()

        pdf.set_font(self.font_family, 'B', self.font_size + 4)
        pdf.cell(0, 10, 'Table of Contents', ln=True, align='C')
        pdf.ln(10)

        pdf.set_font(self.font_family, '', self.font_size)

        for entry in toc_entries:
            indent = '    ' * (entry['level'] - 1)
            title = f"{indent}{entry['title']}"

            # Calculate dots
            title_width = pdf.get_string_width(title)
            page_width = pdf.get_string_width(str(entry['page']))
            dots_width = self.page_width - self.margins['inner'] * 25.4 - self.margins['outer'] * 25.4 - title_width - page_width - 10
            num_dots = int(dots_width / pdf.get_string_width('.'))

            line = f"{title} {'.' * num_dots} {entry['page']}"
            pdf.cell(0, 8, line, ln=True)

        pdf.add_page()  # Blank page after TOC

    def _add_content_page(self, pdf: FPDF, content: str, section: Optional[str], page_num: int):
        """Add content page with proper formatting"""
        # Calculate if this is a left (verso) or right (recto) page
        is_recto = page_num % 2 == 1

        pdf.add_page()

        # Set margins (inner/outer swap for verso pages)
        if is_recto:
            pdf.set_left_margin(self.margins['inner'] * 25.4)
            pdf.set_right_margin(self.margins['outer'] * 25.4)
        else:
            pdf.set_left_margin(self.margins['outer'] * 25.4)
            pdf.set_right_margin(self.margins['inner'] * 25.4)

        pdf.set_top_margin(self.margins['top'] * 25.4)

        # Add header with section name (optional)
        if section:
            pdf.set_font(self.font_family, 'I', self.font_size - 2)
            pdf.cell(0, 8, section, align='C')
            pdf.ln(5)

        # Content
        pdf.set_font(self.font_family, '', self.font_size)

        # Process content (remove markdown, format properly)
        formatted_content = self._format_content(content)

        pdf.multi_cell(
            0,
            self.font_size * self.line_spacing * 0.3527,  # Convert to mm
            formatted_content,
            align='J'  # Justified text
        )

        # Add page number in footer
        pdf.set_y(-15)
        pdf.set_font(self.font_family, '', self.font_size - 2)
        pdf.cell(0, 10, str(page_num), align='C')

    def _format_content(self, content: str) -> str:
        """Format content for print (remove markdown, clean up)"""
        # Remove markdown headers
        content = re.sub(r'^#+\s+', '', content, flags=re.MULTILINE)

        # Convert **bold** to plain text (FPDF doesn't support inline formatting easily)
        content = re.sub(r'\*\*(.*?)\*\*', r'\1', content)

        # Convert *italic* to plain text
        content = re.sub(r'\*(.*?)\*', r'\1', content)

        # Remove extra blank lines
        content = re.sub(r'\n{3,}', '\n\n', content)

        return content.strip()


def create_print_pdf(
    title: str,
    author: str,
    pages: List[Dict],
    book_size: str = '6x9',
    **kwargs
) -> bytes:
    """
    Convenience function to create print-ready PDF

    Args:
        title: Book title
        author: Author name
        pages: List of page dictionaries
        book_size: Book size (default: '6x9')
        **kwargs: Additional options (subtitle, margin_preset, etc.)

    Returns:
        PDF bytes
    """
    exporter = PrintPDFExporter(book_size=book_size, **kwargs)
    return exporter.export(title, author, pages, **kwargs)
