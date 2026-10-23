-- Migration 012: Create Beta Releases, Feedback Community, and Audit Logging
-- Project: Chandil Home Services Beta Portal

-- 1. App Releases Table
CREATE TABLE IF NOT EXISTS app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_number INTEGER UNIQUE NOT NULL,
  version_display VARCHAR(32) NOT NULL,
  version_name VARCHAR(64) NOT NULL,
  android_version_code INTEGER NOT NULL,
  package_id VARCHAR(128) NOT NULL DEFAULT 'in.chandilservices.app',
  min_sdk INTEGER DEFAULT 24,
  target_sdk INTEGER DEFAULT 34,
  apk_storage_key VARCHAR(512) NOT NULL,
  file_size BIGINT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  changelog TEXT NOT NULL,
  release_status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (release_status IN ('draft', 'published', 'withdrawn')),
  is_latest BOOLEAN NOT NULL DEFAULT false,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  withdrawal_reason TEXT
);

-- Partial unique index ensuring only ONE published release is marked as is_latest
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_latest_release 
  ON app_releases (is_latest) 
  WHERE is_latest = true AND release_status = 'published';

CREATE INDEX IF NOT EXISTS idx_app_releases_status 
  ON app_releases (release_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_releases_release_number 
  ON app_releases (release_number DESC);

-- 2. Release Downloads Tracking Table
CREATE TABLE IF NOT EXISTS release_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES app_releases(id) ON DELETE CASCADE,
  ip_hash VARCHAR(64) NOT NULL,
  user_agent TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_downloads_release 
  ON release_downloads (release_id, downloaded_at DESC);

-- 3. Beta Feedback Table
CREATE TABLE IF NOT EXISTS beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(64) NOT NULL CHECK (category IN (
    'BUG_REPORT', 'UI_DESIGN', 'PERFORMANCE', 'AUTH', 'BOOKING', 'WORKER_EXPERIENCE', 'FEATURE_REQUEST', 'OTHER'
  )),
  app_version VARCHAR(64) NOT NULL,
  tester_role VARCHAR(32) NOT NULL CHECK (tester_role IN ('customer', 'worker', 'both')),
  device_model VARCHAR(128),
  android_version VARCHAR(64),
  author_name VARCHAR(100) NOT NULL,
  author_contact VARCHAR(100),
  screenshot_storage_key VARCHAR(512),
  screenshot_url VARCHAR(512),
  status VARCHAR(32) NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'FIXED', 'WONT_FIX'
  )),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_reported BOOLEAN NOT NULL DEFAULT false,
  report_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_status_category 
  ON beta_feedback (status, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at 
  ON beta_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_comments_count 
  ON beta_feedback (comments_count DESC, created_at DESC);

-- 4. Feedback Comments & Replies Table
CREATE TABLE IF NOT EXISTS beta_feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES beta_feedback(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES beta_feedback_comments(id) ON DELETE CASCADE,
  author_name VARCHAR(100) NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL,
  moderation_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED' CHECK (moderation_status IN ('APPROVED', 'PENDING', 'FLAGGED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_comments_feedback 
  ON beta_feedback_comments (feedback_id, created_at ASC);

-- 5. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
  ON admin_audit_logs (created_at DESC);
