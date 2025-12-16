"""
Database migration script to add book completion features
Run this once on Render to update the production database schema
"""
import sqlite3
import os


def migrate_database():
    """Add new columns for book completion feature"""

    db_path = os.getenv("DATABASE_PATH", "./aibook.db")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Starting database migration...")

    # Check if columns already exist
    cursor.execute("PRAGMA table_info(books)")
    columns = [col[1] for col in cursor.fetchall()]

    migrations_needed = []

    if 'is_completed' not in columns:
        migrations_needed.append(("is_completed", "INTEGER DEFAULT 0"))

    if 'cover_svg' not in columns:
        migrations_needed.append(("cover_svg", "TEXT"))

    if 'completed_at' not in columns:
        migrations_needed.append(("completed_at", "TEXT"))

    if not migrations_needed:
        print("✅ Database schema is already up to date!")
    else:
        # Add missing columns
        for column_name, column_def in migrations_needed:
            try:
                cursor.execute(f"ALTER TABLE books ADD COLUMN {column_name} {column_def}")
                print(f"✅ Added column: {column_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print(f"⚠️  Column {column_name} already exists, skipping")
                else:
                    raise

        conn.commit()

    # ALWAYS update existing books to set is_completed = 0 where it's NULL
    # This is critical for books created before the migration
    print("\nChecking for books with NULL is_completed values...")
    cursor.execute("""
        UPDATE books
        SET is_completed = 0
        WHERE is_completed IS NULL
    """)
    rows_updated = cursor.rowcount
    conn.commit()

    if rows_updated > 0:
        print(f"✅ Updated {rows_updated} existing books to set is_completed = 0")
    else:
        print("✅ All books already have is_completed values set")

    conn.close()

    print("✅ Migration completed successfully!")


if __name__ == "__main__":
    migrate_database()
