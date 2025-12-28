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
    white_label_config = relationship("WhiteLabelConfig", back_populates="user", uselist=False, cascade="all, delete-orphan")
    bulk_import_jobs = relationship("BulkImportJob", back_populates="user", cascade="all, delete-orphan")

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
    epub_page_count = Column(Integer)  # Actual EPUB page count (estimated)

    # Language support
    language = Column(String(10), default='en')

    # AI generation settings
    structure = Column(JSONB, nullable=False)
    tone = Column(Text)  # Allow longer tone descriptions
    style = Column(Text)  # Allow longer style descriptions (legacy)
    themes = Column(JSONB)

    # Advanced style profile (new)
    style_profile = Column(JSONB)  # {author_preset, tone, vocabulary_level, sentence_style, sample_text, analyzed_patterns}

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
    collaborators = relationship("BookCollaborator", back_populates="book", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="book", cascade="all, delete-orphan")

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
    illustration_url = Column(Text)  # Base64 data URL for illustration image (can be >100KB)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Soft delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True))

    # Relationships
    book = relationship("Book", back_populates="pages")
    comments = relationship("Comment", back_populates="page", cascade="all, delete-orphan")

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


class Character(Base):
    __tablename__ = 'characters'

    character_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey('books.book_id', ondelete='CASCADE'), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), index=True)

    # Character identity
    name = Column(String(255), nullable=False)
    role = Column(String(100))  # protagonist, antagonist, supporting, minor
    archetype = Column(String(100))  # hero, mentor, shadow, trickster, etc.

    # Character description
    description = Column(Text)
    appearance = Column(Text)
    personality = Column(Text)
    background = Column(Text)

    # Character development
    motivation = Column(Text)
    goal = Column(Text)
    conflict = Column(Text)
    arc = Column(Text)  # character development arc

    # Relationships and dynamics
    relationships = Column(JSONB)  # {character_id: relationship_description}

    # Character traits
    traits = Column(JSONB)  # {category: [traits]} e.g. {strengths: [...], weaknesses: [...], quirks: [...]}

    # Dialogue and voice
    speech_patterns = Column(Text)
    catchphrases = Column(JSONB)  # [catchphrase1, catchphrase2, ...]

    # Story presence
    introduction_page = Column(Integer)  # Page where character first appears
    importance_level = Column(Integer, default=5)  # 1-10 scale

    # Character image
    portrait_url = Column(Text)  # Optional AI-generated character portrait

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Soft delete
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True))

    # Relationships
    book = relationship("Book")

    __table_args__ = (
        Index('idx_characters_book', 'book_id', 'is_deleted'),
    )

    def __repr__(self):
        return f"<Character(name='{self.name}', role='{self.role}')>"


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


class BookCollaborator(Base):
    """
    Collaborators with different roles for shared book projects
    """
    __tablename__ = 'book_collaborators'

    collaborator_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey('books.book_id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, index=True)
    invited_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'))

    # Role and permissions
    role = Column(String(50), nullable=False, default='viewer')  # owner, editor, commenter, viewer
    can_edit = Column(Boolean, default=False)
    can_comment = Column(Boolean, default=True)
    can_generate = Column(Boolean, default=False)
    can_export = Column(Boolean, default=False)
    can_invite = Column(Boolean, default=False)

    # Status
    status = Column(String(50), default='active')  # active, pending, revoked
    invitation_token = Column(String(255), unique=True)
    invitation_sent_at = Column(DateTime(timezone=True))
    invitation_accepted_at = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    book = relationship("Book", back_populates="collaborators")
    user = relationship("User", foreign_keys=[user_id])
    inviter = relationship("User", foreign_keys=[invited_by])

    __table_args__ = (
        Index('idx_collaborators_book', 'book_id', 'status'),
        Index('idx_collaborators_user', 'user_id', 'status'),
        # Prevent duplicate collaborators
        Index('idx_unique_book_user', 'book_id', 'user_id', unique=True),
    )

    @validates('role')
    def validate_role(self, key, role):
        allowed_roles = ['owner', 'editor', 'commenter', 'viewer']
        if role and role not in allowed_roles:
            raise ValueError(f"role must be one of {allowed_roles}")
        return role

    def __repr__(self):
        return f"<BookCollaborator(book_id={self.book_id}, user_id={self.user_id}, role='{self.role}')>"


class Comment(Base):
    """
    Comments on book pages for collaboration and feedback
    """
    __tablename__ = 'comments'

    comment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey('books.book_id', ondelete='CASCADE'), nullable=False, index=True)
    page_id = Column(UUID(as_uuid=True), ForeignKey('pages.page_id', ondelete='CASCADE'), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)

    # Comment content
    content = Column(Text, nullable=False)
    comment_type = Column(String(50), default='general')  # general, suggestion, issue, praise

    # Threading
    parent_comment_id = Column(UUID(as_uuid=True), ForeignKey('comments.comment_id', ondelete='CASCADE'))
    thread_id = Column(UUID(as_uuid=True))  # Root comment ID for threading

    # Selection/highlighting
    selected_text = Column(Text)  # Text being commented on
    selection_start = Column(Integer)  # Character position start
    selection_end = Column(Integer)  # Character position end

    # Status
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='SET NULL'))
    resolved_at = Column(DateTime(timezone=True))
    is_deleted = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True))

    # Relationships
    book = relationship("Book", back_populates="comments")
    page = relationship("Page", back_populates="comments")
    user = relationship("User", foreign_keys=[user_id])
    resolver = relationship("User", foreign_keys=[resolved_by])

    # Self-referential for threading
    replies = relationship("Comment", backref="parent", remote_side=[comment_id])

    __table_args__ = (
        Index('idx_comments_book', 'book_id', 'is_deleted'),
        Index('idx_comments_page', 'page_id', 'is_deleted'),
        Index('idx_comments_thread', 'thread_id'),
    )

    @validates('comment_type')
    def validate_type(self, key, comment_type):
        allowed_types = ['general', 'suggestion', 'issue', 'praise']
        if comment_type and comment_type not in allowed_types:
            raise ValueError(f"comment_type must be one of {allowed_types}")
        return comment_type

    def __repr__(self):
        return f"<Comment(book_id={self.book_id}, user_id={self.user_id}, type='{self.comment_type}')>"


class WhiteLabelConfig(Base):
    """
    White label branding configuration for users
    """
    __tablename__ = 'white_label_configs'

    config_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, unique=True, index=True)

    # Domain configuration
    custom_domain = Column(String(255), unique=True)
    domain_verified = Column(Boolean, default=False)
    domain_verification_token = Column(String(255))
    domain_verified_at = Column(DateTime(timezone=True))

    # Branding
    brand_name = Column(String(255))
    logo_url = Column(Text)  # URL or base64 data
    favicon_url = Column(Text)
    primary_color = Column(String(7), default='#8B5CF6')  # Hex color
    secondary_color = Column(String(7), default='#EC4899')
    accent_color = Column(String(7), default='#10B981')

    # Contact & Legal
    support_email = Column(String(255))
    company_name = Column(String(255))
    company_address = Column(Text)
    privacy_policy_url = Column(Text)
    terms_of_service_url = Column(Text)

    # Features
    hide_powered_by = Column(Boolean, default=False)
    custom_footer_text = Column(Text)
    custom_meta_description = Column(Text)

    # Analytics
    google_analytics_id = Column(String(50))
    facebook_pixel_id = Column(String(50))

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="white_label_config")

    __table_args__ = (
        Index('idx_white_label_domain', 'custom_domain'),
    )

    def __repr__(self):
        return f"<WhiteLabelConfig(user_id={self.user_id}, domain='{self.custom_domain}')>"


class BulkImportJob(Base):
    """
    Track bulk import operations (CSV, batch generation)
    """
    __tablename__ = 'bulk_import_jobs'

    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, index=True)

    # Job details
    job_type = Column(String(50), nullable=False)  # csv_import, batch_generate, bulk_translate
    status = Column(String(50), default='pending')  # pending, processing, completed, failed

    # Progress tracking
    total_items = Column(Integer, default=0)
    processed_items = Column(Integer, default=0)
    failed_items = Column(Integer, default=0)
    progress_percentage = Column(Integer, default=0)

    # Configuration
    config = Column(JSONB)  # Job-specific settings

    # File references
    input_file_url = Column(Text)  # S3 URL for uploaded CSV
    output_file_url = Column(Text)  # S3 URL for results
    error_log_url = Column(Text)  # S3 URL for error details

    # Results
    created_book_ids = Column(JSONB)  # Array of created book IDs
    error_details = Column(JSONB)  # Array of error objects

    # Credits
    credits_consumed = Column(Integer, default=0)
    estimated_credits = Column(Integer, default=0)

    # Timestamps
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="bulk_import_jobs")

    __table_args__ = (
        Index('idx_bulk_jobs_user_status', 'user_id', 'status'),
    )

    @validates('job_type')
    def validate_job_type(self, key, job_type):
        allowed_types = ['csv_import', 'batch_generate', 'bulk_translate', 'bulk_export']
        if job_type and job_type not in allowed_types:
            raise ValueError(f"job_type must be one of {allowed_types}")
        return job_type

    @validates('status')
    def validate_status(self, key, status):
        allowed_statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled']
        if status and status not in allowed_statuses:
            raise ValueError(f"status must be one of {allowed_statuses}")
        return status

    def __repr__(self):
        return f"<BulkImportJob(job_id={self.job_id}, type='{self.job_type}', status='{self.status}')>"
