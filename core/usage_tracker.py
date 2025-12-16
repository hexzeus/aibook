import sqlite3
from datetime import datetime
from typing import Dict


class UsageTracker:
    """Track usage per license key"""

    def __init__(self, db_path: str = "./aibook.db"):
        self.db_path = db_path
        self._init_database()

    def _init_database(self):
        """Initialize usage tracking table"""

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usage (
                license_key TEXT PRIMARY KEY,
                book_count INTEGER DEFAULT 0,
                page_count INTEGER DEFAULT 0,
                last_used TEXT,
                created_at TEXT
            )
        """)

        conn.commit()
        conn.close()

    def increment_book(self, license_key: str):
        """Increment book generation count"""

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        now = datetime.utcnow().isoformat()

        cursor.execute("""
            INSERT INTO usage (license_key, book_count, page_count, last_used, created_at)
            VALUES (?, 1, 0, ?, ?)
            ON CONFLICT(license_key) DO UPDATE SET
                book_count = book_count + 1,
                last_used = ?
        """, (license_key, now, now, now))

        conn.commit()
        conn.close()

    def increment_page(self, license_key: str):
        """Increment page generation count"""

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        now = datetime.utcnow().isoformat()

        cursor.execute("""
            INSERT INTO usage (license_key, book_count, page_count, last_used, created_at)
            VALUES (?, 0, 1, ?, ?)
            ON CONFLICT(license_key) DO UPDATE SET
                page_count = page_count + 1,
                last_used = ?
        """, (license_key, now, now, now))

        conn.commit()
        conn.close()

    def get_usage_stats(self, license_key: str) -> Dict:
        """Get usage statistics for a license key"""

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT * FROM usage WHERE license_key = ?
        """, (license_key,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return {
                'book_count': row['book_count'],
                'page_count': row['page_count'],
                'last_used': row['last_used'],
                'created_at': row['created_at']
            }
        else:
            return {
                'book_count': 0,
                'page_count': 0,
                'last_used': None,
                'created_at': None
            }
