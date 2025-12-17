# AI Book Generator v2.0 🚀

Professional ebook creation platform with AI-powered content generation, credit-based licensing, and PostgreSQL backend.

## Features

✅ **Credit-Based System**
- 1,000-17,000 credits per package
- $0.02 per generation
- No subscriptions, credits never expire

✅ **AI-Powered Generation**
- Book structure and outline
- Page-by-page content generation
- AI-generated SVG covers
- Professional quality output

✅ **Enhanced EPUB Export**
- Perfect formatting for all e-readers
- Amazon KDP ready
- Smart typography (curly quotes, em dashes)
- Professional copyright pages

✅ **PostgreSQL Database**
- Scalable and reliable
- Full usage analytics
- Version control for pages
- Soft deletes

✅ **Modular Frontend**
- Clean component architecture
- Easy to maintain and extend
- Dark mode support
- Responsive design

## Architecture

```
├── database/
│   ├── models.py           # SQLAlchemy models
│   ├── connection.py       # Database manager
│   ├── repositories/       # Data access layer
│   └── schema.sql          # PostgreSQL schema
├── core/
│   ├── gumroad_v2.py       # License validation
│   ├── book_generator.py   # AI generation
│   └── epub_exporter_v2.py # Enhanced EPUB
├── frontend/
│   ├── index.html          # Main entry
│   ├── css/                # Modular styles
│   └── js/                 # Component modules
├── main_postgres.py        # FastAPI backend
└── requirements_postgres.txt
```

## Quick Start

### Local Development

1. **Install Dependencies**
```bash
pip install -r requirements_postgres.txt
```

2. **Set Up PostgreSQL**
```bash
createdb aibook_dev
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your keys
```

4. **Initialize Database**
```bash
python -c "from database.connection import initialize_database; db = initialize_database(); db.create_tables()"
```

5. **Run Backend**
```bash
uvicorn main_postgres:app --reload
```

6. **Open Frontend**
```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

### Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

## Credit Costs

| Action | Credits | Cost |
|--------|---------|------|
| Book Structure | 1 | $0.02 |
| Page Generation | 1 | $0.02 |
| Cover Generation | 2 | $0.04 |
| **20-page book total** | **23** | **$0.46** |

## Pricing Packages

| Package | Credits | Price | Savings |
|---------|---------|-------|---------|
| Starter | 1,000 | $19 | 5% |
| Professional ⭐ | 3,000 | $49 | 18% |
| Business | 7,000 | $99 | 29% |
| Enterprise | 17,000 | $199 | 41% |

## API Endpoints

### Authentication
- `GET /api/credits` - Get user credits

### Books
- `POST /api/books` - Create book (2 credits)
- `GET /api/books` - List all books
- `GET /api/books/in-progress` - List in-progress books
- `GET /api/books/completed` - List completed books
- `GET /api/books/{id}` - Get single book
- `DELETE /api/books/{id}` - Delete book (free)

### Pages
- `POST /api/books/generate-page` - Generate page (1 credit)
- `PUT /api/books/update-page` - Update page (free)

### Export
- `POST /api/books/complete` - Complete book + cover (2 credits)
- `POST /api/books/export` - Export to EPUB (free)

## Database Schema

### Core Tables
- `users` - User accounts with credits
- `books` - Book metadata and structure
- `pages` - Page content with AI tracking
- `book_exports` - Export history
- `usage_logs` - Detailed analytics
- `license_purchases` - Purchase tracking

### Key Features
- Computed credits remaining
- Automatic page count updates
- Soft deletes
- Version control
- Comprehensive indexes

## Tech Stack

**Backend**
- FastAPI (Python web framework)
- SQLAlchemy (ORM)
- PostgreSQL (Database)
- Anthropic Claude (AI)
- EbookLib (EPUB generation)

**Frontend**
- Vanilla JavaScript (ES6 modules)
- CSS Variables (Theming)
- Modern HTML5

**Deployment**
- Render.com (Hosting)
- Gumroad (Licensing)

## Development

### Run Tests
```bash
pytest
```

### Code Quality
```bash
black .
flake8
mypy .
```

### Database Migrations
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Project Structure

```
📦 aibook/
├── 📁 database/          # PostgreSQL models & repos
├── 📁 core/              # Business logic
├── 📁 frontend/          # Modular frontend
├── 📄 main_postgres.py   # FastAPI app
├── 📄 requirements_postgres.txt
├── 📄 render.yaml        # Deployment config
├── 📄 DEPLOYMENT.md      # Deploy guide
├── 📄 PRICING_STRATEGY.md # Business model
└── 📄 README.md          # You are here
```

## Contributing

This is a commercial project. Contact for collaboration opportunities.

## License

Proprietary. All rights reserved.

## Support

- GitHub Issues: Bug reports only
- Email: support@yourdomain.com
- Gumroad: Purchase and licensing

---

**Built with ❤️ to be the #1 AI book tool on Gumroad**
