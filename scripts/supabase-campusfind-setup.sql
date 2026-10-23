-- ==============================================================================
-- CampusFind — Supabase Production Database Setup & Migration Script
-- Zero-Cost Deployment Target: Supabase Free Tier PostgreSQL
-- Safe for execution via Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Enable native UUID generation support
-- In modern PostgreSQL (13+), gen_random_uuid() is built into core pg_catalog.
-- We also ensure pgcrypto and uuid-ossp exist if legacy functions are called.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Define user_role enum if it does not already exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'provider', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Users table (supports student authentication with email, student_id, password_hash, and session token_version)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15),
    email VARCHAR(255) UNIQUE,
    student_id VARCHAR(100),
    password_hash VARCHAR(255),
    token_version INT NOT NULL DEFAULT 1,
    full_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'customer',
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'en',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure required columns exist if users table was previously created
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;

-- 4. Campus Items table (Lost & Found reports)
CREATE TABLE IF NOT EXISTS campus_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('lost', 'found')),
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(150) NOT NULL,
    date_occurred DATE NOT NULL,
    image_url TEXT,
    contact_method VARCHAR(255) NOT NULL,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    sensitive_details TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claim_pending', 'returned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Campus Claims table (Claims on found items)
CREATE TABLE IF NOT EXISTS campus_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES campus_items(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    claimant_name VARCHAR(100) NOT NULL,
    claimant_contact VARCHAR(255) NOT NULL,
    distinguishing_feature TEXT NOT NULL,
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    owner_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. High-performance indexes for search, filtering, and login
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_campus_items_type ON campus_items(type);
CREATE INDEX IF NOT EXISTS idx_campus_items_status ON campus_items(status);
CREATE INDEX IF NOT EXISTS idx_campus_items_category ON campus_items(category);
CREATE INDEX IF NOT EXISTS idx_campus_items_location ON campus_items(location);
CREATE INDEX IF NOT EXISTS idx_campus_items_user_id ON campus_items(user_id);
CREATE INDEX IF NOT EXISTS idx_campus_items_created_at ON campus_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campus_claims_item_id ON campus_claims(item_id);
CREATE INDEX IF NOT EXISTS idx_campus_claims_claimant_id ON campus_claims(claimant_id);

-- 7. Row Level Security (RLS) Configuration
-- ARCHITECTURAL NOTE:
-- The Fastify backend connects via direct PostgreSQL TCP connection (DATABASE_URL) as the
-- privileged 'postgres' role. In PostgreSQL, table owners and superusers have BYPASSRLS
-- privileges by default, so backend queries run uninhibited.
-- Enabling RLS on these tables ensures that Supabase's public HTTP PostgREST API (used by
-- external web clients with the anon key) cannot bypass the Fastify server to inspect
-- student passwords, private tokens, or sensitive claim distinguishing features.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_claims ENABLE ROW LEVEL SECURITY;

-- 8. Seed Demo Campus Accounts
-- Password for all demo accounts: Password123!
-- Hashed using Node.js crypto.scryptSync(password, salt, 64) with 16-byte hex salt
INSERT INTO users (id, phone, full_name, role, preferred_language, is_active, email, student_id, password_hash, token_version)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', '9876543211', 'Alex Chen', 'customer', 'en', true, 'alex@campus.edu', 'CS-2024-0412', '3cc7848872469dfd9636f5960daff4b2:a4ce97a7be46cc9f63752cdeec84c4ff5423126ad13314a59ff6ffee6c8ed155b5b3bc808fd19cf14ce4b7a5f577f18ac7735215381276a93fd7ea5b1a1daba7', 1),
  ('b2222222-2222-2222-2222-222222222222', '9876543212', 'Priya Patel', 'customer', 'en', true, 'priya@campus.edu', 'BIO-2025-0891', '3cc7848872469dfd9636f5960daff4b2:a4ce97a7be46cc9f63752cdeec84c4ff5423126ad13314a59ff6ffee6c8ed155b5b3bc808fd19cf14ce4b7a5f577f18ac7735215381276a93fd7ea5b1a1daba7', 1),
  ('c3333333-3333-3333-3333-333333333333', '9876543213', 'Marcus Vance', 'customer', 'en', true, 'marcus@campus.edu', 'ENG-2023-1104', '3cc7848872469dfd9636f5960daff4b2:a4ce97a7be46cc9f63752cdeec84c4ff5423126ad13314a59ff6ffee6c8ed155b5b3bc808fd19cf14ce4b7a5f577f18ac7735215381276a93fd7ea5b1a1daba7', 1)
ON CONFLICT (id) DO UPDATE SET
  token_version = EXCLUDED.token_version,
  password_hash = EXCLUDED.password_hash,
  email = EXCLUDED.email,
  student_id = EXCLUDED.student_id;

-- 9. Seed Demo Items
INSERT INTO campus_items (id, user_id, type, title, category, description, location, date_occurred, contact_method, is_sensitive, sensitive_details, status)
VALUES
  (
    'd4444444-4444-4444-4444-444444444441',
    'a1111111-1111-1111-1111-111111111111',
    'lost',
    'TI-84 Plus CE Graphing Calculator',
    'electronics',
    'Left in Science Complex Room 204 after Calculus lecture. Black color with slight silver scratch on back.',
    'Science & Engineering Complex',
    CURRENT_DATE - INTERVAL '1 day',
    'Campus Email / Portal Message',
    false,
    null,
    'open'
  ),
  (
    'd4444444-4444-4444-4444-444444444442',
    'b2222222-2222-2222-2222-222222222222',
    'found',
    'Blue Hydro Flask with Stickers',
    'accessories',
    'Found on the bench near the elliptical machines in the recreation gym. Decorated with national park stickers.',
    'Campus Recreation / Gym',
    CURRENT_DATE,
    'Handed to Rec Center Front Desk',
    false,
    null,
    'open'
  ),
  (
    'd4444444-4444-4444-4444-444444444443',
    'c3333333-3333-3333-3333-333333333333',
    'found',
    'Student Campus ID & Transit Card',
    'student_ids_cards',
    'Found near the 2nd-floor study carrels in Main Library. Safe at the front circulation desk.',
    'Main Library',
    CURRENT_DATE - INTERVAL '2 days',
    'Main Library Circulation Desk',
    true,
    'Student ID belongs to Department of Chemistry. Name on card starts with initial "R".',
    'open'
  )
ON CONFLICT (id) DO NOTHING;
