"""Fix daily_usage_summary NULL values"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in environment")

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Check for NULL values
    result = conn.execute(text("""
        SELECT summary_id, user_id, date,
               books_created, pages_generated, books_exported, credits_used
        FROM daily_usage_summary
        WHERE books_created IS NULL
           OR pages_generated IS NULL
           OR books_exported IS NULL
           OR credits_used IS NULL
    """))

    rows = result.fetchall()
    print(f"Found {len(rows)} records with NULL values:")
    for row in rows:
        print(f"  {row}")

    if rows:
        print("\nFixing NULL values...")
        conn.execute(text("""
            UPDATE daily_usage_summary
            SET books_created = COALESCE(books_created, 0),
                pages_generated = COALESCE(pages_generated, 0),
                books_exported = COALESCE(books_exported, 0),
                credits_used = COALESCE(credits_used, 0)
            WHERE books_created IS NULL
               OR pages_generated IS NULL
               OR books_exported IS NULL
               OR credits_used IS NULL
        """))
        conn.commit()
        print("Fixed!")
    else:
        print("No NULL values found - table is clean!")

    # Show all records
    result = conn.execute(text("SELECT * FROM daily_usage_summary"))
    print(f"\nAll daily_usage_summary records:")
    for row in result:
        print(f"  {row}")
