-- AI Book Generator - PostgreSQL Database Schema
-- Production-ready schema with all future-proof features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USERS & LICENSING
-- ========================================

-- Users table (tied to Gumroad licenses)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    gumroad_product_id VARCHAR(100),
    gumroad_sale_id VARCHAR(100),

    -- Credit system
    total_credits INTEGER DEFAULT 1000, -- Total credits purchased
    credits_used INTEGER DEFAULT 0,     -- Credits consumed
    credits_remaining INTEGER GENERATED ALWAYS AS (total_credits - credits_used) STORED,

    -- Subscription management (for future tiered pricing)
    subscription_tier VARCHAR(50) DEFAULT 'basic', -- basic, pro, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active', -- active, expired, cancelled
    subscription_expires_at TIMESTAMP WITH TIME ZONE,

    -- Account info
    is_active BOOLEAN DEFAULT true,
    is_banned BOOLEAN DEFAULT false,
    ban_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    total_books_created INTEGER DEFAULT 0,
    total_pages_generated INTEGER DEFAULT 0,
    total_exports INTEGER DEFAULT 0,

    -- Settings (JSON for flexibility)
    preferences JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT credits_valid CHECK (credits_used >= 0 AND total_credits >= 0)
);

-- License purchases table (for tracking multiple purchases)
CREATE TABLE license_purchases (
    purchase_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    license_key VARCHAR(255) NOT NULL,

    -- Purchase details
    gumroad_sale_id VARCHAR(100) UNIQUE,
    product_name VARCHAR(255),
    price_cents INTEGER,
    currency VARCHAR(10) DEFAULT 'USD',
    credits_granted INTEGER NOT NULL,

    -- Refund tracking
    is_refunded BOOLEAN DEFAULT false,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_reason TEXT,

    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT price_valid CHECK (price_cents >= 0)
);

-- ========================================
-- BOOKS & CONTENT
-- ========================================

-- Books table
CREATE TABLE books (
    book_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,

    -- Book metadata
    title VARCHAR(500) NOT NULL,
    subtitle VARCHAR(500),
    description TEXT,
    author_name VARCHAR(255) DEFAULT 'AI Book Generator',

    -- Book configuration
    book_type VARCHAR(50) NOT NULL, -- kids, adult, educational, general, fiction, non-fiction
    genre VARCHAR(100), -- for future categorization
    target_pages INTEGER NOT NULL,
    current_page_count INTEGER DEFAULT 0,

    -- Language support (future multilingual)
    language VARCHAR(10) DEFAULT 'en',

    -- AI generation settings
    structure JSONB NOT NULL, -- AI-generated outline and structure
    tone VARCHAR(50), -- professional, casual, humorous, serious, etc.
    style VARCHAR(50), -- descriptive, concise, narrative, etc.
    themes JSONB, -- Array of themes

    -- Status tracking
    status VARCHAR(50) DEFAULT 'draft', -- draft, in_progress, completed, published, archived
    is_completed BOOLEAN DEFAULT false,
    completion_percentage INTEGER DEFAULT 0,

    -- Cover and branding
    cover_svg TEXT,
    cover_image_url TEXT, -- For future image uploads
    isbn VARCHAR(20), -- For future professional publishing

    -- Publishing metadata
    published_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,

    -- Credits tracking
    credits_used INTEGER DEFAULT 0, -- Track credits used for this book

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    last_edited_at TIMESTAMP WITH TIME ZONE,

    -- Word count and statistics
    total_words INTEGER DEFAULT 0,
    estimated_reading_time INTEGER, -- in minutes

    -- Collaboration (future feature)
    is_collaborative BOOLEAN DEFAULT false,
    collaborators JSONB, -- Array of user IDs

    -- Version control
    version INTEGER DEFAULT 1,
    parent_book_id UUID REFERENCES books(book_id) ON DELETE SET NULL, -- For book forks/versions

    -- Export tracking
    export_count INTEGER DEFAULT 0,
    last_exported_at TIMESTAMP WITH TIME ZONE,

    -- Soft delete
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT target_pages_valid CHECK (target_pages >= 1 AND target_pages <= 1000),
    CONSTRAINT completion_percentage_valid CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);

-- Pages table
CREATE TABLE pages (
    page_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(book_id) ON DELETE CASCADE,

    -- Page identification
    page_number INTEGER NOT NULL,
    section VARCHAR(500),
    chapter_number INTEGER,

    -- Content
    content TEXT NOT NULL,
    content_html TEXT, -- Processed HTML version
    word_count INTEGER DEFAULT 0,

    -- Page metadata
    is_title_page BOOLEAN DEFAULT false,
    is_toc BOOLEAN DEFAULT false, -- Table of contents page
    is_dedication BOOLEAN DEFAULT false,
    is_acknowledgments BOOLEAN DEFAULT false,

    -- AI generation tracking
    ai_model_used VARCHAR(100), -- claude-3-opus, claude-3-sonnet, etc.
    generation_prompt TEXT, -- The prompt used to generate this page
    user_guidance TEXT, -- User's custom guidance for this page
    regeneration_count INTEGER DEFAULT 0, -- How many times user regenerated

    -- Version control
    version INTEGER DEFAULT 1,
    previous_content TEXT, -- For undo functionality

    -- Editing metadata
    is_edited BOOLEAN DEFAULT false,
    last_edited_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Soft delete
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(book_id, page_number),
    CONSTRAINT page_number_valid CHECK (page_number >= 1)
);

-- ========================================
-- EXPORTS & DOWNLOADS
-- ========================================

-- Export history
CREATE TABLE book_exports (
    export_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(book_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,

    -- Export details
    format VARCHAR(20) NOT NULL, -- epub, pdf, mobi, docx (future formats)
    file_size_bytes BIGINT,
    file_url TEXT, -- If stored in cloud storage
    download_count INTEGER DEFAULT 0,

    -- Export settings
    include_toc BOOLEAN DEFAULT true,
    include_cover BOOLEAN DEFAULT true,
    font_family VARCHAR(100),
    font_size INTEGER,
    page_margins JSONB,

    -- Status
    export_status VARCHAR(50) DEFAULT 'completed', -- processing, completed, failed
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- For temporary download links
    last_downloaded_at TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- USAGE & ANALYTICS
-- ========================================

-- Usage logs (for detailed analytics)
CREATE TABLE usage_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(book_id) ON DELETE SET NULL,

    -- Action tracking
    action_type VARCHAR(100) NOT NULL, -- book_created, page_generated, book_exported, etc.
    resource_type VARCHAR(50), -- book, page, export
    resource_id UUID,

    -- Credits
    credits_consumed INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB, -- Flexible field for action-specific data

    -- Request info
    ip_address INET,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily usage summary (for quick analytics)
CREATE TABLE daily_usage_summary (
    summary_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Counts
    books_created INTEGER DEFAULT 0,
    pages_generated INTEGER DEFAULT 0,
    books_exported INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, date)
);

-- ========================================
-- TEMPLATES & PRESETS (Future Feature)
-- ========================================

-- Book templates
CREATE TABLE book_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,

    -- Template info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- children's books, business, fiction, etc.

    -- Template configuration
    structure JSONB NOT NULL,
    default_settings JSONB,

    -- Visibility
    is_public BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,

    -- Stats
    use_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- FEEDBACK & SUPPORT
-- ========================================

-- User feedback
CREATE TABLE feedback (
    feedback_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    book_id UUID REFERENCES books(book_id) ON DELETE SET NULL,

    -- Feedback content
    type VARCHAR(50), -- bug, feature_request, question, praise
    subject VARCHAR(500),
    message TEXT NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, closed
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical

    -- Admin response
    admin_response TEXT,
    resolved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Users indexes
CREATE INDEX idx_users_license_key ON users(license_key);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_credits ON users(credits_remaining);

-- Books indexes
CREATE INDEX idx_books_user_id ON books(user_id);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_is_completed ON books(is_completed);
CREATE INDEX idx_books_created_at ON books(created_at DESC);
CREATE INDEX idx_books_updated_at ON books(updated_at DESC);
CREATE INDEX idx_books_book_type ON books(book_type);
CREATE INDEX idx_books_is_deleted ON books(is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_books_user_status ON books(user_id, status, is_deleted);

-- Pages indexes
CREATE INDEX idx_pages_book_id ON pages(book_id);
CREATE INDEX idx_pages_page_number ON pages(book_id, page_number);
CREATE INDEX idx_pages_created_at ON pages(created_at);
CREATE INDEX idx_pages_is_deleted ON pages(is_deleted) WHERE is_deleted = false;

-- Exports indexes
CREATE INDEX idx_exports_book_id ON book_exports(book_id);
CREATE INDEX idx_exports_user_id ON book_exports(user_id);
CREATE INDEX idx_exports_created_at ON book_exports(created_at DESC);

-- Usage logs indexes
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_book_id ON usage_logs(book_id);
CREATE INDEX idx_usage_logs_action_type ON usage_logs(action_type);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at DESC);

-- Daily usage indexes
CREATE INDEX idx_daily_usage_user_date ON daily_usage_summary(user_id, date DESC);

-- ========================================
-- FUNCTIONS & TRIGGERS
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update book page count
CREATE OR REPLACE FUNCTION update_book_page_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE books
        SET current_page_count = current_page_count + 1,
            completion_percentage = LEAST(100, (current_page_count + 1) * 100 / target_pages)
        WHERE book_id = NEW.book_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE books
        SET current_page_count = GREATEST(0, current_page_count - 1),
            completion_percentage = GREATEST(0, (current_page_count - 1) * 100 / target_pages)
        WHERE book_id = OLD.book_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_book_count_on_page_insert AFTER INSERT ON pages
    FOR EACH ROW EXECUTE FUNCTION update_book_page_count();

CREATE TRIGGER update_book_count_on_page_delete AFTER DELETE ON pages
    FOR EACH ROW EXECUTE FUNCTION update_book_page_count();

-- Function to update user credits
CREATE OR REPLACE FUNCTION update_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.credits_consumed > 0 THEN
        UPDATE users
        SET credits_used = credits_used + NEW.credits_consumed
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_credits_on_usage AFTER INSERT ON usage_logs
    FOR EACH ROW EXECUTE FUNCTION update_user_credits();

-- ========================================
-- VIEWS FOR COMMON QUERIES
-- ========================================

-- Active books with stats
CREATE VIEW active_books_view AS
SELECT
    b.book_id,
    b.user_id,
    b.title,
    b.book_type,
    b.status,
    b.current_page_count,
    b.target_pages,
    b.completion_percentage,
    b.created_at,
    b.updated_at,
    u.email as user_email,
    u.credits_remaining as user_credits
FROM books b
JOIN users u ON b.user_id = u.user_id
WHERE b.is_deleted = false
AND u.is_active = true;

-- User statistics view
CREATE VIEW user_stats_view AS
SELECT
    u.user_id,
    u.email,
    u.license_key,
    u.credits_remaining,
    u.total_books_created,
    u.total_pages_generated,
    u.total_exports,
    COUNT(DISTINCT b.book_id) as actual_book_count,
    COUNT(DISTINCT CASE WHEN b.is_completed THEN b.book_id END) as completed_books,
    u.created_at as member_since
FROM users u
LEFT JOIN books b ON u.user_id = b.user_id AND b.is_deleted = false
GROUP BY u.user_id;

-- ========================================
-- SEED DATA (Optional)
-- ========================================

-- Insert admin/test user (remove in production)
-- INSERT INTO users (license_key, email, total_credits, subscription_tier)
-- VALUES ('TEST-LICENSE-KEY-12345', 'test@example.com', 1000, 'pro');

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON TABLE users IS 'User accounts tied to Gumroad license keys with credit management';
COMMENT ON TABLE books IS 'Books with comprehensive metadata, versioning, and collaboration support';
COMMENT ON TABLE pages IS 'Individual book pages with AI generation tracking and version control';
COMMENT ON TABLE book_exports IS 'Track all book exports with download history';
COMMENT ON TABLE usage_logs IS 'Detailed action logging for analytics and debugging';
COMMENT ON TABLE daily_usage_summary IS 'Aggregated daily statistics for fast analytics queries';
