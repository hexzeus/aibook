import json
import sqlite3
from typing import Optional, List, Dict
from datetime import datetime
import os


class BookStore:
    """SQLite database manager for book storage"""

    def __init__(self, db_path: str = "./aibook.db"):
        self.db_path = db_path
        self._init_database()

    def _init_database(self):
        """Initialize database tables"""

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Books table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS books (
                book_id TEXT PRIMARY KEY,
                license_key TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                target_pages INTEGER,
                book_type TEXT,
                structure TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # Pages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pages (
                page_id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                page_number INTEGER NOT NULL,
                section TEXT,
                content TEXT NOT NULL,
                is_title_page INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (book_id) REFERENCES books (book_id) ON DELETE CASCADE
            )
        """)

        # Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_books_license ON books(license_key)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pages_book ON pages(book_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pages_number ON pages(book_id, page_number)")

        conn.commit()
        conn.close()

    def create_book(
        self,
        license_key: str,
        book_id: str,
        title: str,
        description: str,
        target_pages: int,
        book_type: str,
        structure: Dict
    ) -> str:
        """Create a new book entry"""

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        now = datetime.utcnow().isoformat()

        cursor.execute("""
            INSERT INTO books (
                book_id, license_key, title, description, target_pages,
                book_type, structure, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            book_id, license_key, title, description, target_pages,
            book_type, json.dumps(structure), now, now
        ))

        conn.commit()
        conn.close()

        return book_id

    def save_page(
        self,
        page_id: str,
        book_id: str,
        page_number: int,
        section: str,
        content: str,
        is_title_page: bool = False
    ):
        """Save or update a page"""

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        now = datetime.utcnow().isoformat()

        # Check if page exists
        cursor.execute(
            "SELECT page_id FROM pages WHERE book_id = ? AND page_number = ?",
            (book_id, page_number)
        )
        existing = cursor.fetchone()

        if existing:
            # Update existing page
            cursor.execute("""
                UPDATE pages
                SET content = ?, section = ?, updated_at = ?
                WHERE book_id = ? AND page_number = ?
            """, (content, section, now, book_id, page_number))
        else:
            # Insert new page
            cursor.execute("""
                INSERT INTO pages (
                    page_id, book_id, page_number, section, content,
                    is_title_page, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                page_id, book_id, page_number, section, content,
                1 if is_title_page else 0, now, now
            ))

        conn.commit()
        conn.close()

    def get_book(self, license_key: str, book_id: str) -> Optional[Dict]:
        """Get a book with all its pages"""

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get book
        cursor.execute("""
            SELECT * FROM books
            WHERE book_id = ? AND license_key = ?
        """, (book_id, license_key))

        book_row = cursor.fetchone()

        if not book_row:
            conn.close()
            return None

        # Get all pages
        cursor.execute("""
            SELECT * FROM pages
            WHERE book_id = ?
            ORDER BY page_number ASC
        """, (book_id,))

        pages_rows = cursor.fetchall()

        conn.close()

        # Convert to dict
        book = dict(book_row)
        book['structure'] = json.loads(book['structure'])
        book['pages'] = [
            {
                'page_id': row['page_id'],
                'page_number': row['page_number'],
                'section': row['section'],
                'content': row['content'],
                'is_title_page': bool(row['is_title_page']),
                'created_at': row['created_at'],
                'updated_at': row['updated_at']
            }
            for row in pages_rows
        ]

        return book

    def list_books(
        self,
        license_key: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """List all books for a license key"""

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT b.*, COUNT(p.page_id) as page_count
            FROM books b
            LEFT JOIN pages p ON b.book_id = p.book_id
            WHERE b.license_key = ?
            GROUP BY b.book_id
            ORDER BY b.updated_at DESC
            LIMIT ? OFFSET ?
        """, (license_key, limit, offset))

        rows = cursor.fetchall()
        conn.close()

        return [
            {
                'book_id': row['book_id'],
                'title': row['title'],
                'description': row['description'],
                'target_pages': row['target_pages'],
                'book_type': row['book_type'],
                'page_count': row['page_count'],
                'created_at': row['created_at'],
                'updated_at': row['updated_at']
            }
            for row in rows
        ]

    def delete_book(self, license_key: str, book_id: str) -> bool:
        """Delete a book and all its pages"""

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Verify ownership
        cursor.execute(
            "SELECT book_id FROM books WHERE book_id = ? AND license_key = ?",
            (book_id, license_key)
        )

        if not cursor.fetchone():
            conn.close()
            return False

        # Delete pages first
        cursor.execute("DELETE FROM pages WHERE book_id = ?", (book_id,))

        # Delete book
        cursor.execute("DELETE FROM books WHERE book_id = ?", (book_id,))

        conn.commit()
        conn.close()

        return True

    def update_page_content(
        self,
        license_key: str,
        book_id: str,
        page_number: int,
        new_content: str
    ) -> bool:
        """Update the content of a specific page"""

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Verify book ownership
        cursor.execute(
            "SELECT book_id FROM books WHERE book_id = ? AND license_key = ?",
            (book_id, license_key)
        )

        if not cursor.fetchone():
            conn.close()
            return False

        now = datetime.utcnow().isoformat()

        cursor.execute("""
            UPDATE pages
            SET content = ?, updated_at = ?
            WHERE book_id = ? AND page_number = ?
        """, (new_content, now, book_id, page_number))

        # Also update book's updated_at
        cursor.execute("""
            UPDATE books
            SET updated_at = ?
            WHERE book_id = ?
        """, (now, book_id))

        conn.commit()
        conn.close()

        return True

    def count_books(self, license_key: str) -> int:
        """Count total books for a license key"""

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT COUNT(*) FROM books WHERE license_key = ?",
            (license_key,)
        )

        count = cursor.fetchone()[0]
        conn.close()

        return count
