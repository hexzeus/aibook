-- ========================================
-- DATABASE MIGRATION SQL
-- Run these queries in pgAdmin 4 to update the database
-- ========================================

-- PART 1: Add style_profile column to books table
-- ========================================
ALTER TABLE books
ADD COLUMN IF NOT EXISTS style_profile JSONB;

COMMENT ON COLUMN books.style_profile IS 'Style profile configuration: author_preset, tone, vocabulary_level, sentence_style, sample_text, analyzed_patterns';


-- PART 2: Create characters table
-- ========================================
CREATE TABLE IF NOT EXISTS characters (
    character_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Identity
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),  -- protagonist, antagonist, supporting, minor
    archetype VARCHAR(100),  -- hero, mentor, trickster, etc.

    -- Physical & Background
    description TEXT,
    appearance TEXT,
    personality TEXT,
    background TEXT,

    -- Character Arc
    motivation TEXT,
    goal TEXT,
    conflict TEXT,
    arc TEXT,  -- transformation, growth, redemption, fall, etc.

    -- Relationships
    relationships JSONB,  -- {"character_name": "relationship_type"}

    -- Traits
    traits JSONB,  -- {strengths: [], weaknesses: [], quirks: []}

    -- Voice & Dialogue
    speech_patterns TEXT,
    catchphrases JSONB,  -- ["phrase1", "phrase2"]

    -- Story Integration
    introduction_page INTEGER,
    importance_level INTEGER DEFAULT 5,  -- 1-10 scale

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for characters
CREATE INDEX IF NOT EXISTS idx_characters_book ON characters(book_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);

COMMENT ON TABLE characters IS 'Character profiles for books';


-- PART 3: Create book_collaborators table
-- ========================================
CREATE TABLE IF NOT EXISTS book_collaborators (
    collaborator_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    invited_by UUID REFERENCES users(user_id) ON DELETE SET NULL,

    -- Role and permissions
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',  -- owner, editor, commenter, viewer
    can_edit BOOLEAN DEFAULT FALSE,
    can_comment BOOLEAN DEFAULT TRUE,
    can_generate BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    can_invite BOOLEAN DEFAULT FALSE,

    -- Status
    status VARCHAR(50) DEFAULT 'active',  -- active, pending, revoked
    invitation_token VARCHAR(255) UNIQUE,
    invitation_sent_at TIMESTAMPTZ,
    invitation_accepted_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_collaborator_role CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
    CONSTRAINT chk_collaborator_status CHECK (status IN ('active', 'pending', 'revoked', 'cancelled'))
);

-- Create indexes for book_collaborators
CREATE INDEX IF NOT EXISTS idx_collaborators_book ON book_collaborators(book_id, status);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON book_collaborators(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_book_user ON book_collaborators(book_id, user_id);

COMMENT ON TABLE book_collaborators IS 'Collaborators with different roles for shared book projects';


-- PART 4: Create comments table
-- ========================================
CREATE TABLE IF NOT EXISTS comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    page_id UUID REFERENCES pages(page_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Comment content
    content TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'general',  -- general, suggestion, issue, praise

    -- Threading
    parent_comment_id UUID REFERENCES comments(comment_id) ON DELETE CASCADE,
    thread_id UUID,  -- Root comment ID for threading

    -- Selection/highlighting
    selected_text TEXT,  -- Text being commented on
    selection_start INTEGER,  -- Character position start
    selection_end INTEGER,  -- Character position end

    -- Status
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT chk_comment_type CHECK (comment_type IN ('general', 'suggestion', 'issue', 'praise'))
);

-- Create indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_book ON comments(book_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);

COMMENT ON TABLE comments IS 'Comments on book pages for collaboration and feedback';


-- PART 5: Add comments relationship to pages
-- ========================================
-- No direct FK needed, already handled by page_id in comments table


-- PART 6: Create white_label_configs table
-- ========================================
CREATE TABLE IF NOT EXISTS white_label_configs (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,

    -- Domain configuration
    custom_domain VARCHAR(255) UNIQUE,
    domain_verified BOOLEAN DEFAULT FALSE,
    domain_verification_token VARCHAR(255),
    domain_verified_at TIMESTAMPTZ,

    -- Branding
    brand_name VARCHAR(255),
    logo_url TEXT,  -- URL or base64 data
    favicon_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#8B5CF6',  -- Hex color
    secondary_color VARCHAR(7) DEFAULT '#EC4899',
    accent_color VARCHAR(7) DEFAULT '#10B981',

    -- Contact & Legal
    support_email VARCHAR(255),
    company_name VARCHAR(255),
    company_address TEXT,
    privacy_policy_url TEXT,
    terms_of_service_url TEXT,

    -- Features
    hide_powered_by BOOLEAN DEFAULT FALSE,
    custom_footer_text TEXT,
    custom_meta_description TEXT,

    -- Analytics
    google_analytics_id VARCHAR(50),
    facebook_pixel_id VARCHAR(50),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for white_label_configs
CREATE INDEX IF NOT EXISTS idx_white_label_domain ON white_label_configs(custom_domain);
CREATE INDEX IF NOT EXISTS idx_white_label_user ON white_label_configs(user_id);

COMMENT ON TABLE white_label_configs IS 'White label branding configuration for users';


-- PART 7: Create bulk_import_jobs table
-- ========================================
CREATE TABLE IF NOT EXISTS bulk_import_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Job details
    job_type VARCHAR(50) NOT NULL,  -- csv_import, batch_generate, bulk_translate, bulk_export
    status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed, cancelled

    -- Progress tracking
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,

    -- Configuration
    config JSONB,  -- Job-specific settings

    -- File references
    input_file_url TEXT,  -- S3 URL for uploaded CSV
    output_file_url TEXT,  -- S3 URL for results
    error_log_url TEXT,  -- S3 URL for error details

    -- Results
    created_book_ids JSONB,  -- Array of created book IDs
    error_details JSONB,  -- Array of error objects

    -- Credits
    credits_consumed INTEGER DEFAULT 0,
    estimated_credits INTEGER DEFAULT 0,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_job_type CHECK (job_type IN ('csv_import', 'batch_generate', 'bulk_translate', 'bulk_export')),
    CONSTRAINT chk_job_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Create indexes for bulk_import_jobs
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_user_status ON bulk_import_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_created ON bulk_import_jobs(created_at DESC);

COMMENT ON TABLE bulk_import_jobs IS 'Track bulk import operations (CSV, batch generation)';


-- ========================================
-- VERIFICATION QUERIES
-- Run these to verify the migration was successful
-- ========================================

-- Check if style_profile column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'books' AND column_name = 'style_profile';

-- Check characters table
SELECT COUNT(*) as character_table_exists
FROM information_schema.tables
WHERE table_name = 'characters';

-- Check book_collaborators table
SELECT COUNT(*) as collaborators_table_exists
FROM information_schema.tables
WHERE table_name = 'book_collaborators';

-- Check comments table
SELECT COUNT(*) as comments_table_exists
FROM information_schema.tables
WHERE table_name = 'comments';

-- Check white_label_configs table
SELECT COUNT(*) as white_label_table_exists
FROM information_schema.tables
WHERE table_name = 'white_label_configs';

-- Check bulk_import_jobs table
SELECT COUNT(*) as bulk_jobs_table_exists
FROM information_schema.tables
WHERE table_name = 'bulk_import_jobs';

-- Summary: Show all new tables
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('characters', 'book_collaborators', 'comments', 'white_label_configs', 'bulk_import_jobs')
ORDER BY table_name;
