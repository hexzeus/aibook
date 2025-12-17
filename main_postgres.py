"""
AI Book Generator API - PostgreSQL Version with Credit System
"""
from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime
import os
import uuid
from dotenv import load_dotenv

from database import initialize_database, get_db
from database.repositories import UserRepository, BookRepository, UsageRepository
from core.gumroad_v2 import GumroadValidator
from core.book_generator import BookGenerator
from core.epub_exporter_v2 import EnhancedEPUBExporter

# Load environment
load_dotenv()

# Verify required env vars
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

if not ANTHROPIC_KEY:
    raise ValueError("ANTHROPIC_API_KEY not found in environment")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in environment")

# Initialize app
app = FastAPI(
    title="AI Book Generator API v2",
    description="Credit-based AI ebook creation with PostgreSQL",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
db_manager = initialize_database(DATABASE_URL)
db_manager.create_tables()

# Cleanup any stale transactions from previous crashes
print("[STARTUP] Cleaning up idle transactions...", flush=True)
terminated = db_manager.cleanup_idle_transactions()
print(f"[STARTUP] Terminated {terminated} idle transactions", flush=True)

# Initialize services
gumroad = GumroadValidator()

print("=" * 80)
print("AI BOOK GENERATOR v2.0 - POSTGRESQL + CREDITS")
print(f"Database: Connected")
print(f"Credit System: Active")
print(f"Started: {datetime.utcnow().isoformat()}")
print("=" * 80)


# Request models
class CreateBookRequest(BaseModel):
    description: str = Field(..., min_length=10, max_length=1000)
    target_pages: int = Field(..., ge=5, le=100)
    book_type: str = Field(default="general")


class GeneratePageRequest(BaseModel):
    book_id: str
    page_number: int = Field(..., ge=2)
    user_input: Optional[str] = None


class UpdatePageRequest(BaseModel):
    book_id: str
    page_number: int = Field(..., ge=1)
    content: str = Field(..., min_length=1)


class ExportBookRequest(BaseModel):
    book_id: str


class CompleteBookRequest(BaseModel):
    book_id: str


# Dependency to get current user
async def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    """Authenticate user and return user object"""
    print(f"[AUTH] Starting authentication...", flush=True)
    license_key = authorization.replace("Bearer ", "").strip()
    print(f"[AUTH] License key: {license_key[:8]}...", flush=True)

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    user_repo = UserRepository(db)

    # Check if user exists
    print(f"[AUTH] Checking if user exists in database...", flush=True)
    user = user_repo.get_by_license_key(license_key)

    if user:
        print(f"[AUTH] User found, returning user object...", flush=True)
        # TODO: Fix last_login update - currently causes session locks
        # user_repo.update_last_login(user.user_id)
        # db.commit()
        return user

    # Development bypass: Allow "TEST-LICENSE-KEY" in development mode
    is_dev = os.getenv('ENVIRONMENT', 'development') == 'development'
    print(f"[AUTH] User not found. Is dev mode: {is_dev}, Is test key: {license_key == 'TEST-LICENSE-KEY'}", flush=True)
    if is_dev and license_key == "TEST-LICENSE-KEY":
        print(f"[AUTH] Creating test user...", flush=True)
        # Create test user with 10000 credits
        user = user_repo.create_user(
            license_key=license_key,
            email="test@example.com",
            total_credits=10000,
            gumroad_product_id="test-product",
            gumroad_sale_id="test-sale",
            subscription_tier="enterprise"
        )
        db.commit()
        print(f"[AUTH] Test user created successfully", flush=True)
        return user

    # First time - validate with Gumroad and create user
    print(f"[AUTH] Validating with Gumroad API...", flush=True)
    is_valid, error, purchase_data = await gumroad.verify_license(license_key)
    print(f"[AUTH] Gumroad validation result: valid={is_valid}, error={error}", flush=True)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error or "Invalid license key")

    # Create new user with credits
    user = user_repo.create_user(
        license_key=license_key,
        email=purchase_data.get('email'),
        total_credits=purchase_data.get('credits', 1000),
        gumroad_product_id=purchase_data.get('product_id'),
        gumroad_sale_id=purchase_data.get('sale_id'),
        subscription_tier=purchase_data.get('tier', 'starter')
    )

    # Record the purchase
    user_repo.add_credits(
        user_id=user.user_id,
        credits=0,  # Already added in create_user
        purchase_data=purchase_data
    )

    db.commit()
    return user


# Routes
@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "online",
        "service": "AI Book Generator v2",
        "version": "2.0.0",
        "features": ["credit_system", "postgresql", "enhanced_epub"]
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    db_healthy = db_manager.health_check()

    return {
        "status": "healthy" if db_healthy else "degraded",
        "database": "connected" if db_healthy else "disconnected",
        "anthropic_configured": bool(ANTHROPIC_KEY),
        "gumroad_configured": bool(os.getenv("GUMROAD_ACCESS_TOKEN")),
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/credits")
async def get_credits(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user credit balance"""
    print(f"[API] Getting credits for user {user.user_id}", flush=True)
    user_repo = UserRepository(db)
    print(f"[API] Calling get_user_stats...", flush=True)
    stats = user_repo.get_user_stats(user.user_id)
    print(f"[API] Got stats, returning response...", flush=True)

    return {
        "success": True,
        "credits": {
            "total": stats['credits_total'],
            "used": stats['credits_used'],
            "remaining": stats['credits_remaining']
        },
        "usage": {
            "books_created": stats['total_books_created'],
            "pages_generated": stats['total_pages_generated'],
            "exports": stats['total_exports']
        }
    }


@app.post("/api/books")
async def create_book(
    request: CreateBookRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new book - costs 1 credit"""
    user_repo = UserRepository(db)
    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)

    # Check credits (1 for structure + 1 for first page = 2 credits)
    if user.credits_remaining < 2:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need 2, have {user.credits_remaining}"
        )

    # Consume credits upfront
    user_repo.consume_credits(user.user_id, 2)

    try:
        # Generate book structure
        generator = BookGenerator(api_key=None)

        structure = None
        first_page = None

        # Stream generation
        async for chunk in generator.generate_book_stream(
            description=request.description,
            target_pages=request.target_pages,
            book_type=request.book_type
        ):
            if chunk['stage'] == 'structure' and chunk['status'] == 'complete':
                structure = chunk['data']
            elif chunk['stage'] == 'first_page' and chunk['status'] == 'complete':
                first_page = chunk['data']
            elif chunk['stage'] == 'error':
                # Refund credits on error
                user_repo.refund_credits(user.user_id, 2)
                db.commit()
                raise Exception(chunk['error'])

        if not structure or not first_page:
            user_repo.refund_credits(user.user_id, 2)
            db.commit()
            raise Exception("Failed to generate book")

        # Create book in database
        book = book_repo.create_book(
            user_id=user.user_id,
            title=structure['title'],
            description=request.description,
            target_pages=request.target_pages,
            book_type=request.book_type,
            structure=structure,
            subtitle=structure.get('subtitle'),
            tone=structure.get('tone'),
            themes=structure.get('themes')
        )

        # Create first page
        book_repo.create_page(
            book_id=book.book_id,
            page_number=first_page['page_number'],
            section=first_page['section'],
            content=first_page['content'],
            is_title_page=first_page.get('is_title_page', False),
            ai_model_used='claude-3-5-sonnet-20241022'
        )

        # Log usage
        usage_repo.log_action(
            user_id=user.user_id,
            action_type='book_created',
            credits_consumed=2,
            book_id=book.book_id,
            metadata={'target_pages': request.target_pages, 'book_type': request.book_type}
        )

        # Update user stats
        user_repo.increment_book_count(user.user_id)
        user_repo.increment_page_count(user.user_id, 1)

        db.commit()

        # Return full book data
        book_data = book_repo.get_book_with_pages(book.book_id, user.user_id)

        return {
            "success": True,
            "message": "Book created successfully",
            "credits_consumed": 2,
            "credits_remaining": user.credits_remaining - 2,
            "book": book_data
        }

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"\nDETAILED ERROR: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/books/generate-page")
async def generate_page(
    request: GeneratePageRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate next page - costs 1 credit"""
    user_repo = UserRepository(db)
    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)

    # Check credits
    if user.credits_remaining < 1:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need 1, have {user.credits_remaining}"
        )

    # Get book
    book = book_repo.get_book(uuid.UUID(request.book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Validate page number
    current_pages = len([p for p in book.pages if not p.is_deleted])
    expected_next = current_pages + 1

    if request.page_number != expected_next:
        raise HTTPException(
            status_code=400,
            detail=f"Page must be sequential. Next page should be {expected_next}"
        )

    if current_pages >= book.target_pages:
        raise HTTPException(status_code=400, detail="Book is already complete")

    # Consume credit
    user_repo.consume_credits(user.user_id, 1)

    try:
        # Generate page
        generator = BookGenerator(api_key=None)

        book_data = book_repo.get_book_with_pages(book.book_id, user.user_id)

        next_page = await generator.generate_next_page(
            book_structure=book_data['structure'],
            current_page=request.page_number - 1,
            previous_pages=book_data['pages'],
            user_input=request.user_input
        )

        # Save page
        book_repo.create_page(
            book_id=book.book_id,
            page_number=next_page['page_number'],
            section=next_page['section'],
            content=next_page['content'],
            user_guidance=request.user_input,
            ai_model_used='claude-3-5-sonnet-20241022'
        )

        # Log usage
        usage_repo.log_action(
            user_id=user.user_id,
            action_type='page_generated',
            credits_consumed=1,
            book_id=book.book_id,
            metadata={'page_number': next_page['page_number']}
        )

        # Update stats
        user_repo.increment_page_count(user.user_id, 1)

        db.commit()

        return {
            "success": True,
            "message": "Page generated successfully",
            "credits_consumed": 1,
            "credits_remaining": user.credits_remaining - 1,
            "page": next_page,
            "is_complete": next_page['page_number'] >= book.target_pages
        }

    except Exception as e:
        user_repo.refund_credits(user.user_id, 1)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/books/update-page")
async def update_page(
    request: UpdatePageRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update page content - FREE"""
    book_repo = BookRepository(db)

    book = book_repo.get_book(uuid.UUID(request.book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    page = book_repo.get_page_by_number(book.book_id, request.page_number)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    book_repo.update_page_content(page.page_id, request.content, save_previous=True)
    db.commit()

    return {
        "success": True,
        "message": "Page updated successfully"
    }


@app.get("/api/books")
async def list_books(
    user = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """List all books"""
    book_repo = BookRepository(db)
    books = book_repo.list_books(user.user_id, limit=limit, offset=offset)
    total = book_repo.count_books(user.user_id)

    return {
        "success": True,
        "books": [
            {
                'book_id': str(b.book_id),
                'title': b.title,
                'description': b.description,
                'book_type': b.book_type,
                'target_pages': b.target_pages,
                'page_count': b.current_page_count,
                'completion_percentage': b.completion_percentage,
                'status': b.status,
                'created_at': b.created_at.isoformat(),
                'updated_at': b.updated_at.isoformat()
            }
            for b in books
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@app.get("/api/books/in-progress")
async def list_in_progress_books(
    user = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """List in-progress books"""
    book_repo = BookRepository(db)
    books = book_repo.list_in_progress_books(user.user_id, limit=limit, offset=offset)

    return {
        "success": True,
        "books": [
            {
                'book_id': str(b.book_id),
                'title': b.title,
                'description': b.description,
                'book_type': b.book_type,
                'target_pages': b.target_pages,
                'page_count': b.current_page_count,
                'completion_percentage': b.completion_percentage,
                'created_at': b.created_at.isoformat(),
                'updated_at': b.updated_at.isoformat()
            }
            for b in books
        ],
        "total": len(books)
    }


@app.get("/api/books/completed")
async def list_completed_books(
    user = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """List completed books"""
    book_repo = BookRepository(db)
    books = book_repo.list_completed_books(user.user_id, limit=limit, offset=offset)

    return {
        "success": True,
        "books": [
            {
                'book_id': str(b.book_id),
                'title': b.title,
                'description': b.description,
                'book_type': b.book_type,
                'status': b.status,
                'is_completed': b.is_completed,
                'pages_generated': b.current_page_count,
                'total_pages': b.target_pages,
                'page_count': b.current_page_count,
                'cover_svg': b.cover_svg,
                'completed_at': b.completed_at.isoformat() if b.completed_at else None,
                'created_at': b.created_at.isoformat()
            }
            for b in books
        ],
        "total": len(books)
    }


@app.get("/api/books/{book_id}")
async def get_book(
    book_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get book with all pages"""
    book_repo = BookRepository(db)
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)

    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    return {
        "success": True,
        "book": book_data
    }


@app.delete("/api/books/{book_id}")
async def delete_book(
    book_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete book - FREE"""
    book_repo = BookRepository(db)
    deleted = book_repo.delete_book(uuid.UUID(book_id), user.user_id, soft_delete=True)

    if not deleted:
        raise HTTPException(status_code=404, detail="Book not found")

    db.commit()

    return {
        "success": True,
        "message": "Book deleted successfully"
    }


@app.post("/api/books/complete")
async def complete_book(
    request: CompleteBookRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete book and generate cover - costs 2 credits"""
    print(f"[COMPLETE] Starting book completion for book_id={request.book_id}", flush=True)
    user_repo = UserRepository(db)
    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)

    # Check credits
    print(f"[COMPLETE] Checking credits: {user.credits_remaining} remaining", flush=True)
    if user.credits_remaining < 2:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need 2 for cover, have {user.credits_remaining}"
        )

    print(f"[COMPLETE] Getting book from database...", flush=True)
    book = book_repo.get_book(uuid.UUID(request.book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    print(f"[COMPLETE] Checking if book is complete...", flush=True)
    current_pages = len([p for p in book.pages if not p.is_deleted])
    if current_pages < book.target_pages:
        raise HTTPException(
            status_code=400,
            detail=f"Book incomplete. {current_pages}/{book.target_pages} pages"
        )

    # Consume credits
    print(f"[COMPLETE] Consuming 2 credits...", flush=True)
    user_repo.consume_credits(user.user_id, 2)
    print(f"[COMPLETE] Credits consumed (will commit at end)", flush=True)

    try:
        # Generate cover
        print(f"[COMPLETE] Initializing BookGenerator...", flush=True)
        generator = BookGenerator(api_key=None)

        print(f"[COMPLETE] Generating cover SVG (this may take 10-30 seconds)...", flush=True)
        cover_svg = await generator.generate_book_cover_svg(
            book_title=book.title,
            book_themes=book.structure.get('themes', []),
            book_tone=book.structure.get('tone', 'engaging'),
            book_type=book.book_type
        )
        print(f"[COMPLETE] Cover generated successfully", flush=True)

        # Complete book
        print(f"[COMPLETE] Marking book as complete in database...", flush=True)
        book_repo.complete_book(book.book_id, cover_svg)
        print(f"[COMPLETE] Book marked as complete", flush=True)

        # Log usage
        print(f"[COMPLETE] Logging usage...", flush=True)
        usage_repo.log_action(
            user_id=user.user_id,
            action_type='book_completed',
            credits_consumed=2,
            book_id=book.book_id
        )
        print(f"[COMPLETE] Usage logged", flush=True)

        # Check for PostgreSQL locks before committing
        print(f"[COMPLETE] Checking for database locks...", flush=True)
        try:
            lock_query = text("""
                SELECT pid, usename, pg_blocking_pids(pid) as blocked_by, query
                FROM pg_stat_activity
                WHERE cardinality(pg_blocking_pids(pid)) > 0
            """)
            locks = db.execute(lock_query).fetchall()
            if locks:
                print(f"[COMPLETE] WARNING: Found {len(locks)} blocked queries!", flush=True)
                for lock in locks:
                    print(f"[COMPLETE] Blocked PID {lock[0]}: {lock[3][:100]}", flush=True)
        except Exception as lock_check_error:
            print(f"[COMPLETE] Could not check locks: {lock_check_error}", flush=True)

        # Try committing directly without flush (commit includes flush)
        print(f"[COMPLETE] Committing transaction...", flush=True)
        try:
            db.commit()
            print(f"[COMPLETE] Transaction committed successfully", flush=True)
        except Exception as commit_error:
            print(f"[COMPLETE] COMMIT ERROR: {str(commit_error)}", flush=True)
            import traceback
            print(f"[COMPLETE] Traceback: {traceback.format_exc()}", flush=True)
            raise

        return {
            "success": True,
            "message": "Book completed with AI cover",
            "credits_consumed": 2,
            "credits_remaining": user.credits_remaining - 2,
            "cover_svg": cover_svg
        }

    except Exception as e:
        print(f"[COMPLETE] ERROR: {str(e)}", flush=True)
        print(f"[COMPLETE] Refunding 2 credits...", flush=True)
        user_repo.refund_credits(user.user_id, 2)
        print(f"[COMPLETE] Rolling back transaction...", flush=True)
        db.rollback()
        print(f"[COMPLETE] Rollback complete", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/books/export")
async def export_book(
    request: ExportBookRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export book to EPUB - FREE"""
    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)

    book_data = book_repo.get_book_with_pages(uuid.UUID(request.book_id), user.user_id)
    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    # Generate EPUB
    exporter = EnhancedEPUBExporter()
    epub_buffer = exporter.export_book(book_data)

    # Log export
    usage_repo.create_export(
        book_id=uuid.UUID(request.book_id),
        user_id=user.user_id,
        format='epub',
        file_size_bytes=epub_buffer.getbuffer().nbytes
    )

    # Update stats
    user_repo = UserRepository(db)
    user_repo.increment_export_count(user.user_id)

    db.commit()

    filename = f"{book_data['title'].replace(' ', '_')}.epub"

    return StreamingResponse(
        epub_buffer,
        media_type="application/epub+zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom error response"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Catch-all error handler"""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main_postgres:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
