"""
EPUB Page Counter - Estimate page count for reflowable EPUBs
"""
from io import BytesIO
import zipfile
import xml.etree.ElementTree as ET
from typing import Optional


class EPUBPageCounter:
    """
    Estimates page count for EPUB files

    Since EPUBs are reflowable, we estimate based on:
    - Word count
    - Standard e-reader settings (250-300 words per page)
    - Device: Kindle Paperwhite 6" (most common)
    """

    # Industry standard: 250-300 words per page on average e-reader
    WORDS_PER_PAGE = 275

    def count_pages(self, epub_buffer: BytesIO) -> Optional[int]:
        """
        Count estimated pages in EPUB

        Args:
            epub_buffer: EPUB file as BytesIO

        Returns:
            Estimated page count, or None if failed
        """
        try:
            epub_buffer.seek(0)

            if not zipfile.is_zipfile(epub_buffer):
                return None

            epub_buffer.seek(0)
            total_words = 0

            with zipfile.ZipFile(epub_buffer, 'r') as epub_zip:
                # Find all HTML/XHTML content files
                html_files = [f for f in epub_zip.namelist()
                             if f.endswith(('.xhtml', '.html'))
                             and not f.endswith(('toc.xhtml', 'nav.xhtml'))]

                for html_file in html_files:
                    try:
                        content = epub_zip.read(html_file).decode('utf-8', errors='ignore')
                        # Strip HTML tags and count words
                        words = self._count_words_in_html(content)
                        total_words += words
                    except Exception:
                        continue

            if total_words == 0:
                return None

            # Calculate pages (round up)
            estimated_pages = max(1, (total_words + self.WORDS_PER_PAGE - 1) // self.WORDS_PER_PAGE)

            return estimated_pages

        except Exception as e:
            print(f"[EPUB PAGE COUNTER] Error counting pages: {str(e)}")
            return None

    def _count_words_in_html(self, html_content: str) -> int:
        """Count words in HTML content (strip tags)"""
        try:
            # Simple tag removal (good enough for word counting)
            text = html_content

            # Remove script and style tags with their content
            import re
            text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)

            # Remove all HTML tags
            text = re.sub(r'<[^>]+>', ' ', text)

            # Remove extra whitespace
            text = re.sub(r'\s+', ' ', text)

            # Count words
            words = text.strip().split()
            return len(words)

        except Exception:
            return 0
