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
from database.models import Book, Page
from database.repositories import UserRepository, BookRepository, UsageRepository
from core.gumroad_v2 import GumroadValidator
from core.book_generator import BookGenerator
from core.epub_exporter_v2 import EnhancedEPUBExporter
from core.credit_packages import get_all_packages, get_package_by_id, get_gumroad_url
from core.analytics import AnalyticsService
from core.rate_limiter import rate_limit_middleware, RateLimits
from core.gumroad_webhook import verify_gumroad_signature, process_gumroad_webhook
from core.subscription_manager import SubscriptionService, get_all_plans as get_subscription_plans, get_plan_by_id
from core.stripe_integration import StripeIntegration
from core.affiliate_system import AffiliateSystem

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

# CORS - Restrict to production frontend
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://aibooktool.netlify.app")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
    ],
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

# Initialize AI clients for premium features
try:
    from openai import OpenAI
    openai_api_key = os.getenv("OPEN_AI_ID") or os.getenv("OPENAI_API_KEY")
    openai_client = OpenAI(api_key=openai_api_key) if openai_api_key else None
    print(f"[INIT] OpenAI Client: {'Configured' if openai_client else 'Not available'}")
except Exception as e:
    openai_client = None
    print(f"[INIT] OpenAI Client: Failed to initialize - {str(e)}")

try:
    from anthropic import Anthropic
    claude_ai_client = Anthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None
    print(f"[INIT] Claude Client: {'Configured' if claude_ai_client else 'Not available'}")
except Exception as e:
    claude_ai_client = None
    print(f"[INIT] Claude Client: Failed to initialize - {str(e)}")

print("=" * 80)
print("AI BOOK GENERATOR v2.0 - POSTGRESQL + CREDITS")
print(f"Database: Connected")
print(f"Credit System: Active")
print(f"OpenAI: {'Ready' if openai_client else 'Not configured'}")
print(f"Claude: {'Ready' if claude_ai_client else 'Not configured'}")
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
    format: str = 'epub'  # epub, pdf, docx, txt


class CompleteBookRequest(BaseModel):
    book_id: str


class AutoGenerateBookRequest(BaseModel):
    book_id: str
    with_illustrations: bool = False  # Whether to generate illustrations for each page


class UpdateBookRequest(BaseModel):
    book_id: str
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None


class DeletePageRequest(BaseModel):
    book_id: str
    page_id: str


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
        # Update last login with non-blocking approach
        user_repo.update_last_login(user.user_id)
        db.commit()
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
    # Email is required for marketing and support
    email = purchase_data.get('email')
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required. Please purchase with a valid email address."
        )

    user = user_repo.create_user(
        license_key=license_key,
        email=email,
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
        },
        "preferred_model": user.preferred_model or 'claude'
    }


@app.get("/api/credit-packages")
async def get_credit_packages():
    """Get available credit packages for purchase"""
    packages = get_all_packages()

    return {
        "success": True,
        "packages": [
            {
                "id": p.id,
                "name": p.name,
                "credits": p.credits,
                "price": p.price_display,
                "price_cents": p.price_usd,
                "savings_percent": p.savings_percent,
                "badge": p.badge,
                "is_featured": p.is_featured,
                "purchase_url": get_gumroad_url(p.id)
            }
            for p in packages
        ]
    }


@app.post("/api/credits/purchase")
async def initiate_credit_purchase(
    package_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate credit purchase - returns Gumroad URL
    User will be redirected to Gumroad, then webhook will add credits
    """
    package = get_package_by_id(package_id)
    if not package:
        raise HTTPException(status_code=400, detail="Invalid package ID")

    # Generate Gumroad URL with user's license key as custom field
    gumroad_url = get_gumroad_url(package_id)

    # Add license key as query parameter for auto-fill
    purchase_url = f"{gumroad_url}?wanted=true&license_key={user.license_key}"

    return {
        "success": True,
        "purchase_url": purchase_url,
        "package": {
            "id": package.id,
            "name": package.name,
            "credits": package.credits,
            "price": package.price_display
        }
    }


@app.post("/api/books")
async def create_book(
    request: CreateBookRequest,
    http_request: Request,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new book - costs 2 credits"""
    # Rate limit: 10 books per hour
    await rate_limit_middleware(
        http_request,
        RateLimits.BOOK_CREATE,
        key_func=lambda r: str(user.user_id)
    )

    user_repo = UserRepository(db)
    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)

    # Check credits (1 for structure + 1 for first page = 2 credits)
    if user.credits_remaining < 2:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need 2, have {user.credits_remaining}"
        )

    # Store user_id before any DB operations
    user_id = user.user_id

    # Consume credits upfront and commit immediately
    user_repo.consume_credits(user_id, 2)
    db.commit()

    try:
        # Generate book structure (this takes 30+ seconds, connection would timeout if held open)
        # Use user's preferred model (default: claude)
        preferred_model = user.preferred_model or 'claude'
        generator = BookGenerator(api_key=None, model_provider=preferred_model)

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
                user_repo.refund_credits(user_id, 2)
                db.commit()
                raise Exception(chunk['error'])

        if not structure or not first_page:
            user_repo.refund_credits(user_id, 2)
            db.commit()
            raise Exception("Failed to generate book")

        # Create book in database
        book = book_repo.create_book(
            user_id=user_id,
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
            user_id=user_id,
            action_type='book_created',
            credits_consumed=2,
            book_id=book.book_id,
            metadata={'target_pages': request.target_pages, 'book_type': request.book_type}
        )

        # Update user stats
        user_repo.increment_book_count(user_id)
        user_repo.increment_page_count(user_id, 1)

        db.commit()

        # Return full book data
        book_data = book_repo.get_book_with_pages(book.book_id, user_id)

        # Get fresh credits count after all operations
        fresh_user = user_repo.get_by_id(user_id)

        return {
            "success": True,
            "message": "Book created successfully",
            "credits_consumed": 2,
            "credits_remaining": fresh_user.credits_remaining,
            "book": book_data
        }

    except Exception as e:
        db.rollback()
        # Note: Credits were already committed before AI generation started
        # This prevents SSL timeout errors during long AI operations
        # Credits are only refunded if generation explicitly fails (handled above)
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

    # Store user_id for potential refund (before any DB operations that might fail)
    user_id = user.user_id
    book_id = book.book_id

    # GET ALL BOOK DATA BEFORE COMMITTING (so we can close the connection)
    book_data = book_repo.get_book_with_pages(book_id, user_id)

    # Consume credit and commit immediately (prevents SSL timeout during AI generation)
    user_repo.consume_credits(user_id, 1)
    db.commit()

    try:
        # Generate page (this takes 30+ seconds, NO DB CONNECTION HELD)
        # Use user's preferred model (default: claude)
        preferred_model = user.preferred_model or 'claude'
        generator = BookGenerator(api_key=None, model_provider=preferred_model)

        next_page = await generator.generate_next_page(
            book_structure=book_data['structure'],
            current_page=request.page_number - 1,
            previous_pages=book_data['pages'],
            user_input=request.user_input
        )

        # Save page
        book_repo.create_page(
            book_id=book_id,
            page_number=next_page['page_number'],
            section=next_page['section'],
            content=next_page['content'],
            user_guidance=request.user_input,
            ai_model_used='claude-3-5-sonnet-20241022'
        )

        # Update book structure with coherence tracking if provided
        if 'updated_structure' in next_page:
            updated_structure = next_page['updated_structure']
            book = book_repo.get_book(book_id, user_id)
            book.structure = updated_structure
            print(f"[COHERENCE] Updated book structure with tracking data", flush=True)

        # Update book progress (current_page_count and completion_percentage)
        book = book_repo.get_book(book_id, user_id)
        current_pages = len([p for p in book.pages if not p.is_deleted])
        book.current_page_count = current_pages
        if book.target_pages > 0:
            book.completion_percentage = int((current_pages / book.target_pages) * 100)
        print(f"[PROGRESS] Book {book_id}: {current_pages}/{book.target_pages} pages ({book.completion_percentage}%)", flush=True)

        # Log usage
        usage_repo.log_action(
            user_id=user_id,
            action_type='page_generated',
            credits_consumed=1,
            book_id=book_id,
            metadata={'page_number': next_page['page_number']}
        )

        # Update stats
        user_repo.increment_page_count(user_id, 1)

        db.commit()

        # Get fresh credits count
        fresh_user = user_repo.get_by_id(user_id)
        target_pages = book_repo.get_book(book_id, user_id).target_pages

        return {
            "success": True,
            "message": "Page generated successfully",
            "credits_consumed": 1,
            "credits_remaining": fresh_user.credits_remaining,
            "page": next_page,
            "is_complete": next_page['page_number'] >= target_pages
        }

    except Exception as e:
        db.rollback()
        # Refund credit (user_id was stored before any DB operations)
        try:
            user_repo.refund_credits(user_id, 1)
            db.commit()
        except:
            pass  # If refund fails, at least we rolled back the original transaction
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


@app.put("/api/books/{book_id}/pages/{page_id}/notes")
async def update_page_notes(
    book_id: str,
    page_id: str,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update page notes - FREE"""
    book_repo = BookRepository(db)

    # Verify book belongs to user
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get page
    page = db.query(Page).filter(
        Page.page_id == uuid.UUID(page_id),
        Page.book_id == uuid.UUID(book_id),
        Page.is_deleted == False
    ).first()

    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Update notes
    notes = request.get('notes', '')
    page.notes = notes if notes.strip() else None
    db.commit()

    return {
        "success": True,
        "message": "Notes updated successfully"
    }


@app.delete("/api/books/page")
async def delete_page(
    request: DeletePageRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete page - FREE (soft delete)"""
    book_repo = BookRepository(db)

    # Verify book belongs to user
    book = book_repo.get_book(uuid.UUID(request.book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Delete the page (soft delete)
    deleted = book_repo.delete_page(uuid.UUID(request.page_id), soft_delete=True)
    if not deleted:
        raise HTTPException(status_code=404, detail="Page not found")

    db.commit()

    return {
        "success": True,
        "message": "Page deleted successfully"
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
                'pages_generated': b.current_page_count,
                'completion_percentage': b.completion_percentage,
                'status': b.status,
                'is_completed': b.is_completed,
                'cover_svg': b.cover_svg if b.is_completed else None,
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

    # Calculate actual page counts from pages relationship
    books_data = []
    for b in books:
        actual_page_count = len([p for p in b.pages if not p.is_deleted])
        completion = int((actual_page_count / b.target_pages * 100)) if b.target_pages > 0 else 0

        books_data.append({
            'book_id': str(b.book_id),
            'title': b.title,
            'description': b.description,
            'book_type': b.book_type,
            'target_pages': b.target_pages,
            'page_count': actual_page_count,
            'pages_generated': actual_page_count,
            'completion_percentage': completion,
            'status': 'in_progress',
            'created_at': b.created_at.isoformat(),
            'updated_at': b.updated_at.isoformat()
        })

    return {
        "success": True,
        "books": books_data,
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
                'pages_generated': len([p for p in b.pages if not p.is_deleted]),
                'total_pages': b.target_pages,
                'page_count': len([p for p in b.pages if not p.is_deleted]),
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


@app.put("/api/books/{book_id}")
async def update_book(
    book_id: str,
    request: UpdateBookRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update book metadata (title, subtitle, description) - FREE"""
    book_repo = BookRepository(db)

    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Update only the fields that were provided
    if request.title is not None:
        book.title = request.title
    if request.subtitle is not None:
        book.subtitle = request.subtitle
    if request.description is not None:
        book.description = request.description

    db.commit()

    return {
        "success": True,
        "message": "Book updated successfully",
        "book": {
            "book_id": str(book.book_id),
            "title": book.title,
            "subtitle": book.subtitle,
            "description": book.description
        }
    }


@app.post("/api/books/{book_id}/archive")
async def archive_book(
    book_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Archive book (soft delete, can be restored) - FREE"""
    book_repo = BookRepository(db)
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    book.is_deleted = True
    book.deleted_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": "Book archived successfully"
    }


@app.post("/api/books/{book_id}/restore")
async def restore_book(
    book_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restore archived book - FREE"""
    book_repo = BookRepository(db)

    # Get book even if deleted
    book = db.query(Book).filter(
        Book.book_id == uuid.UUID(book_id),
        Book.user_id == user.user_id
    ).first()

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    book.is_deleted = False
    book.deleted_at = None
    db.commit()

    return {
        "success": True,
        "message": "Book restored successfully"
    }


@app.get("/api/books/archived")
async def get_archived_books(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all archived books"""
    archived = db.query(Book).filter(
        Book.user_id == user.user_id,
        Book.is_deleted == True
    ).order_by(Book.deleted_at.desc()).all()

    books_data = []
    for book in archived:
        pages = [p for p in book.pages if not p.is_deleted]
        page_count = len(pages)
        pages_generated = page_count
        completion_percentage = int((pages_generated / book.target_pages * 100)) if book.target_pages > 0 else 0

        books_data.append({
            'book_id': str(book.book_id),
            'title': book.title,
            'subtitle': book.subtitle,
            'description': book.description,
            'book_type': book.book_type,
            'target_pages': book.target_pages,
            'page_count': page_count,
            'pages_generated': pages_generated,
            'completion_percentage': completion_percentage,
            'status': book.status,
            'is_completed': book.is_completed,
            'cover_svg': book.cover_svg,
            'created_at': book.created_at.isoformat() if book.created_at else None,
            'updated_at': book.updated_at.isoformat() if book.updated_at else None,
            'completed_at': book.completed_at.isoformat() if book.completed_at else None,
            'deleted_at': book.deleted_at.isoformat() if book.deleted_at else None,
        })

    return {
        "success": True,
        "books": books_data
    }


@app.delete("/api/books/{book_id}")
async def delete_book(
    book_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete book permanently - FREE"""
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

    # CRITICAL: Get all book data BEFORE consuming credits and committing
    # This prevents SSL timeout during AI generation
    print(f"[COMPLETE] Extracting book data before AI generation...", flush=True)
    book_id_str = str(book.book_id)
    user_id_str = str(user.user_id)
    book_title = book.title
    book_themes = book.structure.get('themes', []) if book.structure else []
    book_tone = book.structure.get('tone', 'engaging') if book.structure else 'engaging'
    book_type = book.book_type

    # Consume credits and commit IMMEDIATELY (before AI generation)
    print(f"[COMPLETE] Consuming 2 credits...", flush=True)
    user_repo.consume_credits(user.user_id, 2)

    # Get updated credits count BEFORE committing
    credits_after = user.credits_remaining - 2

    print(f"[COMPLETE] Committing credits immediately (to prevent SSL timeout)...", flush=True)
    db.commit()
    print(f"[COMPLETE] Credits committed, DB connection released", flush=True)

    try:
        # Generate cover (NO DB CONNECTION HELD - this takes 10-30 seconds)
        print(f"[COMPLETE] Initializing BookGenerator...", flush=True)
        # Use user's preferred model
        preferred_model = user.preferred_model or 'claude'
        generator = BookGenerator(api_key=None, model_provider=preferred_model)

        # Always use DALL-E for image generation (better quality than SVG)
        print(f"[COMPLETE] Generating cover BACKGROUND with DALL-E (this may take 10-30 seconds)...", flush=True)
        cover_background_base64 = await generator.generate_book_cover_image(
            book_title=book_title,
            book_themes=book_themes,
            book_tone=book_tone,
            book_type=book_type
        )
        print(f"[COMPLETE] Cover background generated successfully", flush=True)

        # Overlay text on cover background (perfect typography, no AI spelling errors!)
        print(f"[COMPLETE] Adding title text overlay to cover...", flush=True)
        from core.cover_text_overlay import CoverTextOverlay
        overlay_engine = CoverTextOverlay()

        # Get subtitle for cover
        book_subtitle = book.subtitle if hasattr(book, 'subtitle') else None

        cover_image_base64 = overlay_engine.add_text_to_cover(
            background_base64=cover_background_base64,
            title=book_title,
            subtitle=book_subtitle,
            author=None  # Can add author name later if needed
        )
        print(f"[COMPLETE] Text overlay complete - cover ready!", flush=True)

        # Store as data URL for easier frontend display (JPEG for smaller size)
        cover_svg = f"data:image/jpeg;base64,{cover_image_base64}"

        # Generate EPUB and count pages in background
        print(f"[COMPLETE] Generating EPUB to count pages...", flush=True)
        epub_page_count = None
        try:
            from core.epub_exporter_v2 import EnhancedEPUBExporter
            from core.epub_page_counter import EPUBPageCounter

            # Get book data for EPUB export
            book_data = book_repo.get_book_with_pages(uuid.UUID(book_id_str), uuid.UUID(user_id_str))

            # Generate EPUB
            exporter = EnhancedEPUBExporter()
            epub_buffer = exporter.export_book(book_data)

            # Count pages
            counter = EPUBPageCounter()
            epub_page_count = counter.count_pages(epub_buffer)

            if epub_page_count:
                print(f"[COMPLETE] EPUB page count: {epub_page_count} pages", flush=True)
            else:
                print(f"[COMPLETE] Could not calculate EPUB page count", flush=True)

        except Exception as e:
            print(f"[COMPLETE] Error counting EPUB pages: {str(e)}", flush=True)
            # Continue anyway - page count is optional

        # Now save the results to database (get fresh session)
        print(f"[COMPLETE] Marking book as complete in database...", flush=True)
        book_repo.complete_book(uuid.UUID(book_id_str), cover_svg, epub_page_count)
        print(f"[COMPLETE] Book marked as complete", flush=True)

        # Log usage
        print(f"[COMPLETE] Logging usage...", flush=True)
        usage_repo.log_action(
            user_id=uuid.UUID(user_id_str),
            action_type='book_completed',
            credits_consumed=2,
            book_id=uuid.UUID(book_id_str)
        )
        print(f"[COMPLETE] Usage logged", flush=True)

        # Commit the completion and usage log
        print(f"[COMPLETE] Committing book completion...", flush=True)
        db.commit()
        print(f"[COMPLETE] Transaction committed successfully", flush=True)

        return {
            "success": True,
            "message": "Book completed with AI cover",
            "credits_consumed": 2,
            "credits_remaining": credits_after,
            "cover_svg": cover_svg
        }

    except Exception as e:
        print(f"[COMPLETE] ERROR: {str(e)}", flush=True)
        import traceback
        print(f"[COMPLETE] Traceback: {traceback.format_exc()}", flush=True)

        # Credits already consumed and committed, so we need to refund in a new transaction
        print(f"[COMPLETE] Refunding 2 credits...", flush=True)
        try:
            db.rollback()  # Rollback any pending changes
            user_repo.refund_credits(uuid.UUID(user_id_str), 2)
            db.commit()
            print(f"[COMPLETE] Credits refunded successfully", flush=True)
        except Exception as refund_error:
            print(f"[COMPLETE] Refund error: {str(refund_error)}", flush=True)
            db.rollback()

        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/books/auto-generate")
async def auto_generate_book(
    request: AutoGenerateBookRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Auto-generate all remaining pages and optionally illustrations, then complete the book.

    Costs:
    - 1 credit per page
    - 3 credits per illustration (if with_illustrations=True)
    - 2 credits for cover generation

    Example: 10 remaining pages with illustrations = 10 + (10*3) + 2 = 42 credits
    """
    user_repo = UserRepository(db)
    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)

    print(f"[AUTO-GEN] Request received: book_id={request.book_id}, with_illustrations={request.with_illustrations}", flush=True)
    print(f"[AUTO-GEN] OpenAI client available: {openai_client is not None}", flush=True)

    # Get book
    book = book_repo.get_book(uuid.UUID(request.book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Calculate remaining pages
    current_pages = len([p for p in book.pages if not p.is_deleted])
    remaining_pages = book.target_pages - current_pages

    if remaining_pages <= 0:
        raise HTTPException(status_code=400, detail="Book already has all pages generated")

    # Calculate total credits needed
    page_credits = remaining_pages * 1
    illustration_credits = remaining_pages * 3 if request.with_illustrations else 0
    cover_credits = 2
    total_credits = page_credits + illustration_credits + cover_credits

    # Check credits
    if user.credits_remaining < total_credits:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need {total_credits} ({remaining_pages} pages + {illustration_credits} illustrations + 2 cover), have {user.credits_remaining}"
        )

    # Store user info
    user_id = user.user_id
    book_id = book.book_id
    preferred_model = user.preferred_model or 'claude'

    # Consume all credits upfront and commit
    user_repo.consume_credits(user_id, total_credits)
    credits_after = user.credits_remaining - total_credits
    db.commit()

    generated_pages = []
    generated_illustrations = []
    errors = []

    try:
        # Initialize generator
        generator = BookGenerator(api_key=None, model_provider=preferred_model)

        # Check if page 1 exists but has no illustration (and we want illustrations)
        if request.with_illustrations and current_pages >= 1:
            first_page = book_repo.get_page_by_number(book_id, 1)
            if first_page and not first_page.illustration_url:
                print(f"[AUTO-GEN] Page 1 exists but missing illustration, generating now...", flush=True)
                try:
                    # Generate illustration prompt from page 1 content
                    print(f"[AUTO-GEN] Generating illustration prompt for page 1...", flush=True)
                    illustration_prompt = await generator.generate_illustration_prompt(
                        page_content=first_page.content,
                        book_context=book.structure
                    )
                    print(f"[AUTO-GEN] Illustration prompt: {illustration_prompt[:100]}...", flush=True)

                    if not openai_client:
                        print(f"[AUTO-GEN] OpenAI not configured, skipping page 1 illustration", flush=True)
                    else:
                        enhanced_prompt = f"""Create a detailed artistic scene: {illustration_prompt}

CRITICAL RULES:
- This is a desktop wallpaper / artistic photograph / scene design
- ABSOLUTELY NO text, letters, words, signs, labels, or writing of ANY kind
- NO books, posters, newspapers, or any objects with text
- Pure visual imagery only - scenery, objects, characters, atmosphere
- Professional digital art quality
- Clean, detailed composition"""

                        # Commit and expunge before DALL-E call
                        db.commit()
                        db.expunge_all()
                        print(f"[AUTO-GEN] Calling DALL-E for page 1...", flush=True)

                        response = openai_client.images.generate(
                            model="dall-e-3",
                            prompt=enhanced_prompt,
                            size="1024x1024",
                            quality="standard",
                            n=1,
                            response_format="b64_json"
                        )

                        img_base64 = response.data[0].b64_json
                        print(f"[AUTO-GEN] DALL-E returned base64 image for page 1 ({len(img_base64)} chars)", flush=True)

                        data_url = f"data:image/png;base64,{img_base64}"

                        # Store illustration
                        print(f"[AUTO-GEN] Storing illustration for page 1...", flush=True)
                        page = book_repo.get_page_by_number(book_id, 1)
                        page.illustration_url = data_url
                        page.updated_at = datetime.utcnow()
                        db.commit()

                        generated_illustrations.append({
                            'page_number': 1,
                            'prompt': illustration_prompt
                        })

                        print(f"[AUTO-GEN] ✓ Illustration for page 1 generated successfully", flush=True)

                except Exception as ill_error:
                    print(f"[AUTO-GEN] ✗ Illustration error for page 1: {str(ill_error)}", flush=True)
                    import traceback
                    print(f"[AUTO-GEN] Traceback: {traceback.format_exc()}", flush=True)
                    errors.append(f"Page 1 illustration: {str(ill_error)}")
                    try:
                        db.rollback()
                        print(f"[AUTO-GEN] Transaction rolled back after page 1 illustration error", flush=True)
                    except Exception as rb_error:
                        print(f"[AUTO-GEN] Rollback error: {str(rb_error)}", flush=True)

        # Generate all remaining pages
        print(f"[AUTO-GEN] Generating {remaining_pages} pages for book {book_id}", flush=True)

        for i in range(remaining_pages):
            page_number = current_pages + i + 1

            try:
                # CRITICAL: Get book data and snapshot BEFORE AI generation
                book_data = book_repo.get_book_with_pages(book_id, user_id)
                book_structure = book_data['structure']
                previous_pages = book_data['pages']

                # Commit and expunge to release connection before AI call
                db.commit()
                db.expunge_all()  # Detach all objects from session

                # Generate page (NO DB CONNECTION HELD - prevents SSL timeout)
                print(f"[AUTO-GEN] Generating page {page_number}/{book.target_pages}...", flush=True)
                next_page = await generator.generate_next_page(
                    book_structure=book_structure,
                    current_page=page_number - 1,
                    previous_pages=previous_pages,
                    user_input=None
                )

                # Save page (connection will be refreshed automatically)
                created_page = book_repo.create_page(
                    book_id=book_id,
                    page_number=next_page['page_number'],
                    section=next_page['section'],
                    content=next_page['content'],
                    user_guidance=None,
                    ai_model_used='claude-3-5-sonnet-20241022'
                )

                # Update structure if provided
                if 'updated_structure' in next_page:
                    book = book_repo.get_book(book_id, user_id)
                    book.structure = next_page['updated_structure']

                # Update progress
                book = book_repo.get_book(book_id, user_id)
                current_pages_count = len([p for p in book.pages if not p.is_deleted])
                book.current_page_count = current_pages_count
                if book.target_pages > 0:
                    book.completion_percentage = int((current_pages_count / book.target_pages) * 100)

                db.commit()

                generated_pages.append({
                    'page_number': page_number,
                    'page_id': str(created_page.page_id),
                    'section': next_page['section']
                })

                print(f"[AUTO-GEN] Page {page_number} generated successfully", flush=True)

                # Generate illustration if requested
                print(f"[AUTO-GEN] Checking if illustrations requested: {request.with_illustrations}", flush=True)
                if request.with_illustrations:
                    try:
                        print(f"[AUTO-GEN] Generating illustration for page {page_number}...", flush=True)

                        # Generate AI prompt for the illustration based on page content
                        print(f"[AUTO-GEN] Generating illustration prompt for page {page_number}...", flush=True)
                        illustration_prompt = await generator.generate_illustration_prompt(
                            page_content=next_page['content'],
                            book_context=book_data['structure']
                        )
                        print(f"[AUTO-GEN] Illustration prompt: {illustration_prompt[:100]}...", flush=True)

                        # Generate illustration using DALL-E
                        if not openai_client:
                            print(f"[AUTO-GEN] OpenAI not configured, skipping illustration", flush=True)
                            errors.append(f"Page {page_number}: OpenAI not configured for illustrations")
                        else:
                            enhanced_prompt = f"""Create a detailed artistic scene: {illustration_prompt}

CRITICAL RULES:
- This is a desktop wallpaper / artistic photograph / scene design
- ABSOLUTELY NO text, letters, words, signs, labels, or writing of ANY kind
- NO books, posters, newspapers, or any objects with text
- Pure visual imagery only - scenery, objects, characters, atmosphere
- Professional digital art quality
- Clean, detailed composition"""

                            # CRITICAL: Commit and expunge before DALL-E call to prevent SSL timeout
                            db.commit()
                            db.expunge_all()
                            print(f"[AUTO-GEN] Calling DALL-E for page {page_number}...", flush=True)

                            # Request base64 format directly to avoid download authentication issues
                            response = openai_client.images.generate(
                                model="dall-e-3",
                                prompt=enhanced_prompt,
                                size="1024x1024",
                                quality="standard",
                                n=1,
                                response_format="b64_json"  # Get base64 directly instead of URL
                            )

                            img_base64 = response.data[0].b64_json
                            print(f"[AUTO-GEN] DALL-E returned base64 image for page {page_number} ({len(img_base64)} chars)", flush=True)

                            data_url = f"data:image/png;base64,{img_base64}"

                            # Store illustration - refresh session and get page
                            print(f"[AUTO-GEN] Storing illustration for page {page_number}...", flush=True)
                            page = book_repo.get_page_by_number(book_id, page_number)
                            page.illustration_url = data_url
                            page.updated_at = datetime.utcnow()
                            db.commit()

                            generated_illustrations.append({
                                'page_number': page_number,
                                'prompt': illustration_prompt
                            })

                            print(f"[AUTO-GEN] ✓ Illustration for page {page_number} generated successfully", flush=True)

                    except Exception as ill_error:
                        print(f"[AUTO-GEN] ✗ Illustration error for page {page_number}: {str(ill_error)}", flush=True)
                        import traceback
                        print(f"[AUTO-GEN] Traceback: {traceback.format_exc()}", flush=True)
                        errors.append(f"Page {page_number} illustration: {str(ill_error)}")

                        # CRITICAL: Rollback transaction to clear invalid state
                        try:
                            db.rollback()
                            print(f"[AUTO-GEN] Transaction rolled back after illustration error", flush=True)
                        except Exception as rb_error:
                            print(f"[AUTO-GEN] Rollback error: {str(rb_error)}", flush=True)

                        # Continue with next page even if illustration fails

            except Exception as page_error:
                print(f"[AUTO-GEN] Page generation error: {str(page_error)}", flush=True)
                errors.append(f"Page {page_number}: {str(page_error)}")
                # Stop on page generation failure
                raise page_error

        # Log page generation
        usage_repo.log_action(
            user_id=user_id,
            action_type='auto_generate_pages',
            credits_consumed=page_credits + illustration_credits,
            book_id=book_id,
            metadata={'pages_generated': remaining_pages, 'with_illustrations': request.with_illustrations}
        )

        # Update user stats
        user_repo.increment_page_count(user_id, remaining_pages)
        db.commit()

        # Now complete the book (generate cover)
        print(f"[AUTO-GEN] Completing book with cover generation...", flush=True)

        book = book_repo.get_book(book_id, user_id)
        book_title = book.title
        book_subtitle = book.subtitle if hasattr(book, 'subtitle') else None
        book_themes = book.structure.get('themes', []) if book.structure else []
        book_tone = book.structure.get('tone', 'engaging') if book.structure else 'engaging'
        book_type = book.book_type

        # CRITICAL: Commit and expunge before DALL-E call to prevent SSL timeout
        db.commit()
        db.expunge_all()
        print(f"[AUTO-GEN] Calling DALL-E for cover generation...", flush=True)

        # Generate cover background
        cover_background_base64 = await generator.generate_book_cover_image(
            book_title=book_title,
            book_themes=book_themes,
            book_tone=book_tone,
            book_type=book_type
        )

        # Add text overlay
        from core.cover_text_overlay import CoverTextOverlay
        overlay_engine = CoverTextOverlay()

        cover_image_base64 = overlay_engine.add_text_to_cover(
            background_base64=cover_background_base64,
            title=book_title,
            subtitle=book_subtitle,
            author="AI Book Generator"
        )

        print(f"[AUTO-GEN] Cover generated with text overlay ({len(cover_image_base64)} chars)", flush=True)

        # Calculate EPUB page count
        epub_page_count = None
        try:
            from core.epub_page_counter import EPUBPageCounter
            counter = EPUBPageCounter()
            book_with_pages = book_repo.get_book_with_pages(book_id, user_id)
            epub_page_count = counter.estimate_page_count(book_with_pages)
        except Exception as e:
            print(f"[AUTO-GEN] Could not calculate EPUB page count: {str(e)}", flush=True)

        # Complete book
        book_repo.complete_book(book_id, cover_image_base64, epub_page_count)
        print(f"[AUTO-GEN] Book completed and cover stored ({len(cover_image_base64)} chars)", flush=True)

        # Log completion
        usage_repo.log_action(
            user_id=user_id,
            action_type='book_completed',
            credits_consumed=cover_credits,
            book_id=book_id
        )

        db.commit()

        print(f"[AUTO-GEN] Book auto-generation complete!", flush=True)

        return {
            "success": True,
            "message": f"Auto-generated {remaining_pages} pages" + (" with illustrations" if request.with_illustrations else "") + " and completed book",
            "credits_consumed": total_credits,
            "credits_remaining": credits_after,
            "pages_generated": len(generated_pages),
            "illustrations_generated": len(generated_illustrations),
            "errors": errors if errors else None,
            "book_completed": True
        }

    except Exception as e:
        print(f"[AUTO-GEN] ERROR: {str(e)}", flush=True)
        import traceback
        print(f"[AUTO-GEN] Traceback: {traceback.format_exc()}", flush=True)

        # Refund credits
        try:
            db.rollback()
            user_repo.refund_credits(user_id, total_credits)
            db.commit()
            print(f"[AUTO-GEN] Refunded {total_credits} credits", flush=True)
        except Exception as refund_error:
            print(f"[AUTO-GEN] Refund error: {str(refund_error)}", flush=True)
            db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Auto-generation failed: {str(e)}. Credits refunded. Generated {len(generated_pages)} pages before failure."
        )


@app.post("/api/books/export")
async def export_book(
    request: ExportBookRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export book in multiple formats - Costs 1 credit per export"""
    from core.pdf_exporter import PDFExporter

    user_repo = UserRepository(db)
    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)

    # Normalize format
    export_format = request.format.lower()
    if export_format not in ['epub', 'pdf', 'docx', 'txt']:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {export_format}")

    # Check credits
    if user.credits_remaining < 1:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Export requires 1 credit, you have {user.credits_remaining}"
        )

    book_data = book_repo.get_book_with_pages(uuid.UUID(request.book_id), user.user_id)
    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    # Consume credit for export
    user_repo.consume_credits(user.user_id, 1)

    try:
        # Generate file based on format
        if export_format == 'epub':
            exporter = EnhancedEPUBExporter()
            file_buffer = exporter.export_book(book_data)
            media_type = "application/epub+zip"
            extension = "epub"

        elif export_format == 'pdf':
            exporter = PDFExporter()
            file_buffer = exporter.export_book(book_data)
            media_type = "application/pdf"
            extension = "pdf"

        elif export_format == 'txt':
            # Simple text export
            text_content = f"{book_data['title']}\n"
            text_content += f"by {book_data.get('author_name', 'Unknown')}\n\n"
            text_content += "=" * 50 + "\n\n"
            for page in book_data.get('pages', []):
                if page.get('section'):
                    text_content += f"\n## {page['section']}\n\n"
                text_content += page.get('content', '') + "\n\n"

            from io import BytesIO
            file_buffer = BytesIO(text_content.encode('utf-8'))
            media_type = "text/plain"
            extension = "txt"

        elif export_format == 'docx':
            # Export as RTF (compatible with Word)
            rtf_content = "{\\rtf1\\ansi\\deff0\n"
            rtf_content += "{\\fonttbl{\\f0 Times New Roman;}}\n"
            rtf_content += f"{{\\title {book_data['title']}}}\n"
            rtf_content += f"{{\\author {book_data.get('author_name', 'Unknown')}}}\n"
            for page in book_data.get('pages', []):
                if page.get('section'):
                    rtf_content += f"\\par\\b {page['section']}\\b0\\par\n"
                content = page.get('content', '').replace('\n', '\\par\n')
                rtf_content += f"{content}\\par\n"
            rtf_content += "}"

            from io import BytesIO
            file_buffer = BytesIO(rtf_content.encode('utf-8'))
            media_type = "application/rtf"
            extension = "rtf"

        # Log export
        usage_repo.create_export(
            book_id=uuid.UUID(request.book_id),
            user_id=user.user_id,
            format=export_format,
            file_size_bytes=file_buffer.getbuffer().nbytes
        )

        # Log usage
        usage_repo.log_action(
            user_id=user.user_id,
            action_type='book_exported',
            credits_consumed=1,
            book_id=uuid.UUID(request.book_id),
            metadata={'format': export_format}
        )

        # Update stats
        user_repo.increment_export_count(user.user_id)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[EXPORT ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

    filename = f"{book_data['title'].replace(' ', '_')}.{extension}"

    # Reset buffer position to start before streaming
    file_buffer.seek(0)

    return StreamingResponse(
        file_buffer,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.post("/api/books/{book_id}/duplicate")
async def duplicate_book(
    book_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Duplicate a book - FREE (no credits consumed)"""
    book_repo = BookRepository(db)

    # Get original book
    original_book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not original_book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Create new book as duplicate
    new_book = Book(
        user_id=user.user_id,
        title=f"{original_book.title} (Copy)",
        subtitle=original_book.subtitle,
        description=original_book.description,
        author_name=original_book.author_name,
        book_type=original_book.book_type,
        genre=original_book.genre,
        target_pages=original_book.target_pages,
        current_page_count=0,
        language=original_book.language,
        structure=original_book.structure,
        tone=original_book.tone,
        style=original_book.style,
        themes=original_book.themes,
        status='draft',
        is_completed=False,
        completion_percentage=0,
        cover_svg=original_book.cover_svg,
        parent_book_id=original_book.book_id,
        version=1
    )
    db.add(new_book)
    db.flush()

    # Duplicate all pages
    pages_to_copy = [p for p in original_book.pages if not p.is_deleted]
    for original_page in pages_to_copy:
        new_page = Page(
            book_id=new_book.book_id,
            page_number=original_page.page_number,
            section=original_page.section,
            chapter_number=original_page.chapter_number,
            content=original_page.content,
            content_html=original_page.content_html,
            word_count=original_page.word_count,
            is_title_page=original_page.is_title_page,
            is_toc=original_page.is_toc,
            is_dedication=original_page.is_dedication,
            is_acknowledgments=original_page.is_acknowledgments,
            ai_model_used=original_page.ai_model_used,
            version=1
        )
        db.add(new_page)

    # Update new book's page count
    new_book.current_page_count = len(pages_to_copy)
    new_book.completion_percentage = int((len(pages_to_copy) / new_book.target_pages * 100)) if new_book.target_pages > 0 else 0

    db.commit()

    return {
        "success": True,
        "book_id": str(new_book.book_id),
        "message": f"Book duplicated successfully. {len(pages_to_copy)} pages copied."
    }


@app.post("/api/books/{book_id}/reorder-pages")
async def reorder_pages(
    book_id: str,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reorder pages in a book - FREE"""
    book_repo = BookRepository(db)

    # Get book
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get new page order (list of page_ids in desired order)
    page_order = request.get('page_order', [])

    if not page_order:
        raise HTTPException(status_code=400, detail="page_order is required")

    # Update page numbers based on new order
    for idx, page_id in enumerate(page_order, start=1):
        page = db.query(Page).filter(
            Page.page_id == uuid.UUID(page_id),
            Page.book_id == uuid.UUID(book_id)
        ).first()

        if page:
            page.page_number = idx

    db.commit()

    return {
        "success": True,
        "message": "Pages reordered successfully"
    }


@app.post("/api/books/{book_id}/pages/{page_id}/duplicate")
async def duplicate_page(
    book_id: str,
    page_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Duplicate a single page - FREE"""
    book_repo = BookRepository(db)

    # Get book
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get original page
    original_page = db.query(Page).filter(
        Page.page_id == uuid.UUID(page_id),
        Page.book_id == uuid.UUID(book_id),
        Page.is_deleted == False
    ).first()

    if not original_page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Don't allow duplicating title page
    if original_page.is_title_page:
        raise HTTPException(status_code=400, detail="Cannot duplicate title page")

    # Get all non-deleted pages ordered by page_number
    all_pages = db.query(Page).filter(
        Page.book_id == uuid.UUID(book_id),
        Page.is_deleted == False
    ).order_by(Page.page_number).all()

    # Find the position to insert (right after the original page)
    insert_position = original_page.page_number + 1

    # Shift all subsequent pages up by 1
    for page in all_pages:
        if page.page_number >= insert_position:
            page.page_number += 1

    # Create the duplicate page
    new_page = Page(
        book_id=book.book_id,
        page_number=insert_position,
        section=original_page.section,
        chapter_number=original_page.chapter_number,
        content=original_page.content,
        content_html=original_page.content_html,
        word_count=original_page.word_count,
        is_title_page=False,
        is_toc=original_page.is_toc,
        is_dedication=original_page.is_dedication,
        is_acknowledgments=original_page.is_acknowledgments,
        ai_model_used=original_page.ai_model_used,
        version=1
    )
    db.add(new_page)

    # Update book's page count
    book.current_page_count = len(all_pages) + 1
    if book.target_pages > 0:
        book.completion_percentage = int((book.current_page_count / book.target_pages) * 100)

    db.commit()
    db.refresh(new_page)

    return {
        "success": True,
        "page_id": str(new_page.page_id),
        "message": f"Page {original_page.page_number} duplicated successfully"
    }


@app.get("/api/exports/history")
async def get_export_history(
    limit: int = 50,
    offset: int = 0,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's export history - FREE"""
    usage_repo = UsageRepository(db)
    book_repo = BookRepository(db)

    # Get exports for this user
    exports = usage_repo.list_exports(
        user_id=user.user_id,
        limit=limit,
        offset=offset
    )

    export_data = []
    for export in exports:
        # Get book details
        book = book_repo.get_book(export.book_id, user.user_id)

        export_data.append({
            'export_id': str(export.export_id),
            'book_id': str(export.book_id),
            'book_title': book.title if book else 'Unknown Book',
            'format': export.format,
            'file_size_bytes': export.file_size_bytes,
            'download_count': export.download_count,
            'export_status': export.export_status,
            'created_at': export.created_at.isoformat() if export.created_at else None,
            'last_downloaded_at': export.last_downloaded_at.isoformat() if export.last_downloaded_at else None,
        })

    return {
        "success": True,
        "exports": export_data,
        "total": len(export_data)
    }


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


# Gumroad Webhook
@app.post("/api/webhooks/gumroad")
async def gumroad_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle Gumroad webhooks for instant credit delivery
    Called when user makes a purchase
    """
    # Get raw body for signature verification
    body = await request.body()
    signature = request.headers.get("X-Gumroad-Signature", "")

    # Verify signature
    if not verify_gumroad_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse JSON
    try:
        data = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Process webhook
    result = process_gumroad_webhook(data, db)

    return result


# Analytics endpoints
@app.get("/api/analytics/realtime")
async def get_realtime_stats(db: Session = Depends(get_db)):
    """Get real-time statistics for social proof"""
    analytics = AnalyticsService(db)
    return analytics.get_real_time_stats()


@app.get("/api/analytics/conversion-funnel")
async def get_conversion_funnel(
    days: int = 30,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get conversion funnel metrics (admin only)"""
    analytics = AnalyticsService(db)
    return analytics.get_conversion_funnel(days)


@app.get("/api/analytics/credit-stats")
async def get_credit_stats(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get credit usage statistics"""
    analytics = AnalyticsService(db)
    return analytics.get_credit_usage_stats()


# Subscription endpoints
@app.get("/api/subscriptions/plans")
async def get_subscription_plan_list():
    """Get all available subscription plans"""
    plans = get_subscription_plans()

    return {
        "success": True,
        "plans": [
            {
                "id": p.id,
                "name": p.name,
                "price_monthly": p.price_display_monthly,
                "price_yearly": p.price_display_yearly,
                "price_monthly_cents": p.price_monthly_usd,
                "price_yearly_cents": p.price_yearly_usd,
                "credits_per_month": p.credits_per_month,
                "features": p.features,
                "is_popular": p.is_popular
            }
            for p in plans
        ]
    }


@app.post("/api/subscriptions/activate")
async def activate_subscription_endpoint(
    plan_id: str,
    billing_cycle: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Activate subscription (called after payment)"""
    subscription_service = SubscriptionService(db)

    user = subscription_service.activate_subscription(
        user_id=user.user_id,
        plan_id=plan_id,
        billing_cycle=billing_cycle
    )

    db.commit()

    return {
        "success": True,
        "subscription": {
            "tier": user.subscription_tier,
            "status": user.subscription_status,
            "credits_per_month": user.monthly_credit_allocation,
            "expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None
        }
    }


@app.post("/api/subscriptions/cancel")
async def cancel_subscription_endpoint(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel subscription"""
    subscription_service = SubscriptionService(db)
    subscription_service.cancel_subscription(user.user_id)
    db.commit()

    return {
        "success": True,
        "message": "Subscription cancelled. You'll retain access until expiration."
    }


@app.get("/api/subscriptions/status")
async def get_subscription_status(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current subscription status"""
    return {
        "success": True,
        "subscription": {
            "tier": user.subscription_tier,
            "status": user.subscription_status,
            "credits_per_month": user.monthly_credit_allocation,
            "expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
            "next_credit_reset": user.next_credit_reset_at.isoformat() if user.next_credit_reset_at else None
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main_postgres:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )


# Stripe endpoints
stripe_client = StripeIntegration()

@app.post("/api/stripe/create-checkout")
async def create_stripe_checkout(
    package_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create Stripe checkout session for credit purchase"""
    package = get_package_by_id(package_id)
    if not package:
        raise HTTPException(status_code=400, detail="Invalid package ID")

    session = stripe_client.create_checkout_session(
        price_id=f"price_{package.id}",  # Configure in Stripe dashboard
        customer_email=user.email,
        metadata={
            'user_id': str(user.user_id),
            'package_id': package.id,
            'credits': package.credits
        }
    )

    return {"success": True, "checkout_url": session['url']}


@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhooks"""
    payload = await request.body()
    signature = request.headers.get('stripe-signature', '')

    if not stripe_client.verify_webhook_signature(payload, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        import json
        event_data = json.loads(payload)
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    result = stripe_client.process_webhook(event_data)
    user_repo = UserRepository(db)

    if result['event'] == 'payment_completed':
        # Grant credits
        user_id = uuid.UUID(result['user_id'])
        package = get_package_by_id(result['package_id'])
        
        user_repo.add_credits(
            user_id=user_id,
            credits=package.credits,
            purchase_data={
                'sale_id': result.get('payment_intent'),
                'product_name': package.name,
                'price_cents': result['amount_cents'],
                'credits': package.credits
            }
        )
        db.commit()

    return {"success": True}


# Affiliate endpoints
@app.get("/api/affiliate/stats")
async def get_affiliate_stats_endpoint(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's affiliate statistics"""
    affiliate_system = AffiliateSystem(db)
    stats = affiliate_system.get_affiliate_stats(user.user_id)

    # Return stats at top level (frontend expects this format)
    return {
        "success": True,
        "affiliate_code": user.affiliate_code,
        "total_referrals": user.total_referrals or 0,
        "total_earnings_cents": user.affiliate_earnings_cents or 0,
        "pending_payout_cents": user.affiliate_earnings_cents or 0,  # All earnings are pending until payout
        "paid_out_cents": 0,  # TODO: Track paid out separately
        "payout_email": user.affiliate_payout_email,
        "recent_referrals": []  # TODO: Implement referral tracking
    }


@app.post("/api/affiliate/generate-code")
async def generate_affiliate_code_endpoint(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate affiliate code for user"""
    affiliate_system = AffiliateSystem(db)
    code = affiliate_system.generate_affiliate_code(user.user_id)
    db.commit()
    
    return {"success": True, "code": code}


@app.post("/api/affiliate/update-payout-email")
async def update_affiliate_payout_email_endpoint(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update affiliate payout email"""
    email = request.get('email')
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user.affiliate_payout_email = email
    db.commit()

    return {"success": True}


@app.post("/api/affiliate/request-payout")
async def request_affiliate_payout_endpoint(
    paypal_email: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request affiliate payout"""
    affiliate_system = AffiliateSystem(db)

    try:
        result = affiliate_system.request_payout(user.user_id, paypal_email)
        db.commit()
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Premium feature endpoints
@app.post("/api/premium/generate-illustration")
async def generate_illustration_endpoint(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate AI illustration for book page (Premium feature - 3 credits)"""
    book_id = request.get('book_id')
    page_number = request.get('page_number')
    prompt = request.get('prompt')

    if not all([book_id, page_number, prompt]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Verify book ownership
    book_repo = BookRepository(db)
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get the page to add illustration to
    page = book_repo.get_page_by_number(uuid.UUID(book_id), page_number)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Check credits
    user_repo = UserRepository(db)
    if user.credits_remaining < 3:
        raise HTTPException(status_code=402, detail="Insufficient credits (requires 3)")

    # Consume credits
    user_repo.consume_credits(user.user_id, 3)
    db.commit()

    try:
        # Generate illustration using DALL-E 3 via OpenAI
        if not openai_client:
            raise HTTPException(status_code=503, detail="OpenAI API not configured. Please set OPEN_AI_ID or OPENAI_API_KEY environment variable.")

        # Enhance the prompt - create artistic scene/imagery WITHOUT any text
        # NEVER mention "book" or "illustration" - ChatGPT adds text to those!
        enhanced_prompt = f"""Create a detailed artistic scene: {prompt}

CRITICAL RULES:
- This is a desktop wallpaper / artistic photograph / scene design
- ABSOLUTELY NO text, letters, words, signs, labels, or writing of ANY kind
- NO books, posters, newspapers, or any objects with text
- Pure visual imagery only - scenery, objects, characters, atmosphere
- Professional digital art quality
- Clean, detailed composition"""

        # Generate image with DALL-E 3
        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=enhanced_prompt,
            size="1024x1024",  # DALL-E 3 supports 1024x1024, 1792x1024, or 1024x1792
            quality="standard",  # or "hd" for higher quality (costs more)
            n=1,
        )

        illustration_url = response.data[0].url
        print(f"[ILLUSTRATION] DALL-E generated URL: {illustration_url[:100]}...", flush=True)

        # Download and store the image as base64 (DALL-E URLs are temporary!)
        print(f"[ILLUSTRATION] Downloading image from DALL-E URL...", flush=True)
        import httpx
        import base64

        stored_url = None  # Track what we actually stored

        try:
            with httpx.Client(timeout=30.0) as client:
                img_response = client.get(illustration_url)
                img_response.raise_for_status()
                img_data = img_response.content

            # Convert to base64 data URL for storage
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            data_url = f"data:image/png;base64,{img_base64}"

            print(f"[ILLUSTRATION] Image downloaded and converted to base64 ({len(img_base64)} chars)", flush=True)

            # Store as data URL (permanent, not temporary!)
            page.illustration_url = data_url
            stored_url = data_url
            print(f"[ILLUSTRATION] Set page.illustration_url to data URL (length: {len(data_url)})", flush=True)

        except Exception as e:
            print(f"[ILLUSTRATION] ERROR downloading image: {str(e)}", flush=True)
            import traceback
            print(f"[ILLUSTRATION] Traceback: {traceback.format_exc()}", flush=True)
            # Fall back to storing URL (will expire, but better than nothing)
            page.illustration_url = illustration_url
            stored_url = illustration_url
            print(f"[ILLUSTRATION] Fallback: stored temporary DALL-E URL", flush=True)

        page.updated_at = datetime.utcnow()

        print(f"[ILLUSTRATION] Committing to database...", flush=True)
        db.commit()
        print(f"[ILLUSTRATION] Database commit successful!", flush=True)

        # Verify it was saved
        db.refresh(page)
        if page.illustration_url:
            saved_length = len(page.illustration_url)
            is_data_url = page.illustration_url.startswith('data:image/')
            print(f"[ILLUSTRATION] VERIFIED: illustration_url saved (length: {saved_length}, is_data_url: {is_data_url})", flush=True)
        else:
            print(f"[ILLUSTRATION] WARNING: illustration_url is NULL after commit!", flush=True)

        # Log the action
        usage_repo = UsageRepository(db)
        usage_repo.log_action(
            user_id=user.user_id,
            action_type='illustration_generated',
            credits_consumed=3,
            book_id=uuid.UUID(book_id),
            metadata={
                'page_number': page_number,
                'prompt': prompt[:200]  # Truncate for storage
            }
        )
        db.commit()

        # Return the stored URL (data URL if successful, temporary URL if fallback)
        return {
            "success": True,
            "illustration_url": stored_url,  # Return what we actually stored
            "message": "Illustration generated successfully!",
            "prompt_used": enhanced_prompt,
            "stored_as_data_url": stored_url.startswith('data:image/') if stored_url else False
        }
    except Exception as e:
        # Refund credits on failure
        db.rollback()
        user_repo.refund_credits(user.user_id, 3)
        db.commit()
        print(f"[ILLUSTRATION ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Illustration generation failed: {str(e)}")


@app.delete("/api/premium/delete-illustration")
async def delete_illustration_endpoint(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete illustration from a book page"""
    book_id = request.get('book_id')
    page_number = request.get('page_number')

    if not all([book_id, page_number]):
        raise HTTPException(status_code=400, detail="Missing book_id or page_number")

    # Verify book ownership
    book_repo = BookRepository(db)
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get the page
    page = book_repo.get_page_by_number(uuid.UUID(book_id), page_number)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Clear the illustration
    page.illustration_url = None
    page.updated_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": "Illustration deleted successfully"
    }


@app.post("/api/books/{book_id}/regenerate-cover")
async def regenerate_cover_endpoint(
    book_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Regenerate book cover (costs 2 credits, same as complete book)"""
    print(f"[REGENERATE COVER] Starting for book_id={book_id}", flush=True)
    user_repo = UserRepository(db)
    book_repo = BookRepository(db)

    # Check credits
    if user.credits_remaining < 2:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need 2 for cover, have {user.credits_remaining}"
        )

    # Get book
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Extract book data
    book_title = book.title
    book_subtitle = book.subtitle if hasattr(book, 'subtitle') else None
    book_themes = book.structure.get('themes', []) if book.structure else []
    book_tone = book.structure.get('tone', 'engaging') if book.structure else 'engaging'
    book_type = book.book_type

    # Consume credits
    user_repo.consume_credits(user.user_id, 2)
    db.commit()

    try:
        # Generate new cover with retry logic
        print(f"[REGENERATE COVER] Generating cover BACKGROUND with DALL-E...", flush=True)
        from core.book_generator import BookGenerator
        import asyncio

        preferred_model = user.preferred_model or 'claude'
        generator = BookGenerator(api_key=None, model_provider=preferred_model)

        # Retry logic for DALL-E API (3 attempts with exponential backoff)
        max_retries = 3
        cover_background_base64 = None
        last_error = None

        for attempt in range(max_retries):
            try:
                cover_background_base64 = await generator.generate_book_cover_image(
                    book_title=book_title,
                    book_themes=book_themes,
                    book_tone=book_tone,
                    book_type=book_type
                )
                print(f"[REGENERATE COVER] Cover background generated successfully", flush=True)
                break
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()
                # Only retry on server errors (500) or rate limits
                if 'server had an error' in error_msg or 'rate' in error_msg or '500' in error_msg:
                    wait_time = (2 ** attempt) * 2  # 2s, 4s, 8s
                    print(f"[REGENERATE COVER] DALL-E error (attempt {attempt+1}/{max_retries}), retrying in {wait_time}s...", flush=True)
                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                else:
                    # Non-retryable error, fail immediately
                    raise

        if cover_background_base64 is None:
            raise last_error or Exception("Failed to generate cover after retries")

        # Overlay text
        print(f"[REGENERATE COVER] Adding title text overlay...", flush=True)
        from core.cover_text_overlay import CoverTextOverlay
        overlay_engine = CoverTextOverlay()

        cover_image_base64 = overlay_engine.add_text_to_cover(
            background_base64=cover_background_base64,
            title=book_title,
            subtitle=book_subtitle,
            author=None
        )
        print(f"[REGENERATE COVER] Text overlay complete", flush=True)

        # add_text_to_cover already returns a data URL, so use it directly
        cover_svg = cover_image_base64

        # Update book
        book.cover_svg = cover_svg
        book.updated_at = datetime.utcnow()
        db.commit()

        # Log usage
        usage_repo = UsageRepository(db)
        usage_repo.log_action(
            user_id=user.user_id,
            action_type='cover_regenerated',
            credits_consumed=2,
            book_id=uuid.UUID(book_id)
        )
        db.commit()

        return {
            "success": True,
            "cover_svg": cover_svg,
            "message": "Cover regenerated successfully!"
        }

    except Exception as e:
        # Refund credits on failure
        db.rollback()
        user_repo.refund_credits(user.user_id, 2)
        db.commit()
        print(f"[REGENERATE COVER ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Cover regeneration failed: {str(e)}")


@app.post("/api/premium/apply-style")
async def apply_custom_style_endpoint(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply custom writing style to page (Premium feature - 2 credits)"""
    book_id = request.get('book_id')
    page_number = request.get('page_number')
    style = request.get('style')

    if not all([book_id, page_number, style]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Verify book ownership
    book_repo = BookRepository(db)
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get the page to rewrite
    page = book_repo.get_page_by_number(uuid.UUID(book_id), page_number)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Check credits
    user_repo = UserRepository(db)
    if user.credits_remaining < 2:
        raise HTTPException(status_code=402, detail="Insufficient credits (requires 2)")

    # Consume credits
    user_repo.consume_credits(user.user_id, 2)
    db.commit()

    try:
        # Use Claude to rewrite in the requested style
        claude_client = claude_ai_client or openai_client

        # Create style rewriting prompt
        style_prompt = f"""You are a professional author and editor. Your task is to rewrite the following text in a specific writing style while preserving the core meaning, plot points, and information.

ORIGINAL TEXT:
{page.content}

REQUESTED STYLE:
{style}

INSTRUCTIONS:
1. Rewrite the text completely in the requested style
2. Maintain all key information, plot points, and character details
3. Adjust vocabulary, sentence structure, tone, and pacing to match the style
4. Keep the same approximate length (within 20%)
5. Do not add new plot points or remove important details
6. Return ONLY the rewritten text, no explanations or meta-commentary

REWRITTEN TEXT:"""

        if claude_client:
            # Use Claude API
            response = claude_client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4000,
                temperature=0.7,
                messages=[{
                    "role": "user",
                    "content": style_prompt
                }]
            )
            rewritten_content = response.content[0].text.strip()
        else:
            # Fallback to OpenAI if available
            response = openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                max_tokens=4000,
                temperature=0.7,
                messages=[{
                    "role": "user",
                    "content": style_prompt
                }]
            )
            rewritten_content = response.choices[0].message.content.strip()

        # Update the page with rewritten content
        page.content = rewritten_content
        page.updated_at = datetime.utcnow()
        db.commit()

        # Log the action
        usage_repo = UsageRepository(db)
        usage_repo.log_action(
            user_id=user.user_id,
            action_type='style_applied',
            credits_consumed=2,
            book_id=uuid.UUID(book_id),
            metadata={
                'page_number': page_number,
                'style': style[:100]  # Truncate for storage
            }
        )
        db.commit()

        return {
            "success": True,
            "message": "Writing style applied successfully!",
            "new_content": rewritten_content
        }
    except Exception as e:
        # Refund credits on failure
        db.rollback()
        user_repo.refund_credits(user.user_id, 2)
        db.commit()
        print(f"[STYLE ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Style application failed: {str(e)}")


@app.post("/api/premium/bulk-export")
async def bulk_export_endpoint(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk export book to multiple formats (Premium feature - 1 credit per format)"""
    import zipfile
    from io import BytesIO
    from core.pdf_exporter import PDFExporter

    book_id = request.get('book_id')
    formats = request.get('formats', [])

    if not book_id or not formats:
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Verify book ownership
    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)
    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    credits_needed = len(formats)

    # Check credits
    user_repo = UserRepository(db)
    if user.credits_remaining < credits_needed:
        raise HTTPException(status_code=402, detail=f"Insufficient credits (requires {credits_needed})")

    # Consume credits
    user_repo.consume_credits(user.user_id, credits_needed)

    try:
        # Create ZIP file with all formats
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            base_filename = book_data['title'].replace(' ', '_')

            for fmt in formats:
                try:
                    if fmt.lower() == 'epub':
                        exporter = EnhancedEPUBExporter()
                        file_buffer = exporter.export_book(book_data)
                        file_buffer.seek(0)
                        zip_file.writestr(f"{base_filename}.epub", file_buffer.read())

                    elif fmt.lower() == 'pdf':
                        exporter = PDFExporter()
                        file_buffer = exporter.export_book(book_data)
                        file_buffer.seek(0)
                        zip_file.writestr(f"{base_filename}.pdf", file_buffer.read())

                    elif fmt.lower() == 'txt':
                        # Simple text export
                        text_content = f"{book_data['title']}\n"
                        text_content += f"by {book_data.get('author_name', 'Unknown')}\n\n"
                        text_content += "=" * 50 + "\n\n"
                        for page in book_data.get('pages', []):
                            if page.get('section'):
                                text_content += f"\n## {page['section']}\n\n"
                            text_content += page.get('content', '') + "\n\n"
                        zip_file.writestr(f"{base_filename}.txt", text_content.encode('utf-8'))

                    elif fmt.lower() == 'docx':
                        # For now, export as RTF (simple format)
                        rtf_content = "{\\rtf1\\ansi\\deff0\n"
                        rtf_content += "{\\fonttbl{\\f0 Times New Roman;}}\n"
                        rtf_content += f"{{\\title {book_data['title']}}}\n"
                        rtf_content += f"{{\\author {book_data.get('author_name', 'Unknown')}}}\n"
                        for page in book_data.get('pages', []):
                            if page.get('section'):
                                rtf_content += f"\\par\\b {page['section']}\\b0\\par\n"
                            content = page.get('content', '').replace('\n', '\\par\n')
                            rtf_content += f"{content}\\par\n"
                        rtf_content += "}"
                        zip_file.writestr(f"{base_filename}.rtf", rtf_content.encode('utf-8'))

                    # Log each export
                    usage_repo.log_action(
                        user_id=user.user_id,
                        action_type='book_exported',
                        credits_consumed=1,
                        book_id=uuid.UUID(book_id),
                        metadata={'format': fmt.lower(), 'bulk': True}
                    )

                except Exception as format_error:
                    print(f"[BULK EXPORT] Failed to export {fmt}: {str(format_error)}")
                    # Continue with other formats

        db.commit()

        # Reset buffer and return ZIP
        zip_buffer.seek(0)
        filename = f"{book_data['title'].replace(' ', '_')}_bulk_export.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except Exception as e:
        db.rollback()
        # Refund credits on failure
        user_repo.refund_credits(user.user_id, credits_needed)
        db.commit()
        print(f"[BULK EXPORT ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Bulk export failed: {str(e)}")


# ============================================================================
# PUBLISHING & VALIDATION ENDPOINTS
# ============================================================================

@app.post("/api/books/validate-epub")
async def validate_epub(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate EPUB for marketplace compliance"""
    from core.epub_validator import EPUBValidator

    book_id = request.get('book_id')
    if not book_id:
        raise HTTPException(status_code=400, detail="book_id required")

    # Get book data
    book_repo = BookRepository(db)
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)
    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    try:
        # Generate EPUB
        exporter = EnhancedEPUBExporter()
        epub_buffer = exporter.export_book(book_data)

        # Validate
        validator = EPUBValidator()
        result = validator.validate(epub_buffer)

        return {
            'success': True,
            'validation': result,
            'ready_to_publish': result['valid'] and result['score'] >= 90
        }

    except Exception as e:
        print(f"[EPUB VALIDATION ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@app.post("/api/books/check-readiness")
async def check_marketplace_readiness(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check book readiness for marketplace publishing"""
    from core.epub_validator import MarketplaceReadinessChecker

    book_id = request.get('book_id')
    validate_epub = request.get('validate_epub', False)  # Optional full EPUB validation

    if not book_id:
        raise HTTPException(status_code=400, detail="book_id required")

    # Get book data
    book_repo = BookRepository(db)
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)
    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    try:
        # Generate EPUB if validation requested
        epub_buffer = None
        if validate_epub:
            exporter = EnhancedEPUBExporter()
            epub_buffer = exporter.export_book(book_data)

        # Check readiness
        checker = MarketplaceReadinessChecker()
        result = checker.check_readiness(book_data, epub_buffer)

        return {
            'success': True,
            **result
        }

    except Exception as e:
        print(f"[READINESS CHECK ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Readiness check failed: {str(e)}")


# ============================================================================
# USER PROFILE ENDPOINTS
# ============================================================================

@app.post("/api/users/update-email")
async def update_user_email_endpoint(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user's email address for marketing communications
    """
    email = request.get('email')

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Basic email validation
    import re
    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_regex, email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    # Update user email
    user.email = email
    db.commit()

    return {
        "success": True,
        "message": "Email updated successfully"
    }


@app.post("/api/users/update-preferred-model")
async def update_preferred_model_endpoint(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user's preferred AI model
    """
    model_provider = request.get('model_provider')

    if not model_provider:
        raise HTTPException(status_code=400, detail="Model provider is required")

    # Validate model provider
    if model_provider not in ['claude', 'openai']:
        raise HTTPException(status_code=400, detail="Invalid model provider. Use 'claude' or 'openai'")

    # Update user preferred model
    user.preferred_model = model_provider
    db.commit()

    return {
        "success": True,
        "preferred_model": model_provider,
        "message": f"Preferred model updated to {model_provider}"
    }
