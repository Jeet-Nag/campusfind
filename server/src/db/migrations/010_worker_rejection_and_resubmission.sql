-- Migration: 010_worker_rejection_and_resubmission
-- Purpose: Add rejection reason, rejected_at timestamp, and rejected_by audit columns to provider_profiles.

-- 1. Add rejection_reason column
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'provider_profiles' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE provider_profiles ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- 2. Add rejected_at and rejected_by audit columns
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'provider_profiles' AND column_name = 'rejected_at'
    ) THEN
        ALTER TABLE provider_profiles ADD COLUMN rejected_at TIMESTAMPTZ;
        ALTER TABLE provider_profiles ADD COLUMN rejected_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
