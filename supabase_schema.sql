-- SQL Schema for SchoolOS Subscription & License Management

-- 1. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID UNIQUE NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL DEFAULT 'Trial', -- 'Trial', 'Starter', 'Professional', 'Enterprise'
    billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
    status TEXT NOT NULL DEFAULT 'trial', -- 'trial', 'active', 'grace_period', 'expired', 'cancelled', 'suspended'
    trial_start TIMESTAMPTZ DEFAULT now(),
    trial_end TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
    subscription_start TIMESTAMPTZ,
    subscription_end TIMESTAMPTZ,
    days_remaining INT DEFAULT 14,
    is_active BOOLEAN DEFAULT true,
    grace_period_days INT DEFAULT 7,
    grace_period_end TIMESTAMPTZ DEFAULT (now() + interval '21 days'),
    max_students INT DEFAULT 20,
    max_teachers INT DEFAULT 5,
    max_admins INT DEFAULT 1,
    max_parents INT DEFAULT 40,
    max_branches INT DEFAULT 1,
    storage_limit NUMERIC DEFAULT 0.1, -- In GB
    payment_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Select policies: Allow users linked to the school or superadmins
CREATE POLICY "Allow select for school members" ON public.subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.school_memberships
            WHERE school_memberships.school_id = subscriptions.school_id
            AND school_memberships.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.school_memberships
            WHERE school_memberships.user_id = auth.uid()
            AND school_memberships.role = 'SuperAdmin'
        )
    );

-- Write policies: Allow SuperAdmins to perform write operations
CREATE POLICY "Allow write for SuperAdmins" ON public.subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.school_memberships
            WHERE school_memberships.user_id = auth.uid()
            AND school_memberships.role = 'SuperAdmin'
        )
    );

-- 2. Create subscription audit logs table
CREATE TABLE IF NOT EXISTS public.subscription_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'subscription_created', 'renewed', 'expired', 'cancelled', 'plan_changed', 'payment_recorded'
    previous_plan TEXT,
    new_plan TEXT,
    previous_status TEXT,
    new_status TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for audit logs
ALTER TABLE public.subscription_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select audit logs for school members" ON public.subscription_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.school_memberships
            WHERE school_memberships.school_id = subscription_audit_logs.school_id
            AND school_memberships.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.school_memberships
            WHERE school_memberships.user_id = auth.uid()
            AND school_memberships.role = 'SuperAdmin'
        )
    );

CREATE POLICY "Allow write audit logs for SuperAdmins" ON public.subscription_audit_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.school_memberships
            WHERE school_memberships.user_id = auth.uid()
            AND school_memberships.role = 'SuperAdmin'
        )
    );

-- 3. Add file_size column to documents table for storage calculation (default 5MB for existing entries)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 5000000;

-- 4. Seed default subscriptions for existing schools
INSERT INTO public.subscriptions (
    school_id,
    plan_name,
    billing_cycle,
    status,
    trial_start,
    trial_end,
    days_remaining,
    grace_period_days,
    grace_period_end,
    max_students,
    max_teachers,
    max_admins,
    max_parents,
    max_branches,
    storage_limit
)
SELECT 
    id,
    'Trial',
    'monthly',
    'trial',
    now(),
    (now() + interval '14 days'),
    14,
    7,
    (now() + interval '21 days'),
    20,
    5,
    1,
    40,
    1,
    0.1
FROM public.schools
ON CONFLICT (school_id) DO NOTHING;
