from ebooklib import epub
from io import BytesIO
from typing import Dict
import unicodedata
import uuid
from datetime import datetime


class EPUBExporter:
    """Professional EPUB export for Amazon KDP, Etsy, and all ebook marketplaces"""

    def __init__(self):
        self.styles = """
        @namespace epub "http://www.idpf.org/2007/ops";

        body {
            font-family: Georgia, serif;
            line-height: 1.8;
            margin: 2em;
            color: #2a2a2a;
        }

        h1 {
            font-size: 2em;
            font-weight: bold;
            margin: 1.5em 0 1em 0;
            color: #1a3a5a;
            text-align: center;
            page-break-before: always;
        }

        h2 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 1.2em 0 0.8em 0;
            color: #3c5c7c;
        }

        h3 {
            font-size: 1.2em;
            font-weight: bold;
            margin: 1em 0 0.6em 0;
            color: #4a6a8a;
        }

        p {
            margin: 0 0 1em 0;
            text-align: justify;
            text-indent: 1.5em;
        }

        p.no-indent {
            text-indent: 0;
        }

        p.centered {
            text-align: center;
            text-indent: 0;
        }

        .title-page {
            text-align: center;
            margin-top: 30%;
            page-break-after: always;
        }

        .title-page h1 {
            font-size: 3em;
            margin-bottom: 0.5em;
            page-break-before: auto;
        }

        .title-page .subtitle {
            font-size: 1.5em;
            font-style: italic;
            color: #5a7a9a;
            margin-top: 1em;
        }

        .chapter {
            page-break-before: always;
            margin-top: 2em;
        }

        .section-title {
            font-size: 1.2em;
            font-weight: bold;
            color: #3c5c7c;
            margin-bottom: 1em;
            text-align: left;
        }

        ul, ol {
            margin: 1em 0;
            padding-left: 2em;
        }

        li {
            margin: 0.5em 0;
        }

        strong, b {
            font-weight: bold;
            color: #1a1a1a;
        }

        em, i {
            font-style: italic;
        }

        blockquote {
            margin: 1.5em 2em;
            padding: 1em;
            border-left: 4px solid #5a7a9a;
            background-color: #f5f5f5;
            font-style: italic;
        }

        .page-break {
            page-break-after: always;
        }
        """

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text for EPUB"""
        # Normalize unicode
        text = unicodedata.normalize('NFKD', text)
        # Keep most unicode (EPUB handles it better than PDF)
        return text

    def _markdown_to_html(self, content: str) -> str:
        """Convert markdown content to clean HTML"""
        html_parts = []

        # Split into paragraphs
        paragraphs = content.split('\n\n')

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Main heading (# )
            if para.startswith('# '):
                text = para.lstrip('#').strip()
                html_parts.append(f'<h1>{self._clean_text(text)}</h1>')

            # Subheading (## )
            elif para.startswith('## '):
                text = para.lstrip('#').strip()
                html_parts.append(f'<h2>{self._clean_text(text)}</h2>')

            # Sub-subheading (### )
            elif para.startswith('### '):
                text = para.lstrip('#').strip()
                html_parts.append(f'<h3>{self._clean_text(text)}</h3>')

            # Bullet list (multiple lines starting with - or *)
            elif para.startswith('- ') or para.startswith('* '):
                items = [line.lstrip('- *').strip() for line in para.split('\n') if line.strip().startswith(('- ', '* '))]
                html_parts.append('<ul>')
                for item in items:
                    html_parts.append(f'<li>{self._clean_text(item)}</li>')
                html_parts.append('</ul>')

            # Regular paragraph
            else:
                # Handle inline markdown
                text = self._clean_text(para)

                # Bold (**text** or __text__)
                import re
                text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
                text = re.sub(r'__(.+?)__', r'<strong>\1</strong>', text)

                # Italic (*text* or _text_)
                text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
                text = re.sub(r'_(.+?)_', r'<em>\1</em>', text)

                # Check if first paragraph (no indent for first para after heading)
                if html_parts and html_parts[-1].startswith('<h'):
                    html_parts.append(f'<p class="no-indent">{text}</p>')
                else:
                    html_parts.append(f'<p>{text}</p>')

        return '\n'.join(html_parts)

    def export_book(self, book_data: Dict) -> BytesIO:
        """
        Export book to professional EPUB format

        EPUB is the industry standard for:
        - Amazon Kindle (KDP)
        - Apple Books
        - Kobo
        - Google Play Books
        - Barnes & Noble Nook
        - Etsy digital products
        - Gumroad ebooks
        """

        try:
            book = epub.EpubBook()
        except Exception as e:
            raise Exception(f"Failed to create EPUB book object: {str(e)}")

        # Set metadata
        book_id = book_data.get('book_id', str(uuid.uuid4()))
        title = self._clean_text(book_data.get('title', 'Untitled Book'))

        book.set_identifier(f'book-{book_id}')
        book.set_title(title)
        book.set_language('en')

        # Add author (you can make this customizable later)
        book.add_author('AI Book Generator')

        # Add metadata
        structure = book_data.get('structure', {})
        if structure.get('subtitle'):
            book.add_metadata('DC', 'description', self._clean_text(structure.get('subtitle')))

        # Add creation date
        book.add_metadata('DC', 'date', datetime.utcnow().strftime('%Y-%m-%d'))

        # Set CSS style
        style = epub.EpubItem(
            uid="style",
            file_name="style/style.css",
            media_type="text/css",
            content=self.styles
        )
        book.add_item(style)

        # Create title page
        title_html = f'''
        <div class="title-page">
            <h1>{title}</h1>
            {f'<p class="subtitle">{self._clean_text(structure.get("subtitle", ""))}</p>' if structure.get('subtitle') else ''}
        </div>
        '''

        title_page = epub.EpubHtml(
            title='Title Page',
            file_name='title.xhtml',
            lang='en'
        )
        title_page.content = title_html
        title_page.add_item(style)
        book.add_item(title_page)

        # Create chapters from pages
        pages = book_data.get('pages', [])
        chapters = []

        for idx, page in enumerate(pages):
            page_num = page.get('page_number', idx + 1)
            section_raw = page.get('section', f'Chapter {page_num}')
            section = self._clean_text(section_raw) if section_raw else f'Chapter {page_num}'
            content = page.get('content', '')

            # Convert markdown to HTML
            html_content = self._markdown_to_html(content)

            # Create chapter
            chapter_html = f'''
            <div class="chapter">
                <h2 class="section-title">{section}</h2>
                {html_content}
            </div>
            '''

            chapter = epub.EpubHtml(
                title=section,
                file_name=f'chapter_{page_num}.xhtml',
                lang='en'
            )
            chapter.content = chapter_html
            chapter.add_item(style)

            book.add_item(chapter)
            chapters.append(chapter)

        # Define Table of Contents
        toc_items = [epub.Link('title.xhtml', 'Title Page', 'title')]
        for idx, page in enumerate(pages):
            toc_items.append(
                epub.Link(
                    f'chapter_{idx+1}.xhtml',
                    page.get('section', f'Chapter {idx+1}'),
                    f'chapter_{idx+1}'
                )
            )
        book.toc = tuple(toc_items)

        # Add navigation files
        try:
            book.add_item(epub.EpubNcx())
            book.add_item(epub.EpubNav())
        except Exception as e:
            raise Exception(f"Failed to add navigation to EPUB: {str(e)}")

        # Define spine (reading order)
        try:
            book.spine = ['nav', title_page] + chapters
        except Exception as e:
            raise Exception(f"Failed to define EPUB spine: {str(e)}")

        # Write to BytesIO
        try:
            buffer = BytesIO()
            epub.write_epub(buffer, book)
            buffer.seek(0)
            return buffer
        except Exception as e:
            raise Exception(f"Failed to write EPUB file: {str(e)}")
