"""
Initialize database tables
"""
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Verify DATABASE_URL is loaded
db_url = os.getenv('DATABASE_URL')
print(f"Database URL: {db_url}")

if not db_url:
    print("❌ ERROR: DATABASE_URL not found in .env file")
    exit(1)

# Initialize database
from database.connection import initialize_database

print("Initializing database...")
db = initialize_database()

print("Creating tables...")
db.create_tables()

print("✅ Database tables created successfully!")
print("\nNext steps:")
print("1. Add your API keys to .env file")
print("2. Run: uvicorn main_postgres:app --reload")
print("3. Open: http://localhost:8000/health")
