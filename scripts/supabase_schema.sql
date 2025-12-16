
-- 1. Create table for mobile_otps (Replacing MongoDB)
CREATE TABLE IF NOT EXISTS public.mobile_otps (
    phone text PRIMARY KEY,
    otp text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. Enable RLS (Row Level Security) - optional but good practice
ALTER TABLE public.mobile_otps ENABLE ROW LEVEL SECURITY;

-- 3. Create policy to allow service role (backend) full access
CREATE POLICY "Service role full access to otps" ON public.mobile_otps
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Update app_users table to support Google Auth
ALTER TABLE public.app_users 
ADD COLUMN IF NOT EXISTS google_id text UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url text;

-- 5. Add index for faster google_id lookups
CREATE INDEX IF NOT EXISTS idx_app_users_google_id ON public.app_users(google_id);

-- Instructions:
-- Run this script in the Supabase SQL Editor.
