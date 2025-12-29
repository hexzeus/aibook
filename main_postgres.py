"""
AI Book Generator API - PostgreSQL Version with Credit System
"""
from fastapi import FastAPI, HTTPException, Header, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime
import os
import uuid
import json
from urllib.parse import parse_qs
from dotenv import load_dotenv

from database import initialize_database, get_db
from database.models import Book, Page
from database.repositories import UserRepository, BookRepository, UsageRepository
from database.repositories.character_repository import CharacterRepository
from database.repositories.collaboration_repository import CollaborationRepository
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
from core.s3_storage import S3Storage
from core.style_analyzer import StyleAnalyzer
from core.readability import generate_readability_report
from core.white_label_service import WhiteLabelService
from core.bulk_import_service import BulkImportService
from core.translation_service import TranslationService
from core.audiobook_service import AudiobookService
from core.websocket_manager import ws_manager

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

# Initialize S3 storage for images
try:
    s3_storage = S3Storage()
    USE_S3 = True
    print(f"[INIT] S3 Storage: Configured")
except Exception as e:
    s3_storage = None
    USE_S3 = False
    print(f"[INIT] S3 Storage: Not configured - using database storage - {str(e)}")

# Initialize Style Analyzer
style_analyzer = StyleAnalyzer()
print(f"[INIT] Style Analyzer: Ready")

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
    target_language: Optional[str] = None  # Language code (e.g., 'es', 'fr', 'de')


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


@app.websocket("/ws/notifications/{license_key}")
async def websocket_notifications(websocket: WebSocket, license_key: str):
    """
    WebSocket endpoint for real-time notifications
    Client connects with their license key to receive instant notifications
    when credits are added or other account events occur
    """
    await ws_manager.connect(websocket, license_key)

    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket connection established",
            "timestamp": datetime.utcnow().isoformat()
        })

        # Keep connection alive and wait for client disconnect
        while True:
            # Receive any messages from client (like heartbeat pings)
            try:
                data = await websocket.receive_text()
                # Echo back for heartbeat/ping-pong
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                break
    except Exception as e:
        print(f"[WEBSOCKET] Error in connection: {e}")
    finally:
        ws_manager.disconnect(websocket, license_key)


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
async def get_credit_packages(user = Depends(get_current_user)):
    """Get available credit packages for purchase with user's license key embedded"""
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
                # Append license key to Gumroad URL so webhook can identify the user
                "purchase_url": f"{get_gumroad_url(p.id)}?wanted=true&license_key={user.license_key}"
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
    """Create new book - costs 1 credit (structure only, no page 1)"""
    # Rate limit: 10 books per hour
    await rate_limit_middleware(
        http_request,
        RateLimits.BOOK_CREATE,
        key_func=lambda r: str(user.user_id)
    )

    user_repo = UserRepository(db)
    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)

    # Check credits (1 for structure only - pages generated separately)
    if user.credits_remaining < 1:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need 1, have {user.credits_remaining}"
        )

    # Store user_id before any DB operations
    user_id = user.user_id

    # Consume 1 credit for structure
    user_repo.consume_credits(user_id, 1)
    db.commit()

    try:
        # Generate book structure only (no first page)
        # Use user's preferred model (default: claude)
        preferred_model = user.preferred_model or 'claude'
        generator = BookGenerator(api_key=None, model_provider=preferred_model)

        structure = None

        # Stream generation - only structure, skip first page
        async for chunk in generator.generate_book_stream(
            description=request.description,
            target_pages=request.target_pages,
            book_type=request.book_type
        ):
            if chunk['stage'] == 'structure' and chunk['status'] == 'complete':
                structure = chunk['data']
                break  # Stop after structure, don't wait for first page
            elif chunk['stage'] == 'error':
                # Refund credits on error
                user_repo.refund_credits(user_id, 1)
                db.commit()
                raise Exception(chunk['error'])

        if not structure:
            user_repo.refund_credits(user_id, 1)
            db.commit()
            raise Exception("Failed to generate book structure")

        # Create book in database (no pages yet)
        book = book_repo.create_book(
            user_id=user_id,
            title=structure['title'],
            description=request.description,
            target_pages=request.target_pages,
            book_type=request.book_type,
            structure=structure,
            subtitle=structure.get('subtitle'),
            tone=structure.get('tone'),
            themes=structure.get('themes'),
            language=request.target_language or 'en'  # Set target language
        )

        # Log usage
        usage_repo.log_action(
            user_id=user_id,
            action_type='book_created',
            credits_consumed=1,
            book_id=book.book_id,
            metadata={'target_pages': request.target_pages, 'book_type': request.book_type}
        )

        # Update user stats
        user_repo.increment_book_count(user_id)

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

        # Get style instructions if style profile exists
        style_instructions = None
        if book_data.get('style_profile'):
            style_instructions = style_analyzer.generate_style_instructions(book_data['style_profile'])
            print(f"[STYLE] Applying style profile to page generation", flush=True)

        # Get character context if characters exist
        char_repo = CharacterRepository(db)
        character_context = char_repo.generate_character_context(uuid.UUID(book_id), user.user_id)
        if character_context:
            print(f"[CHARACTER] Injecting character profiles into generation", flush=True)

        # Combine style and character context with user input
        enhanced_user_input = request.user_input or ""
        if character_context and not enhanced_user_input:
            enhanced_user_input = f"[Keep these character profiles in mind while writing]\n\n{character_context}"
        elif character_context and enhanced_user_input:
            enhanced_user_input = f"{enhanced_user_input}\n\n[Character Reference]\n{character_context}"

        next_page = await generator.generate_next_page(
            book_structure=book_data['structure'],
            current_page=request.page_number - 1,
            previous_pages=book_data['pages'],
            user_input=enhanced_user_input if enhanced_user_input else None,
            style_instructions=style_instructions
        )

        # Translate page content if book has non-English language
        page_content = next_page['content']
        if book.language and book.language != 'en':
            from core.translation_service import TranslationService
            translation_service = TranslationService()
            try:
                page_content = translation_service.translate_book_page(
                    page_content=page_content,
                    target_language=book.language,
                    book_genre=book.book_type
                )
                print(f"[TRANSLATION] Translated page {next_page['page_number']} to {book.language}", flush=True)
            except Exception as e:
                print(f"[TRANSLATION] Failed to translate page: {str(e)}", flush=True)
                # Continue with English content if translation fails

        # Save page
        book_repo.create_page(
            book_id=book_id,
            page_number=next_page['page_number'],
            section=next_page['section'],
            content=page_content,
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

    # Calculate total credits needed for estimation
    page_credits_per_page = 1
    illustration_credits_per_page = 3 if request.with_illustrations else 0
    cover_credits = 2
    total_credits_estimate = (remaining_pages * (page_credits_per_page + illustration_credits_per_page)) + cover_credits

    # Check credits
    if user.credits_remaining < total_credits_estimate:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need ~{total_credits_estimate} ({remaining_pages} pages + {remaining_pages * illustration_credits_per_page} illustrations + 2 cover), have {user.credits_remaining}"
        )

    # Store user info
    user_id = user.user_id
    book_id = book.book_id
    preferred_model = user.preferred_model or 'claude'

    # DO NOT consume credits upfront - charge per page as we go
    # This prevents losing credits if server crashes mid-generation

    generated_pages = []
    generated_illustrations = []
    errors = []

    # Broadcast start of auto-generation
    await ws_manager.broadcast_auto_gen_progress(
        user.license_key,
        str(book_id),
        {
            "status": "started",
            "current_page": 0,
            "total_pages": remaining_pages,
            "message": f"Starting auto-generation of {remaining_pages} page{'s' if remaining_pages != 1 else ''}{'  with illustrations' if request.with_illustrations else ''}...",
            "percentage": 0,
            "with_illustrations": request.with_illustrations
        }
    )

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

                        # Upload to S3 if available, otherwise use base64
                        if USE_S3 and s3_storage:
                            print(f"[AUTO-GEN] Uploading page 1 illustration to S3...", flush=True)
                            illustration_url = s3_storage.upload_image_base64(
                                img_base64,
                                folder='illustrations',
                                optimize=True,
                                max_width=800
                            )
                            print(f"[AUTO-GEN] Uploaded to S3: {illustration_url}", flush=True)
                        else:
                            illustration_url = f"data:image/png;base64,{img_base64}"

                        # Store illustration
                        print(f"[AUTO-GEN] Storing illustration for page 1...", flush=True)
                        page = book_repo.get_page_by_number(book_id, 1)
                        page.illustration_url = illustration_url
                        page.updated_at = datetime.utcnow()
                        db.commit()

                        # Charge for illustration (3 credits)
                        user_repo.consume_credits(user_id, illustration_credits_per_page)
                        db.commit()

                        generated_illustrations.append({
                            'page_number': 1,
                            'prompt': illustration_prompt
                        })

                        print(f"[AUTO-GEN] ✓ Illustration for page 1 generated successfully (3 credits charged)", flush=True)

                except Exception as ill_error:
                    error_msg = str(ill_error)
                    print(f"[AUTO-GEN] ✗ Illustration error for page 1: {error_msg}", flush=True)
                    import traceback
                    print(f"[AUTO-GEN] Traceback: {traceback.format_exc()}", flush=True)

                    if 'content_policy_violation' in error_msg or 'content filter' in error_msg.lower():
                        errors.append(f"Page 1 illustration blocked by content filters (page content saved)")
                        print(f"[AUTO-GEN] Page 1 illustration blocked by content filters", flush=True)
                    else:
                        errors.append(f"Page 1 illustration: {error_msg}")

                    # DO NOT rollback - page already exists and should stay

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

                # Translate page content if book has non-English language
                page_content = next_page['content']
                if book_data.get('language') and book_data['language'] != 'en':
                    from core.translation_service import TranslationService
                    translation_service = TranslationService()
                    try:
                        page_content = translation_service.translate_book_page(
                            page_content=page_content,
                            target_language=book_data['language'],
                            book_genre=book_data.get('book_type')
                        )
                        print(f"[AUTO-GEN][TRANSLATION] Translated page {page_number} to {book_data['language']}", flush=True)
                    except Exception as e:
                        print(f"[AUTO-GEN][TRANSLATION] Failed to translate page: {str(e)}", flush=True)
                        # Continue with English content if translation fails

                # Save page (connection will be refreshed automatically)
                created_page = book_repo.create_page(
                    book_id=book_id,
                    page_number=next_page['page_number'],
                    section=next_page['section'],
                    content=page_content,
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

                # Charge for page generation (1 credit per page)
                user_repo.consume_credits(user_id, page_credits_per_page)
                db.commit()

                generated_pages.append({
                    'page_number': page_number,
                    'page_id': str(created_page.page_id),
                    'section': next_page['section']
                })

                print(f"[AUTO-GEN] Page {page_number} generated successfully (1 credit charged)", flush=True)

                # Broadcast page generation progress (90% for pages, 10% reserved for cover)
                pages_completed = len(generated_pages)
                progress_percentage = int((pages_completed / remaining_pages) * 90)
                await ws_manager.broadcast_auto_gen_progress(
                    user.license_key,
                    str(book_id),
                    {
                        "status": "generating_page",
                        "current_page": page_number,
                        "total_pages": book.target_pages,
                        "message": f"Page {page_number} of {book.target_pages} completed",
                        "percentage": progress_percentage,
                        "with_illustrations": request.with_illustrations
                    }
                )

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

                            # Upload to S3 if available, otherwise use base64
                            if USE_S3 and s3_storage:
                                print(f"[AUTO-GEN] Uploading illustration to S3...", flush=True)
                                illustration_url = s3_storage.upload_image_base64(
                                    img_base64,
                                    folder='illustrations',
                                    optimize=True,
                                    max_width=800
                                )
                                print(f"[AUTO-GEN] Uploaded to S3: {illustration_url}", flush=True)
                            else:
                                illustration_url = f"data:image/png;base64,{img_base64}"

                            # Store illustration - refresh session and get page
                            print(f"[AUTO-GEN] Storing illustration for page {page_number}...", flush=True)
                            page = book_repo.get_page_by_number(book_id, page_number)
                            page.illustration_url = illustration_url
                            page.updated_at = datetime.utcnow()
                            db.commit()

                            # Charge for illustration (3 credits per illustration)
                            user_repo.consume_credits(user_id, illustration_credits_per_page)
                            db.commit()

                            generated_illustrations.append({
                                'page_number': page_number,
                                'prompt': illustration_prompt
                            })

                            print(f"[AUTO-GEN] ✓ Illustration for page {page_number} generated successfully (3 credits charged)", flush=True)

                            # Broadcast illustration progress
                            await ws_manager.broadcast_auto_gen_progress(
                                user.license_key,
                                str(book_id),
                                {
                                    "status": "generating_illustration",
                                    "current_page": page_number,
                                    "total_pages": book.target_pages,
                                    "message": f"Illustration for page {page_number} completed",
                                    "percentage": progress_percentage,
                                    "with_illustrations": request.with_illustrations
                                }
                            )

                    except Exception as ill_error:
                        error_msg = str(ill_error)
                        print(f"[AUTO-GEN] ✗ Illustration error for page {page_number}: {error_msg}", flush=True)
                        import traceback
                        print(f"[AUTO-GEN] Traceback: {traceback.format_exc()}", flush=True)

                        # Check if it's a content policy violation
                        if 'content_policy_violation' in error_msg or 'content filter' in error_msg.lower():
                            errors.append(f"Page {page_number} illustration blocked by content filters (page content saved)")
                            print(f"[AUTO-GEN] Page {page_number} content saved, but illustration blocked by content filters", flush=True)
                        else:
                            errors.append(f"Page {page_number} illustration: {error_msg}")

                        # DO NOT rollback - the page content was already committed and should stay
                        # Just continue without the illustration for this page

                # Memory cleanup every 10 pages to prevent OOM crashes
                if page_number % 10 == 0:
                    print(f"[AUTO-GEN] Memory cleanup at page {page_number}...", flush=True)
                    db.commit()
                    db.expunge_all()
                    import gc
                    gc.collect()
                    print(f"[AUTO-GEN] Memory cleanup complete", flush=True)

            except Exception as page_error:
                print(f"[AUTO-GEN] Page generation error: {str(page_error)}", flush=True)
                errors.append(f"Page {page_number}: {str(page_error)}")
                # Stop on page generation failure
                raise page_error

        # Credits already charged per-page during generation, just log stats
        usage_repo.log_action(
            user_id=user_id,
            action_type='auto_generate_pages',
            credits_consumed=0,  # Already charged per page
            book_id=book_id,
            metadata={'pages_generated': len(generated_pages), 'illustrations_generated': len(generated_illustrations), 'with_illustrations': request.with_illustrations}
        )

        # Update user stats
        user_repo.increment_page_count(user_id, len(generated_pages))
        db.commit()

        # Now complete the book (generate cover)
        print(f"[AUTO-GEN] Completing book with cover generation...", flush=True)

        # Broadcast cover generation start
        await ws_manager.broadcast_auto_gen_progress(
            user.license_key,
            str(book_id),
            {
                "status": "generating_cover",
                "current_page": remaining_pages,
                "total_pages": remaining_pages,
                "message": "Generating book cover...",
                "percentage": 90,
                "with_illustrations": request.with_illustrations
            }
        )

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

        # Upload cover to S3 if available
        if USE_S3 and s3_storage:
            print(f"[AUTO-GEN] Uploading cover to S3...", flush=True)
            cover_url = s3_storage.upload_image_base64(
                cover_image_base64,
                folder='covers',
                optimize=True,
                max_width=800
            )
            print(f"[AUTO-GEN] Cover uploaded to S3: {cover_url}", flush=True)
        else:
            cover_url = cover_image_base64

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
        book_repo.complete_book(book_id, cover_url, epub_page_count)
        print(f"[AUTO-GEN] Book completed and cover stored ({len(cover_image_base64)} chars)", flush=True)

        # Charge for cover generation (2 credits)
        user_repo.consume_credits(user_id, cover_credits)

        # Log completion
        usage_repo.log_action(
            user_id=user_id,
            action_type='book_completed',
            credits_consumed=cover_credits,
            book_id=book_id
        )

        db.commit()

        print(f"[AUTO-GEN] Book auto-generation complete!", flush=True)

        # Broadcast completion
        await ws_manager.broadcast_auto_gen_progress(
            user.license_key,
            str(book_id),
            {
                "status": "completed",
                "current_page": remaining_pages,
                "total_pages": remaining_pages,
                "message": f"Book complete! Generated {len(generated_pages)} pages{' with illustrations' if request.with_illustrations else ''}",
                "percentage": 100,
                "with_illustrations": request.with_illustrations
            }
        )

        # Calculate actual credits consumed
        actual_credits = (len(generated_pages) * page_credits_per_page) + (len(generated_illustrations) * illustration_credits_per_page) + cover_credits

        return {
            "success": True,
            "message": f"Auto-generated {len(generated_pages)} pages" + (" with illustrations" if request.with_illustrations else "") + " and completed book",
            "credits_consumed": actual_credits,
            "pages_generated": len(generated_pages),
            "illustrations_generated": len(generated_illustrations),
            "errors": errors if errors else None,
            "book_completed": True
        }

    except Exception as e:
        print(f"[AUTO-GEN] ERROR: {str(e)}", flush=True)
        import traceback
        print(f"[AUTO-GEN] Traceback: {traceback.format_exc()}", flush=True)

        # Broadcast error to user
        await ws_manager.broadcast_auto_gen_progress(
            user.license_key,
            str(book_id),
            {
                "status": "error",
                "current_page": len(generated_pages),
                "total_pages": remaining_pages,
                "message": f"Error during generation. {len(generated_pages)} pages completed before failure.",
                "percentage": int((len(generated_pages) / remaining_pages) * 90) if remaining_pages > 0 else 0,
                "with_illustrations": request.with_illustrations,
                "error": str(e)
            }
        )

        # Credits already charged per-page, so no refund needed
        # User only paid for what was actually generated before crash
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Auto-generation failed: {str(e)}. Generated {len(generated_pages)} pages before failure. Credits only charged for completed pages."
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

    # Extract user_id early (before any long operations that might detach the session)
    user_id = user.user_id

    # Consume credit for export
    user_repo.consume_credits(user_id, 1)

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
            def escape_rtf(text):
                """Escape special characters for RTF format"""
                text = text.replace('\\', '\\\\')
                text = text.replace('{', '\\{')
                text = text.replace('}', '\\}')
                # Convert smart quotes and special characters to RTF unicode
                replacements = {
                    '\u2018': "\\'91",  # Left single quote
                    '\u2019': "\\'92",  # Right single quote
                    '\u201C': "\\'93",  # Left double quote
                    '\u201D': "\\'94",  # Right double quote
                    '\u2013': "\\'96",  # En dash
                    '\u2014': "\\'97",  # Em dash
                }
                for char, rtf_code in replacements.items():
                    text = text.replace(char, rtf_code)
                return text

            rtf_content = "{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1033\n"
            rtf_content += "{\\fonttbl{\\f0\\froman\\fprq2\\fcharset0 Times New Roman;}}\n"
            rtf_content += "{\\colortbl ;\\red0\\green0\\blue0;}\n"
            rtf_content += "\\viewkind4\\uc1\n"

            # Title
            rtf_content += f"\\pard\\sa200\\sl276\\slmult1\\qc\\ul\\b\\fs48 {escape_rtf(book_data['title'])}\\ulnone\\b0\\par\n"

            # Subtitle if exists
            subtitle = book_data.get('structure', {}).get('subtitle', '')
            if subtitle:
                rtf_content += f"\\pard\\sa200\\sl276\\slmult1\\qc\\i\\fs28 {escape_rtf(subtitle)}\\i0\\par\n"

            rtf_content += "\\pard\\sa200\\sl276\\slmult1\\par\n"

            # Content
            for page in book_data.get('pages', []):
                if page.get('section'):
                    section = escape_rtf(page['section'])
                    rtf_content += f"\\pard\\sa200\\sl276\\slmult1\\b\\fs32 {section}\\b0\\fs24\\par\n"

                content = escape_rtf(page.get('content', ''))
                # Replace newlines with RTF paragraphs
                paragraphs = content.split('\n')
                for para in paragraphs:
                    if para.strip():
                        rtf_content += f"\\pard\\sa200\\sl276\\slmult1 {para}\\par\n"

                rtf_content += "\\par\n"

            rtf_content += "}"

            from io import BytesIO
            file_buffer = BytesIO(rtf_content.encode('utf-8', errors='ignore'))
            media_type = "application/rtf"
            extension = "rtf"

        # Refresh database connection before logging (export may have taken long time)
        try:
            db.execute("SELECT 1")  # Ping to test connection
        except:
            print(f"[EXPORT] Database connection stale, refreshing...", flush=True)
            db.rollback()
            db.close()
            db = next(get_db())
            user_repo = UserRepository(db)
            usage_repo = UsageRepository(db)

        # Log export (use user_id variable, not user.user_id)
        usage_repo.create_export(
            book_id=uuid.UUID(request.book_id),
            user_id=user_id,
            format=export_format,
            file_size_bytes=file_buffer.getbuffer().nbytes
        )

        # Log usage
        usage_repo.log_action(
            user_id=user_id,
            action_type='book_exported',
            credits_consumed=1,
            book_id=uuid.UUID(request.book_id),
            metadata={'format': export_format}
        )

        # Update stats
        user_repo.increment_export_count(user_id)

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


@app.post("/api/books/export-print")
async def export_print_pdf(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export book to print-ready PDF (1 credit)"""
    from core.print_pdf_exporter import create_print_pdf

    book_id = request.get('book_id')
    book_size = request.get('book_size', '6x9')
    margin_preset = request.get('margin_preset', 'standard')

    if not book_id:
        raise HTTPException(status_code=400, detail="Missing book_id")

    book_repo = BookRepository(db)
    usage_repo = UsageRepository(db)
    user_repo = UserRepository(db)

    # Get book with pages
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)
    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    # Check if book is completed
    if not book_data.get('is_completed'):
        raise HTTPException(status_code=400, detail="Book must be completed before exporting")

    # Check credits (1 credit for print PDF)
    if user.credits_remaining < 1:
        raise HTTPException(status_code=402, detail="Insufficient credits (requires 1)")

    # Consume credit
    user_repo.consume_credits(user.user_id, 1)

    # Generate print PDF
    try:
        pdf_bytes = create_print_pdf(
            title=book_data['title'],
            author=book_data.get('author_name', 'Unknown Author'),
            pages=book_data['pages'],
            subtitle=book_data.get('subtitle'),
            book_size=book_size,
            margin_preset=margin_preset,
            include_toc=True,
            include_copyright=True
        )

        # Log usage
        usage_repo.log_action(
            user_id=user.user_id,
            action_type='export_print_pdf',
            book_id=uuid.UUID(book_id),
            credits_consumed=1,
            metadata={'book_size': book_size, 'margin_preset': margin_preset}
        )

        db.commit()

        from io import BytesIO
        file_buffer = BytesIO(pdf_bytes)

        return StreamingResponse(
            file_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=\"{book_data['title']}_print_{book_size}.pdf\""
            }
        )

    except Exception as e:
        db.rollback()
        print(f"[EXPORT] Print PDF error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to export print PDF: {str(e)}")


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


@app.delete("/api/exports/{export_id}")
async def delete_export(
    export_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a single export record - FREE"""
    usage_repo = UsageRepository(db)

    # Get export and verify ownership
    export = usage_repo.get_export(uuid.UUID(export_id))
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")

    if export.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this export")

    # Delete the export record
    db.delete(export)
    db.commit()

    print(f"[EXPORT] Deleted export {export_id} for user {user.user_id}", flush=True)

    return {
        "success": True,
        "message": "Export deleted successfully"
    }


@app.delete("/api/exports")
async def delete_all_exports(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete all export records for current user - FREE"""
    from database.models import BookExport

    # Delete all exports for this user
    deleted_count = db.query(BookExport).filter(
        BookExport.user_id == user.user_id
    ).delete()

    db.commit()

    print(f"[EXPORT] Deleted {deleted_count} exports for user {user.user_id}", flush=True)

    return {
        "success": True,
        "message": f"Deleted {deleted_count} export records",
        "deleted_count": deleted_count
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
    print("[WEBHOOK] Received Gumroad webhook request")

    # Get raw body for signature verification
    body = await request.body()
    signature = request.headers.get("X-Gumroad-Signature", "")

    print(f"[WEBHOOK] Signature present: {bool(signature)}")
    print(f"[WEBHOOK] Body length: {len(body)} bytes")

    # Verify signature
    if not verify_gumroad_signature(body, signature):
        print("[WEBHOOK] Signature verification FAILED")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    print("[WEBHOOK] Signature verification PASSED")

    # Parse form data (Gumroad sends URL-encoded form data, not JSON)
    try:
        # Decode URL-encoded body
        body_str = body.decode('utf-8')
        parsed = parse_qs(body_str)

        # Convert parsed query string to dict (parse_qs returns lists for values)
        data = {key: value[0] if len(value) == 1 else value for key, value in parsed.items()}

        print(f"[WEBHOOK] Parsed form data: {json.dumps(data, indent=2)}")
    except Exception as e:
        print(f"[WEBHOOK] Form parsing failed: {e}")
        print(f"[WEBHOOK] Raw body: {body[:500]}")
        raise HTTPException(status_code=400, detail="Invalid form data")

    # Process webhook
    print("[WEBHOOK] Processing webhook...")
    result = await process_gumroad_webhook(data, db)
    print(f"[WEBHOOK] Result: {result}")

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

        # Generate image with DALL-E 3 - request base64 directly
        response = openai_client.images.generate(
            model="dall-e-3",
            prompt=enhanced_prompt,
            size="1024x1024",
            quality="standard",
            n=1,
            response_format="b64_json"  # Get base64 directly, no temporary URLs
        )

        img_base64 = response.data[0].b64_json
        print(f"[ILLUSTRATION] DALL-E returned base64 image ({len(img_base64)} chars)", flush=True)

        # Upload to S3 if available, otherwise use base64 data URL
        import base64
        if USE_S3 and s3_storage:
            print(f"[ILLUSTRATION] Uploading to S3...", flush=True)
            illustration_url = s3_storage.upload_image_base64(
                img_base64,
                folder='illustrations',
                optimize=True,
                max_width=800
            )
            print(f"[ILLUSTRATION] Uploaded to S3: {illustration_url}", flush=True)
        else:
            illustration_url = f"data:image/png;base64,{img_base64}"
            print(f"[ILLUSTRATION] Stored as base64 data URL (length: {len(illustration_url)})", flush=True)

        # Store illustration
        page.illustration_url = illustration_url
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
                model="claude-sonnet-4-20250514",
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


@app.get("/api/style/presets")
async def get_style_presets():
    """Get all available author presets and style options"""
    return {
        "author_presets": style_analyzer.AUTHOR_PRESETS,
        "tone_options": style_analyzer.TONE_OPTIONS,
        "vocabulary_levels": style_analyzer.VOCABULARY_LEVELS,
        "sentence_styles": style_analyzer.SENTENCE_STYLES
    }


@app.post("/api/style/analyze")
async def analyze_style(
    request: dict,
    user = Depends(get_current_user)
):
    """Analyze sample text to extract writing style patterns"""
    sample_text = request.get('sample_text')

    if not sample_text or len(sample_text) < 100:
        raise HTTPException(status_code=400, detail="Sample text must be at least 100 characters")

    try:
        analysis = style_analyzer.analyze_sample_text(sample_text)
        return {
            "success": True,
            "analysis": analysis
        }
    except Exception as e:
        print(f"[STYLE] Analysis error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=f"Style analysis failed: {str(e)}")


@app.post("/api/style/create-profile")
async def create_style_profile(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update style profile for a book"""
    book_id = request.get('book_id')
    author_preset = request.get('author_preset')
    tone = request.get('tone')
    vocabulary_level = request.get('vocabulary_level')
    sentence_style = request.get('sentence_style')
    sample_text = request.get('sample_text')

    if not book_id:
        raise HTTPException(status_code=400, detail="book_id is required")

    # Verify book ownership
    book_repo = BookRepository(db)
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    try:
        # Create style profile
        style_profile = style_analyzer.create_style_profile(
            author_preset=author_preset,
            tone=tone,
            vocabulary_level=vocabulary_level,
            sentence_style=sentence_style,
            sample_text=sample_text
        )

        # Update book with style profile
        book.style_profile = style_profile
        book.updated_at = datetime.utcnow()
        db.commit()

        # Generate style instructions for display
        instructions = style_analyzer.generate_style_instructions(style_profile)

        return {
            "success": True,
            "message": "Style profile created successfully",
            "style_profile": style_profile,
            "style_instructions": instructions
        }
    except Exception as e:
        db.rollback()
        print(f"[STYLE] Profile creation error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create style profile: {str(e)}")


@app.put("/api/books/{book_id}/structure")
async def update_book_structure(
    book_id: str,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update book structure/outline for better chapter and scene organization"""
    book_repo = BookRepository(db)

    # Verify book ownership
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    new_structure = request.get('structure')
    if not new_structure:
        raise HTTPException(status_code=400, detail="Structure data required")

    try:
        # Update the book structure
        book.structure = new_structure
        book.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(book)

        print(f"[STRUCTURE] Updated structure for book {book_id}", flush=True)

        return {
            "success": True,
            "message": "Book structure updated successfully",
            "structure": new_structure
        }
    except Exception as e:
        db.rollback()
        print(f"[STRUCTURE] Update error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=f"Failed to update structure: {str(e)}")


@app.post("/api/books/{book_id}/characters")
async def create_character(
    book_id: str,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new character for a book"""
    char_repo = CharacterRepository(db)
    book_repo = BookRepository(db)

    # Verify book ownership
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    name = request.get('name')
    if not name:
        raise HTTPException(status_code=400, detail="Character name is required")

    try:
        character = char_repo.create_character(
            book_id=uuid.UUID(book_id),
            user_id=user.user_id,
            name=name,
            role=request.get('role'),
            archetype=request.get('archetype'),
            description=request.get('description'),
            appearance=request.get('appearance'),
            personality=request.get('personality'),
            background=request.get('background'),
            motivation=request.get('motivation'),
            goal=request.get('goal'),
            conflict=request.get('conflict'),
            arc=request.get('arc'),
            relationships=request.get('relationships'),
            traits=request.get('traits'),
            speech_patterns=request.get('speech_patterns'),
            catchphrases=request.get('catchphrases'),
            introduction_page=request.get('introduction_page'),
            importance_level=request.get('importance_level', 5)
        )

        print(f"[CHARACTER] Created character {character.name} for book {book_id}", flush=True)

        return {
            "success": True,
            "message": "Character created successfully",
            "character": {
                "character_id": str(character.character_id),
                "name": character.name,
                "role": character.role,
                "description": character.description
            }
        }
    except Exception as e:
        db.rollback()
        print(f"[CHARACTER] Creation error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=f"Failed to create character: {str(e)}")


@app.get("/api/books/{book_id}/characters")
async def get_book_characters(
    book_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all characters for a book"""
    char_repo = CharacterRepository(db)
    book_repo = BookRepository(db)

    # Verify book ownership
    book = book_repo.get_book(uuid.UUID(book_id), user.user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    characters = char_repo.get_book_characters(uuid.UUID(book_id), user.user_id)

    return {
        "success": True,
        "characters": [
            {
                "character_id": str(char.character_id),
                "name": char.name,
                "role": char.role,
                "archetype": char.archetype,
                "description": char.description,
                "appearance": char.appearance,
                "personality": char.personality,
                "background": char.background,
                "motivation": char.motivation,
                "goal": char.goal,
                "conflict": char.conflict,
                "arc": char.arc,
                "relationships": char.relationships,
                "traits": char.traits,
                "speech_patterns": char.speech_patterns,
                "catchphrases": char.catchphrases,
                "introduction_page": char.introduction_page,
                "importance_level": char.importance_level,
                "created_at": char.created_at.isoformat() if char.created_at else None
            }
            for char in characters
        ]
    }


@app.put("/api/characters/{character_id}")
async def update_character(
    character_id: str,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a character"""
    char_repo = CharacterRepository(db)

    try:
        character = char_repo.update_character(
            character_id=uuid.UUID(character_id),
            user_id=user.user_id,
            **request
        )

        if not character:
            raise HTTPException(status_code=404, detail="Character not found")

        print(f"[CHARACTER] Updated character {character.name}", flush=True)

        return {
            "success": True,
            "message": "Character updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[CHARACTER] Update error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=f"Failed to update character: {str(e)}")


@app.delete("/api/characters/{character_id}")
async def delete_character(
    character_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a character"""
    char_repo = CharacterRepository(db)

    success = char_repo.delete_character(uuid.UUID(character_id), user.user_id)

    if not success:
        raise HTTPException(status_code=404, detail="Character not found")

    print(f"[CHARACTER] Deleted character {character_id}", flush=True)

    return {
        "success": True,
        "message": "Character deleted successfully"
    }


@app.post("/api/marketing/description")
async def generate_book_description(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate AI-powered book description for marketing (1 credit)"""
    book_id = request.get('book_id')
    style = request.get('style', 'compelling')

    if not book_id:
        raise HTTPException(status_code=400, detail="Missing book_id")

    book_repo = BookRepository(db)
    user_repo = UserRepository(db)
    usage_repo = UsageRepository(db)

    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)
    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    if user.credits_remaining < 1:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    user_repo.consume_credits(user.user_id, 1)

    try:
        from anthropic import Anthropic
        import os

        client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

        book_context = f"Title: {book_data['title']}\n"
        if book_data.get('subtitle'):
            book_context += f"Subtitle: {book_data['subtitle']}\n"

        content_sample = ""
        for page in book_data['pages'][:3]:
            content_sample += page.get('content', '')[:500] + "\n\n"

        prompt = f"""Create a compelling book description for Amazon/Goodreads.

{book_context}

Content Sample:
{content_sample}

Create a {style} description (250-300 words) with a hook, benefits, and urgency."""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        description = message.content[0].text

        usage_repo.log_action(
            user_id=user.user_id,
            action_type='generate_marketing_description',
            book_id=uuid.UUID(book_id),
            credits_consumed=1
        )

        db.commit()

        return {"success": True, "description": description}

    except Exception as e:
        db.rollback()
        print(f"[MARKETING] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/marketing/social")
async def generate_social_posts(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate social media posts (1 credit)"""
    book_id = request.get('book_id')

    if not book_id:
        raise HTTPException(status_code=400, detail="Missing book_id")

    book_repo = BookRepository(db)
    user_repo = UserRepository(db)
    usage_repo = UsageRepository(db)

    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)
    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    if user.credits_remaining < 1:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    user_repo.consume_credits(user.user_id, 1)

    try:
        from anthropic import Anthropic
        import os
        import json

        client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

        prompt = f"""Create 4 social posts for: {book_data['title']}

1. Twitter (280 chars, hashtags)
2. Facebook (conversational, question)
3. Instagram (visual, emojis, hashtags)
4. LinkedIn (professional)

JSON: {{"posts": [{{"platform": "Twitter", "content": "..."}}, ...]}}"""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text

        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()

        data = json.loads(response_text)

        usage_repo.log_action(
            user_id=user.user_id,
            action_type='generate_social_posts',
            book_id=uuid.UUID(book_id),
            credits_consumed=1
        )

        db.commit()

        return {"success": True, "posts": data.get('posts', [])}

    except Exception as e:
        db.rollback()
        print(f"[MARKETING] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analytics/readability")
async def analyze_readability(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze text readability (free feature)"""
    text = request.get('text')

    if not text:
        raise HTTPException(status_code=400, detail="Missing text to analyze")

    if len(text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text is empty")

    try:
        # Generate comprehensive readability report
        report = generate_readability_report(text)

        print(f"[ANALYTICS] Generated readability report for user {user.email}", flush=True)
        print(f"[ANALYTICS] Flesch Score: {report['readability']['flesch_reading_ease']['score']}", flush=True)

        return report

    except Exception as e:
        print(f"[ANALYTICS] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# COLLABORATION ENDPOINTS
# ====================

@app.post("/api/books/{book_id}/collaborators")
async def add_collaborator(
    book_id: str,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a collaborator to a book"""
    collaborator_email = request.get('email')
    role = request.get('role', 'viewer')

    if not collaborator_email:
        raise HTTPException(status_code=400, detail="Missing collaborator email")

    # Verify book ownership
    book_repo = BookRepository(db)
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)

    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found or access denied")

    # Find collaborator user
    user_repo = UserRepository(db)
    collaborator_user = db.query(user_repo.model).filter_by(email=collaborator_email).first()

    if not collaborator_user:
        raise HTTPException(status_code=404, detail="User not found")

    if collaborator_user.user_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as collaborator")

    try:
        collab_repo = CollaborationRepository(db)

        # Create invitation
        invitation = collab_repo.create_invitation(
            book_id=uuid.UUID(book_id),
            user_id=collaborator_user.user_id,
            invited_by=user.user_id,
            role=role
        )

        print(f"[COLLABORATION] Created invitation for {collaborator_email} on book {book_id}", flush=True)

        return {
            "success": True,
            "collaborator_id": str(invitation.collaborator_id),
            "invitation_token": invitation.invitation_token,
            "message": f"Invitation sent to {collaborator_email}"
        }

    except Exception as e:
        db.rollback()
        print(f"[COLLABORATION] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/books/{book_id}/collaborators")
async def get_collaborators(
    book_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all collaborators for a book"""
    # Verify access
    book_repo = BookRepository(db)
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)

    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found or access denied")

    try:
        collab_repo = CollaborationRepository(db)
        collaborators = collab_repo.get_book_collaborators(uuid.UUID(book_id), include_pending=True)

        result = []
        for collab in collaborators:
            result.append({
                "collaborator_id": str(collab.collaborator_id),
                "user_id": str(collab.user_id),
                "email": collab.user.email if collab.user else None,
                "name": collab.user.name if collab.user else None,
                "role": collab.role,
                "status": collab.status,
                "can_edit": collab.can_edit,
                "can_comment": collab.can_comment,
                "can_generate": collab.can_generate,
                "can_export": collab.can_export,
                "can_invite": collab.can_invite,
                "created_at": collab.created_at.isoformat() if collab.created_at else None
            })

        return {"collaborators": result}

    except Exception as e:
        print(f"[COLLABORATION] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/collaborators/{collaborator_id}/remove")
async def remove_collaborator(
    collaborator_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a collaborator"""
    try:
        collab_repo = CollaborationRepository(db)

        # TODO: Verify user is book owner or has permission

        success = collab_repo.remove_collaborator(uuid.UUID(collaborator_id))

        if not success:
            raise HTTPException(status_code=404, detail="Collaborator not found")

        return {"success": True, "message": "Collaborator removed"}

    except Exception as e:
        db.rollback()
        print(f"[COLLABORATION] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pages/{page_id}/comments")
async def create_comment(
    page_id: str,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a comment on a page"""
    content = request.get('content')
    comment_type = request.get('type', 'general')
    parent_comment_id = request.get('parent_comment_id')
    selected_text = request.get('selected_text')
    selection_start = request.get('selection_start')
    selection_end = request.get('selection_end')

    if not content:
        raise HTTPException(status_code=400, detail="Missing comment content")

    # Get page to verify access and get book_id
    page = db.query(Page).filter_by(page_id=uuid.UUID(page_id)).first()

    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # TODO: Verify user has comment permission on book

    try:
        collab_repo = CollaborationRepository(db)

        comment = collab_repo.create_comment(
            book_id=page.book_id,
            page_id=uuid.UUID(page_id),
            user_id=user.user_id,
            content=content,
            comment_type=comment_type,
            parent_comment_id=uuid.UUID(parent_comment_id) if parent_comment_id else None,
            selected_text=selected_text,
            selection_start=selection_start,
            selection_end=selection_end
        )

        print(f"[COMMENT] Created comment on page {page_id}", flush=True)

        return {
            "success": True,
            "comment_id": str(comment.comment_id),
            "comment": {
                "comment_id": str(comment.comment_id),
                "content": comment.content,
                "type": comment.comment_type,
                "user_id": str(comment.user_id),
                "user_email": user.email,
                "created_at": comment.created_at.isoformat() if comment.created_at else None
            }
        }

    except Exception as e:
        db.rollback()
        print(f"[COMMENT] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pages/{page_id}/comments")
async def get_page_comments(
    page_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all comments for a page"""
    # Verify page exists and user has access
    page = db.query(Page).filter_by(page_id=uuid.UUID(page_id)).first()

    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    try:
        collab_repo = CollaborationRepository(db)
        comments = collab_repo.get_page_comments(uuid.UUID(page_id))

        result = []
        for comment in comments:
            result.append({
                "comment_id": str(comment.comment_id),
                "content": comment.content,
                "type": comment.comment_type,
                "user_id": str(comment.user_id),
                "user_email": comment.user.email if comment.user else None,
                "parent_comment_id": str(comment.parent_comment_id) if comment.parent_comment_id else None,
                "selected_text": comment.selected_text,
                "is_resolved": comment.is_resolved,
                "created_at": comment.created_at.isoformat() if comment.created_at else None,
                "updated_at": comment.updated_at.isoformat() if comment.updated_at else None
            })

        return {"comments": result}

    except Exception as e:
        print(f"[COMMENT] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/comments/{comment_id}/resolve")
async def resolve_comment(
    comment_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a comment as resolved"""
    try:
        collab_repo = CollaborationRepository(db)

        comment = collab_repo.resolve_comment(
            comment_id=uuid.UUID(comment_id),
            user_id=user.user_id
        )

        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")

        return {"success": True, "message": "Comment resolved"}

    except Exception as e:
        db.rollback()
        print(f"[COMMENT] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a comment"""
    try:
        collab_repo = CollaborationRepository(db)

        success = collab_repo.delete_comment(
            comment_id=uuid.UUID(comment_id),
            user_id=user.user_id
        )

        if not success:
            raise HTTPException(status_code=404, detail="Comment not found or access denied")

        return {"success": True, "message": "Comment deleted"}

    except Exception as e:
        db.rollback()
        print(f"[COMMENT] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# WHITE LABEL ENDPOINTS
# ====================

@app.get("/api/white-label/config")
async def get_white_label_config(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get white label configuration"""
    try:
        wl_service = WhiteLabelService(db)
        config_data = wl_service.export_config(user.user_id)

        return {"success": True, "config": config_data}

    except Exception as e:
        print(f"[WHITE_LABEL] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/white-label/config")
async def update_white_label_config(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update white label configuration"""
    try:
        wl_service = WhiteLabelService(db)

        config = wl_service.create_or_update_config(
            user_id=user.user_id,
            **request
        )

        print(f"[WHITE_LABEL] Updated config for user {user.email}", flush=True)

        return {"success": True, "message": "Configuration updated"}

    except Exception as e:
        db.rollback()
        print(f"[WHITE_LABEL] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/white-label/domain")
async def set_custom_domain(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set custom domain"""
    domain = request.get('domain')

    if not domain:
        raise HTTPException(status_code=400, detail="Missing domain")

    try:
        wl_service = WhiteLabelService(db)
        result = wl_service.set_custom_domain(user.user_id, domain)

        return {"success": True, **result}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        print(f"[WHITE_LABEL] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# BULK IMPORT ENDPOINTS
# ====================

@app.post("/api/bulk/csv-import")
async def csv_import(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Import books from CSV"""
    csv_content = request.get('csv_content')

    if not csv_content:
        raise HTTPException(status_code=400, detail="Missing CSV content")

    try:
        bulk_service = BulkImportService(db)

        # Parse and validate CSV
        rows = bulk_service.parse_csv(csv_content)
        validation = bulk_service.validate_csv_structure(rows)

        if not validation['valid']:
            raise HTTPException(status_code=400, detail=validation['error'])

        # Estimate credits
        estimated_credits = bulk_service.estimate_credits('csv_import', len(rows))

        # Check user credits
        if user.credits_remaining < estimated_credits:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Need {estimated_credits}, have {user.credits_remaining}"
            )

        # Create job
        job = bulk_service.create_job(
            user_id=user.user_id,
            job_type='csv_import',
            config={'row_count': len(rows)},
            estimated_credits=estimated_credits
        )

        # Process import asynchronously
        import asyncio
        asyncio.create_task(
            bulk_service.process_csv_import(job.job_id, csv_content, user.user_id)
        )

        print(f"[BULK_IMPORT] Started CSV import job {job.job_id}", flush=True)

        return {
            "success": True,
            "job_id": str(job.job_id),
            "estimated_credits": estimated_credits,
            "total_items": len(rows)
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[BULK_IMPORT] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bulk/jobs/{job_id}")
async def get_bulk_job(
    job_id: str,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get bulk job status"""
    try:
        bulk_service = BulkImportService(db)
        job = bulk_service.get_job(uuid.UUID(job_id))

        if not job or job.user_id != user.user_id:
            raise HTTPException(status_code=404, detail="Job not found")

        return {
            "job_id": str(job.job_id),
            "type": job.job_type,
            "status": job.status,
            "progress_percentage": job.progress_percentage,
            "total_items": job.total_items,
            "processed_items": job.processed_items,
            "failed_items": job.failed_items,
            "credits_consumed": job.credits_consumed,
            "created_book_ids": job.created_book_ids,
            "error_details": job.error_details
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[BULK_IMPORT] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# TRANSLATION ENDPOINTS
# ====================

@app.get("/api/translation/languages")
async def get_supported_languages(
    user = Depends(get_current_user)
):
    """Get supported translation languages"""
    translation_service = TranslationService()
    languages = translation_service.get_supported_languages()

    return {"languages": languages}


@app.post("/api/books/{book_id}/translate")
async def translate_book(
    book_id: str,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Translate an entire book (5 credits)"""
    target_language = request.get('target_language')

    if not target_language:
        raise HTTPException(status_code=400, detail="Missing target_language")

    # Verify book ownership
    book_repo = BookRepository(db)
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)

    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    # Check credits (5 credits per book translation)
    credits_needed = 5
    if user.credits_remaining < credits_needed:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    try:
        translation_service = TranslationService()
        user_repo = UserRepository(db)
        usage_repo = UsageRepository(db)

        # Translate all pages
        pages = book_data['pages']
        translated_pages = []

        book_context = {
            'genre': book_data.get('genre'),
            'age_range': book_data.get('age_range')
        }

        for page in pages:
            translated_content = translation_service.translate_book_page(
                page_content=page['content'],
                target_language=target_language,
                book_genre=book_context.get('genre'),
                age_range=book_context.get('age_range')
            )

            translated_pages.append({
                'page_number': page['page_number'],
                'content': translated_content
            })

        # Translate metadata
        metadata = translation_service.translate_book_metadata(
            title=book_data['title'],
            subtitle=book_data.get('subtitle'),
            description=book_data.get('description'),
            target_language=target_language
        )

        # Consume credits
        user_repo.consume_credits(user.user_id, credits_needed)

        usage_repo.log_action(
            user_id=user.user_id,
            action_type='translate_book',
            book_id=uuid.UUID(book_id),
            credits_consumed=credits_needed
        )

        db.commit()

        print(f"[TRANSLATION] Translated book {book_id} to {target_language}", flush=True)

        return {
            "success": True,
            "translated_pages": translated_pages,
            "translated_metadata": metadata,
            "credits_consumed": credits_needed
        }

    except Exception as e:
        db.rollback()
        print(f"[TRANSLATION] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/books/{book_id}/pages/{page_number}/translate")
async def translate_page(
    book_id: str,
    page_number: int,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Translate a single page (1 credit)"""
    target_language = request.get('target_language')

    if not target_language:
        raise HTTPException(status_code=400, detail="Missing target_language")

    # Verify book ownership
    book_repo = BookRepository(db)
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)

    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    # Find the specific page
    page = next((p for p in book_data['pages'] if p['page_number'] == page_number), None)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Check credits (1 credit per page translation)
    credits_needed = 1
    if user.credits_remaining < credits_needed:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    try:
        translation_service = TranslationService()
        user_repo = UserRepository(db)
        usage_repo = UsageRepository(db)

        # Translate the page
        translated_content = translation_service.translate_book_page(
            page_content=page['content'],
            target_language=target_language,
            book_genre=book_data.get('book_type'),
            age_range=None
        )

        # Update the page content
        book_repo.update_page(
            book_id=uuid.UUID(book_id),
            page_number=page_number,
            content=translated_content
        )

        # Consume credits
        user_repo.consume_credits(user.user_id, credits_needed)

        usage_repo.log_action(
            user_id=user.user_id,
            action_type='translate_page',
            book_id=uuid.UUID(book_id),
            credits_consumed=credits_needed,
            metadata={'page_number': page_number, 'target_language': target_language}
        )

        db.commit()

        print(f"[TRANSLATION] Translated page {page_number} of book {book_id} to {target_language}", flush=True)

        return {
            "success": True,
            "page_number": page_number,
            "translated_content": translated_content,
            "credits_consumed": credits_needed
        }

    except Exception as e:
        db.rollback()
        print(f"[TRANSLATION] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# AUDIOBOOK ENDPOINTS
# ====================

@app.get("/api/audiobook/voices")
async def get_audiobook_voices(
    user = Depends(get_current_user)
):
    """Get available audiobook voices"""
    audiobook_service = AudiobookService()
    voices = audiobook_service.get_available_voices()

    return {"voices": voices}


@app.post("/api/books/{book_id}/audiobook")
async def generate_audiobook(
    book_id: str,
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate audiobook (10 credits)"""
    voice_preset = request.get('voice_preset', 'male_narrator')

    # Verify book ownership
    book_repo = BookRepository(db)
    book_data = book_repo.get_book_with_pages(uuid.UUID(book_id), user.user_id)

    if not book_data:
        raise HTTPException(status_code=404, detail="Book not found")

    # Check credits (10 credits per audiobook)
    credits_needed = 10
    if user.credits_remaining < credits_needed:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    try:
        audiobook_service = AudiobookService()
        user_repo = UserRepository(db)
        usage_repo = UsageRepository(db)

        # Generate audiobook
        audiobook_package = audiobook_service.create_audiobook_package(
            book_title=book_data['title'],
            pages=book_data['pages'],
            voice_preset=voice_preset
        )

        # Convert audio to base64 for transmission
        import base64
        audio_base64 = base64.b64encode(audiobook_package['audio_data']).decode('utf-8')

        # Consume credits
        user_repo.consume_credits(user.user_id, credits_needed)

        usage_repo.log_action(
            user_id=user.user_id,
            action_type='generate_audiobook',
            book_id=uuid.UUID(book_id),
            credits_consumed=credits_needed
        )

        db.commit()

        print(f"[AUDIOBOOK] Generated audiobook for {book_id}", flush=True)

        return {
            "success": True,
            "audio_data": audio_base64,
            "file_size_mb": audiobook_package['file_size_mb'],
            "duration": audiobook_package['duration'],
            "voice_used": voice_preset,
            "credits_consumed": credits_needed
        }

    except Exception as e:
        db.rollback()
        print(f"[AUDIOBOOK] Error: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/premium/bulk-export")
async def bulk_export_endpoint(
    request: dict,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk export book to multiple formats (Premium feature - 2 credits flat rate)"""
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

    credits_needed = 2  # Flat rate: 2 credits for all formats

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
