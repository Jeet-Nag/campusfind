-- Migration 013: CampusFind Lost & Found schema and demo data

-- 1. Extend users table for student authentication
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- 2. Create campus_items table
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

-- 3. Create campus_claims table
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

-- 4. Indexes for performant search and filter
CREATE INDEX IF NOT EXISTS idx_campus_items_type ON campus_items(type);
CREATE INDEX IF NOT EXISTS idx_campus_items_status ON campus_items(status);
CREATE INDEX IF NOT EXISTS idx_campus_items_category ON campus_items(category);
CREATE INDEX IF NOT EXISTS idx_campus_items_location ON campus_items(location);
CREATE INDEX IF NOT EXISTS idx_campus_items_user_id ON campus_items(user_id);
CREATE INDEX IF NOT EXISTS idx_campus_items_created_at ON campus_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campus_claims_item_id ON campus_claims(item_id);
CREATE INDEX IF NOT EXISTS idx_campus_claims_claimant_id ON campus_claims(claimant_id);

-- 5. Seed default demo campus users
-- Password for all demo accounts: Password123!
INSERT INTO users (id, phone, full_name, role, preferred_language, is_active, email, student_id, password_hash)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', '9876543211', 'Alex Chen', 'customer', 'en', true, 'alex@campus.edu', 'CS-2024-0412', '3cc7848872469dfd9636f5960daff4b2:a4ce97a7be46cc9f63752cdeec84c4ff5423126ad13314a59ff6ffee6c8ed155b5b3bc808fd19cf14ce4b7a5f577f18ac7735215381276a93fd7ea5b1a1daba7'),
  ('b2222222-2222-2222-2222-222222222222', '9876543212', 'Priya Patel', 'customer', 'en', true, 'priya@campus.edu', 'BIO-2025-0891', '3cc7848872469dfd9636f5960daff4b2:a4ce97a7be46cc9f63752cdeec84c4ff5423126ad13314a59ff6ffee6c8ed155b5b3bc808fd19cf14ce4b7a5f577f18ac7735215381276a93fd7ea5b1a1daba7'),
  ('c3333333-3333-3333-3333-333333333333', '9876543213', 'Marcus Vance', 'customer', 'en', true, 'marcus@campus.edu', 'ENG-2023-1104', '3cc7848872469dfd9636f5960daff4b2:a4ce97a7be46cc9f63752cdeec84c4ff5423126ad13314a59ff6ffee6c8ed155b5b3bc808fd19cf14ce4b7a5f577f18ac7735215381276a93fd7ea5b1a1daba7')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed demo lost and found items
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
    'Main Library Front Desk',
    true,
    'Student ID number ends in 891. Name on card starts with P.',
    'open'
  ),
  (
    'd4444444-4444-4444-4444-444444444444',
    'b2222222-2222-2222-2222-222222222222',
    'lost',
    'AirPods Pro (2nd Gen) in White Case',
    'electronics',
    'Lost during lunchtime around the Student Union dining area. Has an orange silicone case cover.',
    'Student Union / Center',
    CURRENT_DATE - INTERVAL '3 days',
    'Campus Email or Claim on CampusFind',
    false,
    null,
    'claim_pending'
  ),
  (
    'd4444444-4444-4444-4444-444444444445',
    'a1111111-1111-1111-1111-111111111111',
    'found',
    'Leather Keychain with 3 Brass Keys and Bike Lock Fob',
    'keys_wallets',
    'Found under the oak tree on the Central Quad bench.',
    'Campus Green / Central Quad',
    CURRENT_DATE - INTERVAL '4 days',
    'Campus Security Office',
    false,
    null,
    'returned'
  )
ON CONFLICT (id) DO NOTHING;

-- 7. Seed demo claim for item 4 (AirPods)
INSERT INTO campus_claims (id, item_id, claimant_id, claimant_name, claimant_contact, distinguishing_feature, message, status)
VALUES
  (
    'e5555555-5555-5555-5555-555555555551',
    'd4444444-4444-4444-4444-444444444444',
    'c3333333-3333-3333-3333-333333333333',
    'Marcus Vance',
    'marcus@campus.edu',
    'The orange silicone case has a tiny bite mark on the lanyard loop from my puppy, and the left ear tip is size Small while right is Medium.',
    'I think someone turned them in at the cafeteria desk, let me know if these are yours!',
    'pending'
  )
ON CONFLICT (id) DO NOTHING;
