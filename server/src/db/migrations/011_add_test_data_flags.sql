-- Migration: 011_add_test_data_flags
-- Purpose: Add is_test boolean flags to users and bookings tables to safely segregate test data from production operational data.

-- 1. Add is_test column to users table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_test'
    ) THEN
        ALTER TABLE users ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 2. Add is_test column to bookings table
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'is_test'
    ) THEN
        ALTER TABLE bookings ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 3. Create indexes for efficient filtering and cleanup of test data
CREATE INDEX IF NOT EXISTS idx_users_is_test ON users(is_test);
CREATE INDEX IF NOT EXISTS idx_bookings_is_test ON bookings(is_test);
