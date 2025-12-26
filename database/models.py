"""
SQLAlchemy models for PostgreSQL database
"""
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime, Date, DECIMAL,
    ForeignKey, CheckConstraint, Index, BigInteger
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from sqlalchemy.schema import Computed
import uuid
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = 'users'

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    license_key = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), index=True)
    gumroad_product_id = Column(String(100))
    gumroad_sale_id = Column(String(100))

    # Credit system
    total_credits = Column(Integer, default=1000, nullable=False)
    credits_used = Column(Integer, default=0, nullable=False)
    # credits_remaining is computed in PostgreSQL, access via query

    # Subscription management
    subscription_tier = Column(String(50), default='basic')  # basic, starter, pro, business, enterprise
    subscription_status = Column(String(50), default='active')  # active, cancelled, expired, paused
    subscription_expires_at = Column(DateTime(timezone=True))
    subscription_stripe_id = Column(String(255))  # Stripe subscription ID
    subscription_gumroad_id = Column(String(255))  # Gumroad subscription ID
    monthly_credit_allocation = Column(Integer, default=0)  # Credits per month for subscription
    next_credit_reset_at = Column(DateTime(timezone=True))  # When monthly credits reset

    # Account info
    is_active = Column(Boolean, default=True)
    is_banned = Column(Boolean, default=False)
    ban_reason = Column(Text)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True))

    # Metadata
    total_books_created = Column(Integer, default=0)
    total_pages_generated = Column(Integer, default=0)
    total_exports = Column(Integer, default=0)

    # Affiliate program
    affiliate_code = Column(String(50), unique=True, index=True)  # User's unique affiliate code
    referred_by_code = Column(String(50), index=True)  # Who referred this user
    total_referrals = Column(Integer, default=0)  # Number of successful referrals
    affiliate_earnings_cents = Column(Integer, default=0)  # Earnings from referrals
    affiliate_payout_email = Column(String(255))  # PayPal email for payouts

    # Settings
    preferences = Column(JSONB, default={})
    preferred_model = Column(String(50), default='claude')  # claude or openai

    # Relationships
    books = relationship("Book", back_populates="user", cascade="all, delete-orphan")
    purchases = relationship("LicensePurchase", back_populates="user", cascade="all, delete-orphan")
    exports = relationship("BookExport", back_populates="user")
    usage_logs = relationship("UsageLog", back_populates="user")
    feedback = relationship("Feedback", back_populates="user", foreign_keys="Feedback.user_id")

    __table_args__ = (
        CheckConstraint('credits_used >= 0 AND total_credits >= 0', name='credits_valid'),
    )

    @property
    def credits_remaining(self):
        return self.total_credits - self.credits_used

    def __repr__(self):
        return f"<User(license_key='{self.license_key[:8]}...', email='{self.email}')>"


class LicensePurchase(Base):
    __tablename__ = 'license_purchases'

    purchase_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'))
    license_key = Column(String(255), nullable=False)

    # Purchase details
    gumroad_sale_id = Column(String(100), unique=True)
    product_name = Column(String(255))
    price_cents = Column(Integer)
    currency = Column(String(10), default='USD')
    credits_granted = Column(Integer, nullable=False)

    # Refund tracking
    is_refunded = Column(Boolean, default=False)
    refunded_at = Column(DateTime(timezone=True))
    refund_reason = Column(Text)

    purchased_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="purchases")

    __table_args__ = (
        CheckConstraint('price_cents >= 0', name='price_valid'),
    )


class Book(Base):
    __tablename__ = 'books'

    book_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), index=True)

    # Book metadata
    title = Column(String(500), nullable=False)
    subtitle = Column(String(500))
    description = Column(Text)
    author_name = Column(String(255), default='AI Book Generator')

    # Book configuration
    book_type = Column(String(50), nullable=False, index=True)
    genre = Column(String(100))
    target_pages = Column(Integer, nullable=False)
    current_page_count = Column(Integer, default=0)

    # Language support
    language = Column(String(10), default='en')

    # AI generation settings
    structure = Column(JSONB, nullable=False)
    tone = Column(Text)  # Allow longer tone descriptions
    style = Column(Text)  # Allow longer style descriptions
    themes = Column(JSONB)

    # Status tracking
    status = Column(String(50), default='draft', index=True)
    is_completed = Column(Boolean, default=False, index=True)
    completion_percentage = Column(Integer, default=0)

    # Cover and branding
    cover_svg = Column(Text)
    cover_image_url = Column(Text)
    isbn = Column(String(20))

    # Publishing metadata
    published_at = Column(DateTime(timezone=True))
    archived_at = Column(DateTime(timezone=True))

    # Credits tracking
    credits_used = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))
    last_edited_at = Column(DateTime(timezone=True))

    # Word count and statistics
    total_words = Column(Integer, default=0)
    estimated_reading_time = Column(Integer)  # in minutes

    # Collaboration
    is_collaborative = Column(Boolean, default=False)
    collaborators = Column(JSONB)

    # Version control
    version = Column(Integer, default=1)
    parent_book_id = Column(UUID(as_uuid=True), ForeignKey('books.book_id', ondelete='SET NULL'))

    # Export tracking
    export_count = Column(Integer, default=0)
    last_exported_at = Column(DateTime(timezone=True))

    # Soft delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True))

    # Relationships
    user = relationship("User", back_populates="books")
    pages = relationship("Page", back_populates="book", cascade="all, delete-orphan", order_by="Page.page_number")
    exports = relationship("BookExport", back_populates="book")
    usage_logs = relationship("UsageLog", back_populates="book")
    feedback = relationship("Feedback", back_populates="book")

    __table_args__ = (
        CheckConstraint('target_pages >= 1 AND target_pages <= 1000', name='target_pages_valid'),
        CheckConstraint('completion_percentage >= 0 AND completion_percentage <= 100', name='completion_percentage_valid'),
        Index('idx_books_user_status', 'user_id', 'status', 'is_deleted'),
    )

    @validates('book_type')
    def validate_book_type(self, key, book_type):
        allowed_types = ['kids', 'adult', 'educational', 'general', 'fiction', 'non-fiction']
        if book_type not in allowed_types:
            raise ValueError(f"book_type must be one of {allowed_types}")
        return book_type

    def __repr__(self):
        return f"<Book(title='{self.title}', status='{self.status}')>"


class Page(Base):
    __tablename__ = 'pages'

    page_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey('books.book_id', ondelete='CASCADE'), index=True)

    # Page identification
    page_number = Column(Integer, nullable=False)
    section = Column(String(500))
    chapter_number = Column(Integer)

    # Content
    content = Column(Text, nullable=False)
    content_html = Column(Text)
    word_count = Column(Integer, default=0)

    # Page metadata
    is_title_page = Column(Boolean, default=False)
    is_toc = Column(Boolean, default=False)
    is_dedication = Column(Boolean, default=False)
    is_acknowledgments = Column(Boolean, default=False)

    # AI generation tracking
    ai_model_used = Column(String(100))
    generation_prompt = Column(Text)
    user_guidance = Column(Text)
    regeneration_count = Column(Integer, default=0)

    # Version control
    version = Column(Integer, default=1)
    previous_content = Column(Text)

    # Editing metadata
    is_edited = Column(Boolean, default=False)
    last_edited_at = Column(DateTime(timezone=True))

    # User notes/annotations
    notes = Column(Text)

    # Premium features
    illustration_url = Column(String(1000))  # URL to generated illustration image

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Soft delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True))

    # Relationships
    book = relationship("Book", back_populates="pages")

    __table_args__ = (
        CheckConstraint('page_number >= 1', name='page_number_valid'),
        Index('idx_pages_page_number', 'book_id', 'page_number', unique=True),
    )

    def __repr__(self):
        return f"<Page(book_id={self.book_id}, page_number={self.page_number})>"


class BookExport(Base):
    __tablename__ = 'book_exports'

    export_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey('books.book_id', ondelete='CASCADE'), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), index=True)

    # Export details
    format = Column(String(20), nullable=False)
    file_size_bytes = Column(BigInteger)
    file_url = Column(Text)
    download_count = Column(Integer, default=0)

    # Export settings
    include_toc = Column(Boolean, default=True)
    include_cover = Column(Boolean, default=True)
    font_family = Column(String(100))
    font_size = Column(Integer)
    page_margins = Column(JSONB)

    # Status
    export_status = Column(String(50), default='completed')
    error_message = Column(Text)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at = Column(DateTime(timezone=True))
    last_downloaded_at = Column(DateTime(timezone=True))

    # Relationships
    book = relationship("Book", back_populates="exports")
    user = relationship("User", back_populates="exports")

    @validates('format')
    def validate_format(self, key, format):
        allowed_formats = ['epub', 'pdf', 'mobi', 'docx']
        if format not in allowed_formats:
            raise ValueError(f"format must be one of {allowed_formats}")
        return format


class UsageLog(Base):
    __tablename__ = 'usage_logs'

    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), index=True)
    book_id = Column(UUID(as_uuid=True), ForeignKey('books.book_id', ondelete='SET NULL'), index=True)

    # Action tracking
    action_type = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50))
    resource_id = Column(UUID(as_uuid=True))

    # Credits
    credits_consumed = Column(Integer, default=0)

    # Metadata (renamed column to avoid SQLAlchemy reserved name conflict)
    action_metadata = Column('metadata', JSONB)

    # Request info
    ip_address = Column(INET)
    user_agent = Column(Text)

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    user = relationship("User", back_populates="usage_logs")
    book = relationship("Book", back_populates="usage_logs")


class DailyUsageSummary(Base):
    __tablename__ = 'daily_usage_summary'

    summary_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'))
    date = Column(Date, nullable=False)

    # Counts
    books_created = Column(Integer, default=0)
    pages_generated = Column(Integer, default=0)
    books_exported = Column(Integer, default=0)
    credits_used = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('idx_daily_usage_user_date', 'user_id', 'date', unique=True),
    )


class BookTemplate(Base):
    __tablename__ = 'book_templates'

    template_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'))

    # Template info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))

    # Template configuration
    structure = Column(JSONB, nullable=False)
    default_settings = Column(JSONB)

    # Visibility
    is_public = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)

    # Stats
    use_count = Column(Integer, default=0)
    rating = Column(DECIMAL(3, 2))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Feedback(Base):
    __tablename__ = 'feedback'

    feedback_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'))
    book_id = Column(UUID(as_uuid=True), ForeignKey('books.book_id', ondelete='SET NULL'))

    # Feedback content
    type = Column(String(50))
    subject = Column(String(500))
    message = Column(Text, nullable=False)

    # Status
    status = Column(String(50), default='open')
    priority = Column(String(20), default='medium')

    # Admin response
    admin_response = Column(Text)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'))
    resolved_at = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="feedback", foreign_keys=[user_id])
    book = relationship("Book", back_populates="feedback")

    @validates('type')
    def validate_type(self, key, type):
        allowed_types = ['bug', 'feature_request', 'question', 'praise']
        if type and type not in allowed_types:
            raise ValueError(f"type must be one of {allowed_types}")
        return type
