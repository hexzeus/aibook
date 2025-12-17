"""
Book repository - handles all book and page database operations
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc
from typing import Optional, List, Dict
from datetime import datetime
import uuid

from ..models import Book, Page


class BookRepository:
    """Repository for book and page operations"""

    def __init__(self, session: Session):
        self.session = session

    def create_book(
        self,
        user_id: uuid.UUID,
        title: str,
        description: str,
        target_pages: int,
        book_type: str,
        structure: Dict,
        author_name: str = 'AI Book Generator',
        **kwargs
    ) -> Book:
        """Create new book"""
        book = Book(
            user_id=user_id,
            title=title,
            description=description,
            target_pages=target_pages,
            book_type=book_type,
            structure=structure,
            author_name=author_name,
            status='in_progress',
            **kwargs
        )
        self.session.add(book)
        self.session.flush()
        return book

    def get_book(self, book_id: uuid.UUID, user_id: Optional[uuid.UUID] = None) -> Optional[Book]:
        """Get book by ID with optional user verification"""
        query = self.session.query(Book).filter(
            and_(
                Book.book_id == book_id,
                Book.is_deleted == False
            )
        )

        if user_id:
            query = query.filter(Book.user_id == user_id)

        return query.options(joinedload(Book.pages)).first()

    def list_books(
        self,
        user_id: uuid.UUID,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Book]:
        """List books for user"""
        query = self.session.query(Book).filter(
            and_(
                Book.user_id == user_id,
                Book.is_deleted == False
            )
        )

        if status:
            query = query.filter(Book.status == status)

        return query.order_by(desc(Book.updated_at)).limit(limit).offset(offset).all()

    def list_in_progress_books(
        self,
        user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[Book]:
        """List in-progress (not completed) books"""
        return self.session.query(Book).filter(
            and_(
                Book.user_id == user_id,
                Book.is_completed == False,
                Book.is_deleted == False
            )
        ).order_by(desc(Book.updated_at)).limit(limit).offset(offset).all()

    def list_completed_books(
        self,
        user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[Book]:
        """List completed books"""
        return self.session.query(Book).filter(
            and_(
                Book.user_id == user_id,
                Book.is_completed == True,
                Book.is_deleted == False
            )
        ).order_by(desc(Book.completed_at)).limit(limit).offset(offset).all()

    def update_book(self, book_id: uuid.UUID, **kwargs) -> Optional[Book]:
        """Update book fields"""
        book = self.get_book(book_id)
        if not book:
            return None

        for key, value in kwargs.items():
            if hasattr(book, key):
                setattr(book, key, value)

        book.last_edited_at = datetime.utcnow()
        self.session.flush()
        return book

    def complete_book(self, book_id: uuid.UUID, cover_svg: str) -> Optional[Book]:
        """Mark book as completed"""
        print(f"[REPO] complete_book called for {book_id}", flush=True)
        book = self.get_book(book_id)
        if not book:
            return None

        book.is_completed = True
        book.status = 'completed'
        book.cover_svg = cover_svg
        book.completed_at = datetime.utcnow()
        book.completion_percentage = 100

        print(f"[REPO] Book marked as complete, skipping flush (will commit later)", flush=True)
        # Don't flush here - causes session locks. Will commit at endpoint level.
        # self.session.flush()
        return book

    def delete_book(self, book_id: uuid.UUID, user_id: uuid.UUID, soft_delete: bool = True) -> bool:
        """Delete book (soft or hard delete)"""
        book = self.get_book(book_id, user_id)
        if not book:
            return False

        if soft_delete:
            book.is_deleted = True
            book.deleted_at = datetime.utcnow()
            self.session.flush()
        else:
            self.session.delete(book)
            self.session.flush()

        return True

    def count_books(self, user_id: uuid.UUID, status: Optional[str] = None) -> int:
        """Count books for user"""
        query = self.session.query(Book).filter(
            and_(
                Book.user_id == user_id,
                Book.is_deleted == False
            )
        )

        if status:
            query = query.filter(Book.status == status)

        return query.count()

    # Page operations

    def create_page(
        self,
        book_id: uuid.UUID,
        page_number: int,
        section: str,
        content: str,
        is_title_page: bool = False,
        **kwargs
    ) -> Page:
        """Create new page"""
        page = Page(
            book_id=book_id,
            page_number=page_number,
            section=section,
            content=content,
            is_title_page=is_title_page,
            word_count=len(content.split()),
            **kwargs
        )
        self.session.add(page)
        self.session.flush()
        return page

    def get_page(self, page_id: uuid.UUID) -> Optional[Page]:
        """Get page by ID"""
        return self.session.query(Page).filter(
            and_(
                Page.page_id == page_id,
                Page.is_deleted == False
            )
        ).first()

    def get_page_by_number(self, book_id: uuid.UUID, page_number: int) -> Optional[Page]:
        """Get page by book ID and page number"""
        return self.session.query(Page).filter(
            and_(
                Page.book_id == book_id,
                Page.page_number == page_number,
                Page.is_deleted == False
            )
        ).first()

    def list_pages(self, book_id: uuid.UUID) -> List[Page]:
        """List all pages for a book"""
        return self.session.query(Page).filter(
            and_(
                Page.book_id == book_id,
                Page.is_deleted == False
            )
        ).order_by(Page.page_number).all()

    def update_page_content(
        self,
        page_id: uuid.UUID,
        content: str,
        save_previous: bool = True
    ) -> Optional[Page]:
        """Update page content"""
        page = self.get_page(page_id)
        if not page:
            return None

        if save_previous:
            page.previous_content = page.content

        page.content = content
        page.word_count = len(content.split())
        page.is_edited = True
        page.last_edited_at = datetime.utcnow()

        self.session.flush()
        return page

    def delete_page(self, page_id: uuid.UUID, soft_delete: bool = True) -> bool:
        """Delete page"""
        page = self.get_page(page_id)
        if not page:
            return False

        if soft_delete:
            page.is_deleted = True
            page.deleted_at = datetime.utcnow()
            self.session.flush()
        else:
            self.session.delete(page)
            self.session.flush()

        return True

    def get_book_with_pages(self, book_id: uuid.UUID, user_id: Optional[uuid.UUID] = None) -> Optional[Dict]:
        """Get book with all pages as dictionary"""
        book = self.get_book(book_id, user_id)
        if not book:
            return None

        return {
            'book_id': str(book.book_id),
            'title': book.title,
            'subtitle': book.subtitle,
            'description': book.description,
            'author_name': book.author_name,
            'book_type': book.book_type,
            'target_pages': book.target_pages,
            'current_page_count': book.current_page_count,
            'completion_percentage': book.completion_percentage,
            'structure': book.structure,
            'status': book.status,
            'is_completed': book.is_completed,
            'cover_svg': book.cover_svg,
            'created_at': book.created_at.isoformat() if book.created_at else None,
            'updated_at': book.updated_at.isoformat() if book.updated_at else None,
            'completed_at': book.completed_at.isoformat() if book.completed_at else None,
            'pages': [
                {
                    'page_id': str(page.page_id),
                    'page_number': page.page_number,
                    'section': page.section,
                    'content': page.content,
                    'word_count': page.word_count,
                    'is_title_page': page.is_title_page,
                    'created_at': page.created_at.isoformat() if page.created_at else None,
                    'updated_at': page.updated_at.isoformat() if page.updated_at else None
                }
                for page in sorted(book.pages, key=lambda p: p.page_number)
                if not page.is_deleted
            ]
        }
