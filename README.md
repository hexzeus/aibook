# AI Book Generator - Backend

Professional AI-powered ebook creation platform. Generate complete books page-by-page with Claude AI, edit content, and export to PDF.

## Features

- **Smart Book Generation**: AI creates complete book structure and outline based on your description
- **Page-by-Page Creation**: Generate pages sequentially with AI or provide custom input
- **Full Editing**: All generated content is completely editable
- **PDF Export**: Export finished books as professional PDFs
- **Multiple Book Types**: Kids books, adult books, educational content
- **Persistent Storage**: All books saved to database
- **Usage Tracking**: Monitor API usage per license

## Tech Stack

- **FastAPI**: Modern, high-performance Python web framework
- **Claude AI (Sonnet 4)**: State-of-the-art language model for content generation
- **SQLite**: Lightweight database for books and pages
- **ReportLab**: Professional PDF generation
- **Gumroad**: License validation and payments

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```
ANTHROPIC_API_KEY=your_claude_api_key
GUMROAD_PRODUCT_ID=your_gumroad_product_id
```

### 3. Run the Server

```bash
python main.py
```

Server runs at `http://localhost:8000`

## API Endpoints

### Authentication

All endpoints require Gumroad license key in header:
```
Authorization: Bearer YOUR_LICENSE_KEY
```

### Core Endpoints

#### Create Book
```http
POST /api/books
{
  "description": "A children's book about a brave little robot",
  "target_pages": 20,
  "book_type": "kids"
}
```

Returns complete book structure + first page generated.

#### Generate Next Page
```http
POST /api/books/generate-page
{
  "book_id": "uuid",
  "page_number": 2,
  "user_input": "Optional guidance for this page"
}
```

AI generates the next page in sequence. User can provide input or leave blank for full AI generation.

#### Update Page Content
```http
PUT /api/books/update-page
{
  "book_id": "uuid",
  "page_number": 1,
  "content": "Updated page content..."
}
```

Edit any page's content.

#### List Books
```http
GET /api/books?limit=50&offset=0
```

#### Get Specific Book
```http
GET /api/books/{book_id}
```

Returns book with all pages.

#### Delete Book
```http
DELETE /api/books/{book_id}
```

#### Export to PDF
```http
POST /api/books/export
{
  "book_id": "uuid"
}
```

Returns downloadable PDF file.

### Utility Endpoints

#### Usage Statistics
```http
GET /api/usage
```

Returns book/page generation counts.

#### Health Check
```http
GET /health
```

## Database Schema

### Books Table
- `book_id`: UUID primary key
- `license_key`: User's license
- `title`: Book title
- `description`: Original description
- `target_pages`: Target page count
- `book_type`: kids/adult/educational/general
- `structure`: JSON outline
- `created_at`, `updated_at`: Timestamps

### Pages Table
- `page_id`: UUID primary key
- `book_id`: Foreign key to books
- `page_number`: Sequential page number
- `section`: Section/chapter name
- `content`: Page text content
- `is_title_page`: Boolean flag
- `created_at`, `updated_at`: Timestamps

### Usage Table
- `license_key`: Primary key
- `book_count`: Total books created
- `page_count`: Total pages generated
- `last_used`, `created_at`: Timestamps

## How It Works

### Book Creation Flow

1. **User Input**: Description + target pages + book type
2. **AI Structure Generation**: Claude creates complete outline
3. **First Page Generation**: Title page + introduction
4. **Database Storage**: Save book + first page
5. **Return to User**: Complete book data

### Page Generation Flow

1. **Context Building**: Load previous 3 pages for context
2. **AI Generation**: Claude writes next page based on outline + context
3. **Sequential Validation**: Ensure pages generated in order
4. **Database Storage**: Save new page
5. **Completion Check**: Track progress toward target pages

### PDF Export Flow

1. **Load Complete Book**: All pages from database
2. **Create Title Page**: Formatted with ReportLab
3. **Format Content Pages**: Professional typography
4. **Generate PDF**: Build complete document
5. **Stream to User**: Downloadable file

## Production Deployment

### Environment Variables

Required for production:
- `ANTHROPIC_API_KEY`: Claude API key
- `GUMROAD_PRODUCT_ID`: Your Gumroad product
- `SECRET_KEY`: Change from default

### Database

SQLite included for simplicity. For production scale, consider PostgreSQL:

```python
# Update core/book_store.py and core/usage_tracker.py
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aibook.db")
```

### Deploy to Cloud

Works with:
- Railway
- Heroku
- DigitalOcean App Platform
- AWS/GCP/Azure

Example (Railway):
```bash
railway login
railway init
railway up
```

## Architecture Highlights

### Modular Core Services

- `claude_client.py`: Claude API wrapper
- `book_generator.py`: AI generation logic
- `book_store.py`: Database operations
- `pdf_exporter.py`: PDF creation
- `gumroad.py`: License validation
- `usage_tracker.py`: Usage analytics

### Smart Context Management

Book generator maintains context of previous pages when generating new content, ensuring narrative consistency.

### Separation of Concerns

- API layer (`main.py`)
- Business logic (`core/`)
- Database operations (isolated in store classes)
- AI operations (isolated in generator)

## License

Commercial use requires Gumroad license.

## Support

For issues or questions, contact support or open an issue on GitHub.
