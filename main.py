from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
import os
import json
import uuid
from dotenv import load_dotenv

from core.gumroad import GumroadValidator
from core.usage_tracker import UsageTracker
from core.book_generator import BookGenerator
from core.book_store import BookStore
from core.pdf_exporter import PDFExporter

# Load environment variables
load_dotenv()

# Verify required env vars
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_KEY:
    raise ValueError("ANTHROPIC_API_KEY not found in environment")

app = FastAPI(
    title="AI Book Generator API",
    description="Professional AI-powered ebook creation platform",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
gumroad = GumroadValidator()
usage_tracker = UsageTracker()
book_store = BookStore()
pdf_exporter = PDFExporter()


# Request models
class CreateBookRequest(BaseModel):
    description: str = Field(..., min_length=10, max_length=1000)
    target_pages: int = Field(..., ge=5, le=100)
    book_type: str = Field(default="general", pattern="^(kids|adult|educational|general)$")


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


# Routes
@app.get("/")
async def root():
    """Health check and API info"""
    return {
        "status": "online",
        "service": "AI Book Generator API",
        "version": "1.0.0",
        "features": ["book_creation", "page_generation", "pdf_export", "content_editing"]
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "anthropic_configured": bool(ANTHROPIC_KEY),
        "gumroad_configured": bool(os.getenv("GUMROAD_PRODUCT_ID")),
        "database": "connected",
        "version": "1.0.0"
    }


@app.get("/api/usage")
async def get_usage(authorization: str = Header(...)):
    """Get usage statistics for a license key"""

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    # Get usage stats
    stats = usage_tracker.get_usage_stats(license_key)

    return {
        "success": True,
        "license_valid": True,
        "usage": stats
    }


@app.post("/api/books")
async def create_book(
    request: CreateBookRequest,
    authorization: str = Header(...)
):
    """
    Create a new book with AI-generated structure and first page

    This endpoint:
    1. Validates the license
    2. Generates book structure and outline
    3. Generates the first page (title + intro)
    4. Saves to database
    5. Returns the complete book data
    """

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(
            status_code=401,
            detail="License key required. Purchase at [YOUR_GUMROAD_URL]"
        )

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        # Generate book with streaming
        generator = BookGenerator(api_key=None)  # Use system key

        book_id = str(uuid.uuid4())
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
                raise Exception(chunk['error'])

        if not structure or not first_page:
            raise Exception("Failed to generate book structure or first page")

        # Save to database
        book_store.create_book(
            license_key=license_key,
            book_id=book_id,
            title=structure['title'],
            description=request.description,
            target_pages=request.target_pages,
            book_type=request.book_type,
            structure=structure
        )

        # Save first page
        book_store.save_page(
            page_id=str(uuid.uuid4()),
            book_id=book_id,
            page_number=first_page['page_number'],
            section=first_page['section'],
            content=first_page['content'],
            is_title_page=first_page.get('is_title_page', False)
        )

        # Increment usage (book + first page)
        usage_tracker.increment_book(license_key)
        usage_tracker.increment_page(license_key)  # Count the first page too!

        # Get complete book data
        book = book_store.get_book(license_key, book_id)

        return {
            "success": True,
            "message": "Book created successfully! You can now generate the next pages.",
            "book": book
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Book creation failed: {str(e)}"
        )


@app.post("/api/books/generate-page")
async def generate_page(
    request: GeneratePageRequest,
    authorization: str = Header(...)
):
    """
    Generate the next page in the book

    Args:
        book_id: ID of the book
        page_number: Page number to generate (must be sequential)
        user_input: Optional user guidance for this specific page
    """

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        # Get book from database
        book = book_store.get_book(license_key, request.book_id)

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        # Validate page number is sequential
        current_pages = len(book['pages'])
        expected_next = current_pages + 1

        if request.page_number != expected_next:
            raise HTTPException(
                status_code=400,
                detail=f"Page must be generated sequentially. Next page should be {expected_next}"
            )

        # Check if book is complete
        if current_pages >= book['target_pages']:
            raise HTTPException(
                status_code=400,
                detail="Book is already complete"
            )

        # Generate next page
        generator = BookGenerator(api_key=None)

        next_page = await generator.generate_next_page(
            book_structure=book['structure'],
            current_page=request.page_number - 1,  # 0-indexed
            previous_pages=book['pages'],
            user_input=request.user_input
        )

        # Save page to database
        book_store.save_page(
            page_id=str(uuid.uuid4()),
            book_id=request.book_id,
            page_number=next_page['page_number'],
            section=next_page['section'],
            content=next_page['content'],
            is_title_page=False
        )

        # Increment usage
        usage_tracker.increment_page(license_key)

        return {
            "success": True,
            "message": f"Page {next_page['page_number']} generated successfully!",
            "page": next_page,
            "is_complete": next_page['page_number'] >= book['target_pages']
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Page generation failed: {str(e)}"
        )


@app.put("/api/books/update-page")
async def update_page(
    request: UpdatePageRequest,
    authorization: str = Header(...)
):
    """
    Update the content of a specific page

    This allows users to edit AI-generated content
    """

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        # Update page content
        success = book_store.update_page_content(
            license_key=license_key,
            book_id=request.book_id,
            page_number=request.page_number,
            new_content=request.content
        )

        if not success:
            raise HTTPException(status_code=404, detail="Book or page not found")

        return {
            "success": True,
            "message": "Page updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Page update failed: {str(e)}"
        )


@app.get("/api/books")
async def list_books(
    authorization: str = Header(...),
    limit: int = 50,
    offset: int = 0
):
    """List all books for the authenticated user"""

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        books = book_store.list_books(license_key, limit=limit, offset=offset)
        total_count = book_store.count_books(license_key)

        return {
            "success": True,
            "books": books,
            "total": total_count,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list books: {str(e)}"
        )


@app.get("/api/books/{book_id}")
async def get_book(
    book_id: str,
    authorization: str = Header(...)
):
    """Get a specific book with all pages"""

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        book = book_store.get_book(license_key, book_id)

        if book is None:
            raise HTTPException(status_code=404, detail="Book not found")

        return {
            "success": True,
            "book": book
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve book: {str(e)}"
        )


@app.delete("/api/books/{book_id}")
async def delete_book(
    book_id: str,
    authorization: str = Header(...)
):
    """Delete a book and all its pages"""

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        # Get book details before deletion to count pages
        book = book_store.get_book(license_key, book_id)

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        # Count pages in the book
        page_count = len(book.get('pages', []))

        # Delete book from database
        deleted = book_store.delete_book(license_key, book_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Book not found")

        # Decrement usage counters
        usage_tracker.decrement_book(license_key)
        if page_count > 0:
            usage_tracker.decrement_pages(license_key, page_count)

        return {
            "success": True,
            "message": "Book deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete book: {str(e)}"
        )


@app.post("/api/books/export")
async def export_book(
    request: ExportBookRequest,
    authorization: str = Header(...)
):
    """
    Export book to PDF format

    Returns a downloadable PDF file
    """

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        # Get book from database
        book = book_store.get_book(license_key, request.book_id)

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        # Generate PDF
        pdf_buffer = pdf_exporter.export_book(book)

        # Create filename
        filename = f"{book['title'].replace(' ', '_')}.pdf"

        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Export failed: {str(e)}"
        )


@app.post("/api/books/complete")
async def complete_book(
    request: CompleteBookRequest,
    authorization: str = Header(...)
):
    """
    Mark a book as completed and generate an AI-powered SVG cover

    This endpoint:
    1. Validates the book is fully generated
    2. Generates a professional SVG book cover using AI
    3. Marks the book as completed
    4. Saves the cover SVG
    """

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        # Get book from database
        book = book_store.get_book(license_key, request.book_id)

        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        # Check if book has all pages
        current_pages = len(book['pages'])
        if current_pages < book['target_pages']:
            raise HTTPException(
                status_code=400,
                detail=f"Book is not complete. {current_pages}/{book['target_pages']} pages generated."
            )

        # Generate SVG cover using AI
        generator = BookGenerator(api_key=None)

        cover_svg = await generator.generate_book_cover_svg(
            book_title=book['title'],
            book_themes=book['structure'].get('themes', ['general']),
            book_tone=book['structure'].get('tone', 'engaging'),
            book_type=book.get('book_type', 'general')
        )

        # Mark book as completed and save cover
        success = book_store.complete_book(license_key, request.book_id, cover_svg)

        if not success:
            raise HTTPException(status_code=404, detail="Failed to complete book")

        return {
            "success": True,
            "message": "Book completed successfully with AI-generated cover!",
            "cover_svg": cover_svg
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Book completion failed: {str(e)}"
        )


@app.get("/api/books/completed")
async def list_completed_books(
    authorization: str = Header(...),
    limit: int = 50,
    offset: int = 0
):
    """List all completed books for the authenticated user"""

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        books = book_store.list_completed_books(license_key, limit=limit, offset=offset)

        return {
            "success": True,
            "books": books,
            "total": len(books)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list completed books: {str(e)}"
        )


@app.get("/api/books/in-progress")
async def list_in_progress_books(
    authorization: str = Header(...),
    limit: int = 50,
    offset: int = 0
):
    """List all in-progress (not completed) books for the authenticated user"""

    license_key = authorization.replace("Bearer ", "").strip()

    if not license_key:
        raise HTTPException(status_code=401, detail="License key required")

    # Validate license
    is_valid, error, product_id = await gumroad.verify_license(license_key)

    if not is_valid:
        raise HTTPException(status_code=401, detail=error)

    try:
        books = book_store.list_in_progress_books(license_key, limit=limit, offset=offset)

        return {
            "success": True,
            "books": books,
            "total": len(books)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list in-progress books: {str(e)}"
        )


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom error response format"""
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
            "error": "Internal server error. Please try again."
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
