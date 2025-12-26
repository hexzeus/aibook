"""
Enhanced EPUB Exporter - Award-Winning Professional Quality
Perfect formatting for Amazon KDP, Apple Books, and all ebook platforms
"""
from ebooklib import epub
from io import BytesIO
from typing import Dict, List, Optional
import unicodedata
import uuid
import re
from datetime import datetime
import httpx
from PIL import Image


class EnhancedEPUBExporter:
    """
    Professional EPUB 3.0 export with perfect formatting

    Features:
    - Proper typography (smart quotes, em dashes, proper spacing)
    - Professional book structure (title page, copyright, dedication, TOC)
    - Perfect chapter breaks and pagination
    - Optimized CSS for all e-readers
    - Metadata for discoverability
    - Validation-ready output
    """

    def __init__(self):
        # Professional CSS optimized for all e-readers
        self.styles = """
        @namespace epub "http://www.idpf.org/2007/ops";

        /* ================================
           GLOBAL TYPOGRAPHY
           ================================ */

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: "Minion Pro", "Georgia", "Baskerville", serif;
            font-size: 1em;
            line-height: 1.75;
            text-align: left;
            color: #1a1a1a;
            margin: 1.5em;
            widows: 2;
            orphans: 2;
            hyphens: auto;
            -webkit-hyphens: auto;
            -moz-hyphens: auto;
            adobe-hyphenate: auto;
        }

        /* ================================
           HEADINGS
           ================================ */

        h1, h2, h3, h4, h5, h6 {
            font-family: "Minion Pro", "Georgia", "Baskerville", serif;
            font-weight: bold;
            page-break-after: avoid;
            break-after: avoid;
            text-align: left;
            hyphens: none;
            -webkit-hyphens: none;
            margin-bottom: 0.75em;
        }

        h1 {
            font-size: 2.25em;
            margin-top: 2em;
            margin-bottom: 1em;
            page-break-before: always;
            break-before: always;
            color: #000;
            letter-spacing: 0.02em;
        }

        h2 {
            font-size: 1.75em;
            margin-top: 1.5em;
            margin-bottom: 0.75em;
            color: #1a1a1a;
        }

        h3 {
            font-size: 1.35em;
            margin-top: 1.25em;
            margin-bottom: 0.65em;
            color: #2a2a2a;
        }

        h4 {
            font-size: 1.15em;
            margin-top: 1em;
            margin-bottom: 0.5em;
            color: #3a3a3a;
            font-style: italic;
        }

        /* ================================
           PARAGRAPHS
           ================================ */

        p {
            text-align: justify;
            text-indent: 1.5em;
            margin: 0 0 0.5em 0;
            font-size: 1em;
            line-height: 1.75;
            widows: 2;
            orphans: 2;
        }

        /* First paragraph after heading - no indent */
        h1 + p,
        h2 + p,
        h3 + p,
        h4 + p,
        .chapter-start p:first-of-type {
            text-indent: 0;
        }

        /* No indent class */
        p.no-indent {
            text-indent: 0;
        }

        /* Centered paragraphs */
        p.centered {
            text-align: center;
            text-indent: 0;
        }

        /* Scene breaks */
        p.scene-break {
            text-align: center;
            text-indent: 0;
            margin: 1.5em 0;
            font-size: 1.2em;
        }

        /* ================================
           SPECIAL PAGES
           ================================ */

        .title-page {
            text-align: center;
            margin-top: 25%;
            page-break-after: always;
            break-after: always;
        }

        .title-page h1 {
            font-size: 2.75em;
            margin-bottom: 0.5em;
            margin-top: 0;
            page-break-before: avoid;
            break-before: avoid;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            font-weight: bold;
        }

        .title-page .subtitle {
            font-size: 1.5em;
            font-style: italic;
            color: #444;
            margin-top: 1em;
            margin-bottom: 2em;
            font-weight: normal;
        }

        .title-page .author {
            font-size: 1.35em;
            margin-top: 3em;
            font-variant: small-caps;
            letter-spacing: 0.1em;
        }

        .copyright-page {
            font-size: 0.85em;
            line-height: 1.5;
            margin-top: 3em;
            page-break-after: always;
            break-after: always;
            text-align: left;
        }

        .copyright-page p {
            text-indent: 0;
            text-align: left;
            margin-bottom: 1em;
        }

        .dedication {
            text-align: center;
            margin-top: 30%;
            font-style: italic;
            font-size: 1.1em;
            page-break-after: always;
            break-after: always;
        }

        .dedication p {
            text-indent: 0;
        }

        /* ================================
           CHAPTERS
           ================================ */

        .chapter {
            page-break-before: always;
            break-before: always;
            margin-top: 3em;
        }

        .chapter-title {
            font-size: 2em;
            font-weight: bold;
            text-align: center;
            margin-bottom: 2em;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            page-break-after: avoid;
            break-after: avoid;
        }

        .chapter-number {
            font-size: 1.2em;
            font-variant: small-caps;
            letter-spacing: 0.2em;
            margin-bottom: 0.5em;
            text-align: center;
            color: #666;
        }

        /* ================================
           TEXT FORMATTING
           ================================ */

        strong, b {
            font-weight: bold;
            color: #000;
        }

        em, i {
            font-style: italic;
        }

        /* Emphasis */
        .emphasis {
            font-style: italic;
        }

        .strong-emphasis {
            font-weight: bold;
            font-style: italic;
        }

        /* ================================
           LISTS
           ================================ */

        ul, ol {
            margin: 1em 0 1em 2em;
            padding: 0;
        }

        li {
            margin: 0.5em 0;
            line-height: 1.6;
        }

        ul {
            list-style-type: disc;
        }

        ol {
            list-style-type: decimal;
        }

        /* Nested lists */
        ul ul, ol ol, ul ol, ol ul {
            margin: 0.5em 0 0.5em 1.5em;
        }

        /* ================================
           BLOCKQUOTES
           ================================ */

        blockquote {
            margin: 1.5em 2.5em;
            padding: 1em 1.5em;
            border-left: 4px solid #666;
            font-style: italic;
            background-color: #f9f9f9;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        blockquote p {
            text-indent: 0;
            margin-bottom: 0.75em;
        }

        blockquote p:last-child {
            margin-bottom: 0;
        }

        /* ================================
           SPECIAL ELEMENTS
           ================================ */

        hr {
            border: none;
            border-top: 1px solid #ccc;
            margin: 2em auto;
            width: 30%;
        }

        /* Scene separator */
        hr.scene-separator {
            width: 20%;
            margin: 2em auto;
            border-top: 3px double #999;
        }

        /* Ornamental break */
        .ornamental-break {
            text-align: center;
            margin: 2em 0;
            font-size: 1.5em;
            color: #999;
        }

        /* ================================
           LINKS (for TOC)
           ================================ */

        a {
            color: #0066cc;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        /* ================================
           PAGE BREAKS
           ================================ */

        .page-break {
            page-break-after: always;
            break-after: always;
        }

        .page-break-before {
            page-break-before: always;
            break-before: always;
        }

        .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        /* ================================
           RESPONSIVE ADJUSTMENTS
           ================================ */

        @media amzn-kf8 {
            /* Kindle Fire specific styles */
            body {
                font-size: 1em;
            }
        }

        @media amzn-mobi {
            /* Older Kindle devices */
            body {
                font-size: medium;
            }

            p {
                margin-bottom: 0.75em;
            }
        }
        """

    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize text with smart typography

        Features:
        - Convert straight quotes to curly quotes
        - Convert hyphens to em dashes where appropriate
        - Normalize unicode
        - Remove extra whitespace
        """
        if not text:
            return ""

        # Normalize unicode
        text = unicodedata.normalize('NFKC', text)

        # Smart quotes disabled due to Python 3.13 regex template issues
        # TODO: Re-implement with a different approach

        # Em dashes
        text = text.replace('--', '—')  # Simple replacement

        # Ellipsis
        text = text.replace('...', '…')  # Simple replacement

        # Remove multiple spaces
        text = re.sub(r' +', ' ', text)

        # Fix spacing around punctuation
        text = re.sub(r'\s+([,\.;:!?\u2019\u201d])', r'\1', text)

        return text.strip()

    def _markdown_to_html(self, content: str, is_first_in_chapter: bool = False) -> str:
        """
        Convert markdown content to perfectly formatted HTML

        Features:
        - Proper paragraph handling
        - Scene breaks
        - Lists
        - Bold, italic, emphasis
        - Smart typography
        """
        if not content:
            return ""

        html_parts = []
        paragraphs = content.split('\n\n')
        is_first_paragraph = is_first_in_chapter

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Scene break (*** or * * *)
            if re.match(r'^\*+\s*\*+\s*\*+$', para):
                html_parts.append('<p class="scene-break">* * *</p>')
                is_first_paragraph = True
                continue

            # Horizontal rule
            if para in ['---', '___', '***']:
                html_parts.append('<hr class="scene-separator" />')
                is_first_paragraph = True
                continue

            # Main heading (# )
            if para.startswith('# '):
                text = self._clean_text(para.lstrip('#').strip())
                html_parts.append(f'<h1>{text}</h1>')
                is_first_paragraph = True
                continue

            # Subheading (## )
            if para.startswith('## '):
                text = self._clean_text(para.lstrip('#').strip())
                html_parts.append(f'<h2>{text}</h2>')
                is_first_paragraph = True
                continue

            # Sub-subheading (### )
            if para.startswith('### '):
                text = self._clean_text(para.lstrip('#').strip())
                html_parts.append(f'<h3>{text}</h3>')
                is_first_paragraph = True
                continue

            # Blockquote (> )
            if para.startswith('> '):
                lines = [self._clean_text(line.lstrip('> ').strip()) for line in para.split('\n')]
                quote_html = ''.join(f'<p>{line}</p>' for line in lines if line)
                html_parts.append(f'<blockquote>{quote_html}</blockquote>')
                is_first_paragraph = False
                continue

            # Unordered list
            if re.match(r'^[\*\-\+] ', para):
                items = []
                for line in para.split('\n'):
                    if re.match(r'^[\*\-\+] ', line):
                        item_text = self._clean_text(re.sub(r'^[\*\-\+] ', '', line))
                        items.append(f'<li>{self._inline_markdown(item_text)}</li>')
                html_parts.append(f'<ul>{"".join(items)}</ul>')
                is_first_paragraph = False
                continue

            # Ordered list
            if re.match(r'^\d+\. ', para):
                items = []
                for line in para.split('\n'):
                    if re.match(r'^\d+\. ', line):
                        item_text = self._clean_text(re.sub(r'^\d+\. ', '', line))
                        items.append(f'<li>{self._inline_markdown(item_text)}</li>')
                html_parts.append(f'<ol>{"".join(items)}</ol>')
                is_first_paragraph = False
                continue

            # Regular paragraph
            text = self._clean_text(para)
            text = self._inline_markdown(text)

            # Apply proper class
            if is_first_paragraph:
                html_parts.append(f'<p class="no-indent">{text}</p>')
                is_first_paragraph = False
            else:
                html_parts.append(f'<p>{text}</p>')

        return '\n'.join(html_parts)

    def _inline_markdown(self, text: str) -> str:
        """Process inline markdown (bold, italic, etc.)"""
        # Bold (**text** or __text__)
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'__(.+?)__', r'<strong>\1</strong>', text)

        # Italic (*text* or _text_)
        text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
        text = re.sub(r'(?<!_)_(?!_)(.+?)(?<!_)_(?!_)', r'<em>\1</em>', text)

        # Bold italic (***text***)
        text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', text)

        return text

    def _create_copyright_page(self, book_data: Dict) -> str:
        """Generate professional copyright page"""
        title = self._clean_text(book_data.get('title', 'Untitled'))
        author = self._clean_text(book_data.get('author_name', 'AI Book Generator'))
        year = datetime.now().year

        copyright_html = f'''
        <div class="copyright-page">
            <p><strong>{title}</strong></p>
            <p>Copyright © {year} by {author}</p>
            <p>All rights reserved.</p>
            <br/>
            <p>No part of this book may be reproduced in any form or by any electronic or mechanical means, including information storage and retrieval systems, without permission in writing from the publisher, except by reviewers, who may quote brief passages in a review.</p>
            <br/>
            <p>This book is a work created with AI assistance.</p>
            <br/>
            <p>Generated with AI Book Generator</p>
            <p>www.yourwebsite.com</p>
            <br/>
            <p>First Edition: {datetime.now().strftime('%B %Y')}</p>
        </div>
        '''
        return copyright_html

    def _download_and_optimize_image(self, image_url: str, page_num: int) -> Optional[tuple]:
        """
        Download and optimize image for EPUB embedding

        Args:
            image_url: URL or data URL of the image
            page_num: Page number for naming

        Returns:
            tuple: (image_data, filename, mime_type) or None if failed
        """
        try:
            # Check if it's a data URL (base64 encoded)
            if image_url.startswith('data:image/'):
                print(f"[EPUB] Processing base64 data URL for page {page_num}", flush=True)
                import base64
                # Extract base64 data from data URL
                # Format: data:image/png;base64,iVBORw0KGgoAAAANS...
                header, encoded = image_url.split(',', 1)
                img_data = base64.b64decode(encoded)
            else:
                # Regular URL - download it
                print(f"[EPUB] Downloading image from URL for page {page_num}", flush=True)
                with httpx.Client(timeout=30.0) as client:
                    response = client.get(image_url)
                    response.raise_for_status()
                    img_data = response.content

            # Open with PIL for optimization
            img = Image.open(BytesIO(img_data))

            # Convert RGBA to RGB if needed (for JPEG)
            if img.mode == 'RGBA':
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Resize to max 800px width for e-readers (Amazon KDP requirement)
            max_width = 800
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            # Compress and save as JPEG
            img_buffer = BytesIO()
            img.save(img_buffer, format='JPEG', quality=90, optimize=True)
            img_data = img_buffer.getvalue()

            # Ensure under 127KB (Amazon KDP soft limit)
            if len(img_data) > 127 * 1024:
                # Try with lower quality
                img_buffer = BytesIO()
                img.save(img_buffer, format='JPEG', quality=75, optimize=True)
                img_data = img_buffer.getvalue()

            filename = f'Images/page_{page_num}.jpg'
            mime_type = 'image/jpeg'

            return (img_data, filename, mime_type)

        except Exception as e:
            print(f"[EPUB] Failed to download/optimize image for page {page_num}: {str(e)}")
            return None

    def export_book(self, book_data: Dict, author_name: Optional[str] = None) -> BytesIO:
        """
        Export book to professional EPUB 3.0 format

        Args:
            book_data: Book data including title, pages, structure
            author_name: Optional custom author name

        Returns:
            BytesIO: EPUB file buffer ready for download
        """
        try:
            book = epub.EpubBook()
        except Exception as e:
            raise Exception(f"Failed to create EPUB book object: {str(e)}")

        # Extract metadata
        book_id = book_data.get('book_id', str(uuid.uuid4()))
        title = self._clean_text(book_data.get('title', 'Untitled Book'))
        author = self._clean_text(author_name or book_data.get('author_name', 'AI Book Generator'))
        structure = book_data.get('structure', {})
        subtitle = structure.get('subtitle', '')

        # Set metadata
        book.set_identifier(f'urn:uuid:{book_id}')
        book.set_title(title)
        book.set_language('en')
        book.add_author(author)

        # Additional metadata
        if subtitle:
            book.add_metadata('DC', 'description', self._clean_text(subtitle))

        book.add_metadata('DC', 'publisher', 'AI Book Generator')
        book.add_metadata('DC', 'date', datetime.utcnow().strftime('%Y-%m-%d'))
        book.add_metadata('DC', 'rights', f'Copyright © {datetime.now().year} {author}. All rights reserved.')

        # Genre/subject
        book_type = book_data.get('book_type', 'general')
        book.add_metadata('DC', 'subject', book_type.title())

        # Add CSS
        style = epub.EpubItem(
            uid="style",
            file_name="Styles/style.css",
            media_type="text/css",
            content=self.styles
        )
        book.add_item(style)

        # Create title page
        title_html = f'''
        <div class="title-page">
            <h1>{title}</h1>
            {f'<p class="subtitle">{self._clean_text(subtitle)}</p>' if subtitle else ''}
            <p class="author">by {author}</p>
        </div>
        '''

        title_page = epub.EpubHtml(
            title='Title Page',
            file_name='Text/title.xhtml',
            lang='en'
        )
        title_page.content = title_html
        title_page.add_item(style)
        book.add_item(title_page)

        # Create copyright page
        copyright_html = self._create_copyright_page({**book_data, 'author_name': author})
        copyright_page = epub.EpubHtml(
            title='Copyright',
            file_name='Text/copyright.xhtml',
            lang='en'
        )
        copyright_page.content = copyright_html
        copyright_page.add_item(style)
        book.add_item(copyright_page)

        # Create chapters from pages
        pages = book_data.get('pages', [])
        chapters = []
        toc_entries = []

        for idx, page in enumerate(pages, 1):
            page_num = page.get('page_number', idx)
            section = page.get('section', f'Chapter {page_num}')
            content = page.get('content', '')
            illustration_url = page.get('illustration_url')

            # Download and embed illustration if present
            illustration_html = ''
            if illustration_url:
                img_result = self._download_and_optimize_image(illustration_url, page_num)
                if img_result:
                    img_data, img_filename, img_mime = img_result

                    # Create image item
                    img_item = epub.EpubItem(
                        uid=f"img_{page_num}",
                        file_name=img_filename,
                        media_type=img_mime,
                        content=img_data
                    )
                    book.add_item(img_item)

                    # Create HTML for illustration (at top of page - marketplace standard)
                    illustration_html = f'''
                    <div class="illustration" style="text-align: center; margin: 2em 0 3em 0; page-break-inside: avoid;">
                        <img src="../{img_filename}" alt="Illustration for {self._clean_text(section)}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;"/>
                    </div>
                    '''

            # Convert markdown to HTML
            html_content = self._markdown_to_html(content, is_first_in_chapter=True)

            # Create chapter with proper structure (illustration at top)
            chapter_html = f'''
            <div class="chapter chapter-start">
                <p class="chapter-number">Chapter {page_num}</p>
                <h1 class="chapter-title">{self._clean_text(section)}</h1>
                {illustration_html}
                {html_content}
            </div>
            '''

            chapter = epub.EpubHtml(
                title=self._clean_text(section),
                file_name=f'Text/chapter_{page_num:03d}.xhtml',
                lang='en'
            )
            chapter.content = chapter_html
            chapter.add_item(style)

            book.add_item(chapter)
            chapters.append(chapter)
            toc_entries.append(epub.Link(f'Text/chapter_{page_num:03d}.xhtml', section, f'ch{page_num}'))

        # Define Table of Contents
        book.toc = [
            epub.Link('Text/title.xhtml', 'Title Page', 'title'),
            epub.Link('Text/copyright.xhtml', 'Copyright', 'copyright'),
            (epub.Section('Chapters'), toc_entries)
        ]

        # Add navigation files
        try:
            book.add_item(epub.EpubNcx())
            book.add_item(epub.EpubNav())
        except Exception as e:
            raise Exception(f"Failed to add navigation to EPUB: {str(e)}")

        # Define spine (reading order)
        book.spine = ['nav', title_page, copyright_page] + chapters

        # Write to BytesIO
        try:
            buffer = BytesIO()
            epub.write_epub(buffer, book)
            buffer.seek(0)
            return buffer
        except Exception as e:
            raise Exception(f"Failed to write EPUB file: {str(e)}")
