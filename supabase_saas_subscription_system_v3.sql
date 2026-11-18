-- ========================================================
-- SCHOOLOS DYNAMIC SUBSCRIPTION & RESOURCE LIMITING (V3)
-- ========================================================

-- 1. Create Core Tables
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL, -- 'Trial', 'Starter', 'Professional', 'Enterprise', 'Custom'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.plan_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    limit_key TEXT NOT NULL, -- e.g. 'students', 'teachers', 'parents', 'admins', 'classes', 'file_storage', 'ai_credits', 'whatsapp_messages', etc.
    limit_value INT NOT NULL, -- -1 for unlimited, or specific limits
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_plan_limit UNIQUE (plan_id, limit_key)
);

CREATE TABLE IF NOT EXISTS public.plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    feature_code TEXT NOT NULL, -- e.g. 'ai_assistant', 'parent_portal', 'library', 'transport', 'payroll', 'inventory', 'hostel', 'online_classes', 'biometric_attendance', 'whatsapp_integration', 'sms', 'email', 'analytics', 'custom_reports', 'public_api', 'white_label_branding'
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_plan_feature UNIQUE (plan_id, feature_code)
);

-- Alter subscriptions to link to dynamic plans
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.subscription_limit_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    limit_key TEXT NOT NULL,
    limit_value INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_sub_limit_override UNIQUE (subscription_id, limit_key)
);

CREATE TABLE IF NOT EXISTS public.subscription_feature_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    feature_code TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_sub_feature_override UNIQUE (subscription_id, feature_code)
);

CREATE TABLE IF NOT EXISTS public.school_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    metric_key TEXT NOT NULL, -- e.g. 'ai_credits_used', 'whatsapp_messages_sent', 'email_notifications_sent', 'sms_notifications_sent'
    current_value NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_school_usage UNIQUE (school_id, metric_key)
);

-- Enable RLS for all new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_limit_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_usage ENABLE ROW LEVEL SECURITY;

-- 2. Setup RLS Policies (Allow SuperAdmin write, Allow School Members read where appropriate)
-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow select for everyone" ON public.subscription_plans;
DROP POLICY IF EXISTS "Allow write for SuperAdmins" ON public.subscription_plans;
DROP POLICY IF EXISTS "Allow select for everyone" ON public.plan_limits;
DROP POLICY IF EXISTS "Allow write for SuperAdmins" ON public.plan_limits;
DROP POLICY IF EXISTS "Allow select for everyone" ON public.plan_features;
DROP POLICY IF EXISTS "Allow write for SuperAdmins" ON public.plan_features;
DROP POLICY IF EXISTS "Allow select for school members" ON public.subscription_limit_overrides;
DROP POLICY IF EXISTS "Allow write for SuperAdmins" ON public.subscription_limit_overrides;
DROP POLICY IF EXISTS "Allow select for school members" ON public.subscription_feature_overrides;
DROP POLICY IF EXISTS "Allow write for SuperAdmins" ON public.subscription_feature_overrides;
DROP POLICY IF EXISTS "Allow select for school members" ON public.school_usage;
DROP POLICY IF EXISTS "Allow write for school members/SuperAdmins" ON public.school_usage;

-- Policies for subscription_plans
CREATE POLICY "Allow select for everyone" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Allow write for SuperAdmins" ON public.subscription_plans FOR ALL USING (public.check_user_is_super_admin(auth.uid()));

-- Policies for plan_limits
CREATE POLICY "Allow select for everyone" ON public.plan_limits FOR SELECT USING (true);
CREATE POLICY "Allow write for SuperAdmins" ON public.plan_limits FOR ALL USING (public.check_user_is_super_admin(auth.uid()));

-- Policies for plan_features
CREATE POLICY "Allow select for everyone" ON public.plan_features FOR SELECT USING (true);
CREATE POLICY "Allow write for SuperAdmins" ON public.plan_features FOR ALL USING (public.check_user_is_super_admin(auth.uid()));

-- Policies for subscription_limit_overrides
CREATE POLICY "Allow select for school members" ON public.subscription_limit_overrides FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.id = subscription_id AND (
            public.check_user_is_school_member(auth.uid(), s.school_id)
            OR public.check_user_is_super_admin(auth.uid())
        )
    )
);
CREATE POLICY "Allow write for SuperAdmins" ON public.subscription_limit_overrides FOR ALL USING (public.check_user_is_super_admin(auth.uid()));

-- Policies for subscription_feature_overrides
CREATE POLICY "Allow select for school members" ON public.subscription_feature_overrides FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.id = subscription_id AND (
            public.check_user_is_school_member(auth.uid(), s.school_id)
            OR public.check_user_is_super_admin(auth.uid())
        )
    )
);
CREATE POLICY "Allow write for SuperAdmins" ON public.subscription_feature_overrides FOR ALL USING (public.check_user_is_super_admin(auth.uid()));

-- Policies for school_usage
CREATE POLICY "Allow select for school members" ON public.school_usage FOR SELECT USING (
    public.check_user_is_school_member(auth.uid(), school_id)
    OR public.check_user_is_super_admin(auth.uid())
);
CREATE POLICY "Allow write for school members/SuperAdmins" ON public.school_usage FOR ALL USING (
    public.check_user_is_school_member(auth.uid(), school_id)
    OR public.check_user_is_super_admin(auth.uid())
);

-- ========================================================
-- 3. Dynamic Calculation Helper Functions
-- ========================================================

-- Resolve Effective Limit (respecting overrides)
CREATE OR REPLACE FUNCTION public.get_school_limit(p_school_id UUID, p_limit_key TEXT)
RETURNS INT AS $$
DECLARE
  v_limit INT;
  v_sub_id UUID;
  v_plan_id UUID;
  v_status TEXT;
BEGIN
  -- Get active subscription for school
  SELECT id, plan_id, status INTO v_sub_id, v_plan_id, v_status FROM public.subscriptions WHERE school_id = p_school_id LIMIT 1;
  
  IF v_sub_id IS NULL THEN
    RETURN 0; -- No subscription = zero resource allowances
  END IF;

  -- Expired or Suspended subscriptions allow 0 limits on everything
  IF v_status = 'expired' OR v_status = 'suspended' THEN
    RETURN 0;
  END IF;

  -- Check if override exists
  SELECT limit_value INTO v_limit FROM public.subscription_limit_overrides 
  WHERE subscription_id = v_sub_id AND limit_key = p_limit_key LIMIT 1;

  IF v_limit IS NOT NULL THEN
    RETURN v_limit;
  END IF;

  -- Check plan limit
  SELECT limit_value INTO v_limit FROM public.plan_limits 
  WHERE plan_id = v_plan_id AND limit_key = p_limit_key LIMIT 1;

  IF v_limit IS NOT NULL THEN
    RETURN v_limit;
  END IF;

  RETURN 0; -- Default fallback
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resolve Effective Feature (respecting overrides)
CREATE OR REPLACE FUNCTION public.get_school_feature_enabled(p_school_id UUID, p_feature_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
  v_sub_id UUID;
  v_plan_id UUID;
  v_status TEXT;
BEGIN
  -- Get active subscription details
  SELECT id, plan_id, status INTO v_sub_id, v_plan_id, v_status FROM public.subscriptions WHERE school_id = p_school_id LIMIT 1;
  
  IF v_sub_id IS NULL THEN
    RETURN FALSE; -- No subscription = no features
  END IF;

  -- Expired or Suspended subscriptions have all features blocked
  IF v_status = 'expired' OR v_status = 'suspended' THEN
    RETURN FALSE;
  END IF;

  -- Check override
  SELECT is_enabled INTO v_enabled FROM public.subscription_feature_overrides 
  WHERE subscription_id = v_sub_id AND feature_code = p_feature_code LIMIT 1;

  IF v_enabled IS NOT NULL THEN
    RETURN v_enabled;
  END IF;

  -- Check plan
  SELECT is_enabled INTO v_enabled FROM public.plan_features 
  WHERE plan_id = v_plan_id AND feature_code = p_feature_code LIMIT 1;

  IF v_enabled IS NOT NULL THEN
    RETURN v_enabled;
  END IF;

  RETURN FALSE; -- Default fallback
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check and increment transactional usage safely
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(p_school_id UUID, p_metric_key TEXT, p_increment NUMERIC)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit INT;
  v_current NUMERIC;
BEGIN
  -- Get limit
  v_limit := public.get_school_limit(p_school_id, p_metric_key);
  
  -- Get current usage
  SELECT COALESCE(current_value, 0) INTO v_current FROM public.school_usage 
  WHERE school_id = p_school_id AND metric_key = p_metric_key;
  
  -- -1 means unlimited
  IF v_limit <> -1 AND (v_current + p_increment) > v_limit THEN
    RETURN FALSE; -- Blocked
  END IF;
  
  -- Upsert usage record
  INSERT INTO public.school_usage (school_id, metric_key, current_value, updated_at)
  VALUES (p_school_id, p_metric_key, v_current + p_increment, now())
  ON CONFLICT (school_id, metric_key) DO UPDATE
  SET current_value = public.school_usage.current_value + p_increment, updated_at = now();
  
  RETURN TRUE; -- Allowed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rich helper to get all metrics usage stats for a school in a single query
CREATE OR REPLACE FUNCTION public.get_school_usage_stats(p_school_id UUID)
RETURNS TABLE (
  students_limit INT, students_used INT,
  teachers_limit INT, teachers_used INT,
  admins_limit INT, admins_used INT,
  parents_limit INT, parents_used INT,
  classes_limit INT, classes_used INT,
  storage_limit_gb NUMERIC, storage_used_gb NUMERIC,
  ai_limit INT, ai_used INT,
  whatsapp_limit INT, whatsapp_used INT,
  email_limit INT, email_used INT,
  sms_limit INT, sms_used INT
) AS $$
DECLARE
  v_storage_bytes BIGINT;
BEGIN
  -- 1. Query dynamic database counts
  SELECT COUNT(*) INTO students_used FROM public.students WHERE school_id = p_school_id;
  SELECT COUNT(*) INTO teachers_used FROM public.staff WHERE school_id = p_school_id AND role = 'Teacher';
  SELECT COUNT(*) INTO admins_used FROM public.school_memberships WHERE school_id = p_school_id AND role = 'Admin';
  SELECT COUNT(*) INTO parents_used FROM public.school_memberships WHERE school_id = p_school_id AND role = 'Parent';
  
  -- Safely count classes (check if classes table exists)
  BEGIN
    SELECT COUNT(*) INTO classes_used FROM public.classes WHERE school_id = p_school_id;
  EXCEPTION WHEN OTHERS THEN
    classes_used := 0;
  END;

  -- 2. Storage calculation from document file sizes
  SELECT COALESCE(SUM(file_size), 0) INTO v_storage_bytes FROM public.documents WHERE school_id = p_school_id;
  storage_used_gb := ROUND((v_storage_bytes::NUMERIC / (1024 * 1024 * 1024)), 3);

  -- 3. Load transactional limits and usage
  SELECT COALESCE(current_value, 0)::INT INTO ai_used FROM public.school_usage WHERE school_id = p_school_id AND metric_key = 'ai_credits';
  SELECT COALESCE(current_value, 0)::INT INTO whatsapp_used FROM public.school_usage WHERE school_id = p_school_id AND metric_key = 'whatsapp_messages';
  SELECT COALESCE(current_value, 0)::INT INTO email_used FROM public.school_usage WHERE school_id = p_school_id AND metric_key = 'email_notifications';
  SELECT COALESCE(current_value, 0)::INT INTO sms_used FROM public.school_usage WHERE school_id = p_school_id AND metric_key = 'sms_notifications';

  -- 4. Resolve limits
  students_limit := public.get_school_limit(p_school_id, 'students');
  teachers_limit := public.get_school_limit(p_school_id, 'teachers');
  admins_limit   := public.get_school_limit(p_school_id, 'admins');
  parents_limit  := public.get_school_limit(p_school_id, 'parents');
  classes_limit  := public.get_school_limit(p_school_id, 'classes');
  storage_limit_gb := public.get_school_limit(p_school_id, 'file_storage');
  ai_limit       := public.get_school_limit(p_school_id, 'ai_credits');
  whatsapp_limit := public.get_school_limit(p_school_id, 'whatsapp_messages');
  email_limit    := public.get_school_limit(p_school_id, 'email_notifications');
  sms_limit      := public.get_school_limit(p_school_id, 'sms_notifications');

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ========================================================
-- 4. Row Level Insertion Triggers
-- ========================================================

-- A. Student Trigger
CREATE OR REPLACE FUNCTION public.enforce_student_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INT;
  v_count INT;
BEGIN
  v_limit := public.get_school_limit(NEW.school_id, 'students');
  SELECT COUNT(*) INTO v_count FROM public.students WHERE school_id = NEW.school_id;
  
  IF v_limit <> -1 AND v_count >= v_limit THEN
    RAISE EXCEPTION 'Student Limit Reached: Your current subscription only permits up to % students. Upgrade Plan', v_limit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_enforce_student_limit ON public.students;
CREATE TRIGGER tr_enforce_student_limit
BEFORE INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_limit();


-- B. Teacher/Staff Trigger
CREATE OR REPLACE FUNCTION public.enforce_teacher_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INT;
  v_count INT;
BEGIN
  IF NEW.role <> 'Teacher' THEN
    RETURN NEW;
  END IF;
  
  v_limit := public.get_school_limit(NEW.school_id, 'teachers');
  SELECT COUNT(*) INTO v_count FROM public.staff WHERE school_id = NEW.school_id AND role = 'Teacher';
  
  IF v_limit <> -1 AND v_count >= v_limit THEN
    RAISE EXCEPTION 'Teacher Limit Reached: Your current subscription only permits up to % teachers. Upgrade Plan', v_limit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_enforce_teacher_limit ON public.staff;
CREATE TRIGGER tr_enforce_teacher_limit
BEFORE INSERT ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.enforce_teacher_limit();


-- C. Admin Trigger (School memberships)
CREATE OR REPLACE FUNCTION public.enforce_admin_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INT;
  v_count INT;
BEGIN
  IF NEW.role <> 'Admin' THEN
    RETURN NEW;
  END IF;
  
  v_limit := public.get_school_limit(NEW.school_id, 'admins');
  SELECT COUNT(*) INTO v_count FROM public.school_memberships WHERE school_id = NEW.school_id AND role = 'Admin';
  
  IF v_limit <> -1 AND v_count >= v_limit THEN
    RAISE EXCEPTION 'Administrator Limit Reached: Your current subscription only permits up to % admins. Upgrade Plan', v_limit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_enforce_admin_limit ON public.school_memberships;
CREATE TRIGGER tr_enforce_admin_limit
BEFORE INSERT ON public.school_memberships
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_limit();


-- D. Classes Trigger
CREATE OR REPLACE FUNCTION public.enforce_classes_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INT;
  v_count INT;
BEGIN
  v_limit := public.get_school_limit(NEW.school_id, 'classes');
  SELECT COUNT(*) INTO v_count FROM public.classes WHERE school_id = NEW.school_id;
  
  IF v_limit <> -1 AND v_count >= v_limit THEN
    RAISE EXCEPTION 'Classes Limit Reached: Your current subscription only permits up to % classes. Upgrade Plan', v_limit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_enforce_classes_limit ON public.classes;
CREATE TRIGGER tr_enforce_classes_limit
BEFORE INSERT ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.enforce_classes_limit();


-- E. Documents Storage Trigger
CREATE OR REPLACE FUNCTION public.enforce_storage_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit_gb NUMERIC;
  v_used_bytes BIGINT;
  v_used_gb NUMERIC;
BEGIN
  v_limit_gb := public.get_school_limit(NEW.school_id, 'file_storage');
  IF v_limit_gb = -1 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(file_size), 0) INTO v_used_bytes FROM public.documents WHERE school_id = NEW.school_id;
  -- Append size of newly uploaded document
  v_used_bytes := v_used_bytes + COALESCE(NEW.file_size, 0);
  v_used_gb := v_used_bytes::NUMERIC / (1024 * 1024 * 1024);

  IF v_used_gb > v_limit_gb THEN
    RAISE EXCEPTION 'Storage Limit Reached: Your current subscription only permits up to % GB. Used: % GB. Upgrade Plan', v_limit_gb, ROUND(v_used_gb, 3);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_enforce_storage_limit ON public.documents;
CREATE TRIGGER tr_enforce_storage_limit
BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_limit();


-- F. Homework Monthly Trigger
CREATE OR REPLACE FUNCTION public.enforce_homework_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INT;
  v_count INT;
BEGIN
  v_limit := public.get_school_limit(NEW.school_id, 'homework_per_month');
  
  -- Count homework assignments published within current calendar month
  SELECT COUNT(*) INTO v_count FROM public.homework 
  WHERE school_id = NEW.school_id 
    AND created_at >= date_trunc('month', now());

  IF v_limit <> -1 AND v_count >= v_limit THEN
    RAISE EXCEPTION 'Homework Assignment Limit Reached: Your current subscription only permits up to % assignments per month. Upgrade Plan', v_limit;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_enforce_homework_limit ON public.homework;
CREATE TRIGGER tr_enforce_homework_limit
BEFORE INSERT ON public.homework
FOR EACH ROW EXECUTE FUNCTION public.enforce_homework_limit();


-- G. Feature Flag Database Guard (Blocks table inserts if feature is disabled)
-- Library Feature Guard
CREATE OR REPLACE FUNCTION public.guard_library_feature()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.get_school_feature_enabled(NEW.school_id, 'library') THEN
    RAISE EXCEPTION 'Access Denied: The Library module is not enabled on your subscription plan. Upgrade Plan';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Transport Feature Guard
CREATE OR REPLACE FUNCTION public.guard_transport_feature()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.get_school_feature_enabled(NEW.school_id, 'transport') THEN
    RAISE EXCEPTION 'Access Denied: The Transport module is not enabled on your subscription plan. Upgrade Plan';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ========================================================
-- 5. Seed Core Plan Definitions
-- ========================================================

-- Insert plans if they do not exist
INSERT INTO public.subscription_plans (id, name, description)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Trial', '14-Day dynamic trial plan for setting up and exploring SchoolOS.'),
    ('22222222-2222-2222-2222-222222222222', 'Starter', 'Essential school administration capabilities for small schools.'),
    ('33333333-3333-3333-3333-333333333333', 'Professional', 'Advanced administration, integrations and communication toolkit.'),
    ('44444444-4444-4444-4444-444444444444', 'Enterprise', 'Platform-wide full features, scale and priority developer support.'),
    ('55555555-5555-5555-5555-555555555555', 'Custom', 'SaaS plan with custom limits and feature setups tailored for specific schools.')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Seed Plan Limits
-- Trial Limits
INSERT INTO public.plan_limits (plan_id, limit_key, limit_value) VALUES
    ('11111111-1111-1111-1111-111111111111', 'students', 20),
    ('11111111-1111-1111-1111-111111111111', 'teachers', 5),
    ('11111111-1111-1111-1111-111111111111', 'admins', 1),
    ('11111111-1111-1111-1111-111111111111', 'parents', 40),
    ('11111111-1111-1111-1111-111111111111', 'classes', 5),
    ('11111111-1111-1111-1111-111111111111', 'file_storage', 0.1), -- 100MB in GB
    ('11111111-1111-1111-1111-111111111111', 'ai_credits', 100),
    ('11111111-1111-1111-1111-111111111111', 'whatsapp_messages', 50),
    ('11111111-1111-1111-1111-111111111111', 'homework_per_month', 30),
    ('11111111-1111-1111-1111-111111111111', 'branches', 1)
ON CONFLICT (plan_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value;

-- Starter Limits
INSERT INTO public.plan_limits (plan_id, limit_key, limit_value) VALUES
    ('22222222-2222-2222-2222-222222222222', 'students', 200),
    ('22222222-2222-2222-2222-222222222222', 'teachers', 20),
    ('22222222-2222-2222-2222-222222222222', 'admins', 3),
    ('22222222-2222-2222-2222-222222222222', 'parents', 400),
    ('22222222-2222-2222-2222-222222222222', 'classes', 10),
    ('22222222-2222-2222-2222-222222222222', 'file_storage', 2.0), -- 2GB
    ('22222222-2222-2222-2222-222222222222', 'ai_credits', 2000),
    ('22222222-2222-2222-2222-222222222222', 'whatsapp_messages', 500),
    ('22222222-2222-2222-2222-222222222222', 'homework_per_month', -1), -- Unlimited
    ('22222222-2222-2222-2222-222222222222', 'branches', 1)
ON CONFLICT (plan_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value;

-- Professional Limits
INSERT INTO public.plan_limits (plan_id, limit_key, limit_value) VALUES
    ('33333333-3333-3333-3333-333333333333', 'students', 1000),
    ('33333333-3333-3333-3333-333333333333', 'teachers', 100),
    ('33333333-3333-3333-3333-333333333333', 'admins', 10),
    ('33333333-3333-3333-3333-333333333333', 'parents', 2000),
    ('33333333-3333-3333-3333-333333333333', 'classes', -1), -- Unlimited
    ('33333333-3333-3333-3333-333333333333', 'file_storage', 15.0), -- 15GB
    ('33333333-3333-3333-3333-333333333333', 'ai_credits', 15000),
    ('33333333-3333-3333-3333-333333333333', 'whatsapp_messages', 5000),
    ('33333333-3333-3333-3333-333333333333', 'homework_per_month', -1),
    ('33333333-3333-3333-3333-333333333333', 'branches', 5)
ON CONFLICT (plan_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value;

-- Enterprise Limits (Unlimited Everything)
INSERT INTO public.plan_limits (plan_id, limit_key, limit_value) VALUES
    ('44444444-4444-4444-4444-444444444444', 'students', -1),
    ('44444444-4444-4444-4444-444444444444', 'teachers', -1),
    ('44444444-4444-4444-4444-444444444444', 'admins', -1),
    ('44444444-4444-4444-4444-444444444444', 'parents', -1),
    ('44444444-4444-4444-4444-444444444444', 'classes', -1),
    ('44444444-4444-4444-4444-444444444444', 'file_storage', 100.0), -- 100GB
    ('44444444-4444-4444-4444-444444444444', 'ai_credits', -1),
    ('44444444-4444-4444-4444-444444444444', 'whatsapp_messages', -1),
    ('44444444-4444-4444-4444-444444444444', 'homework_per_month', -1),
    ('44444444-4444-4444-4444-444444444444', 'branches', 20)
ON CONFLICT (plan_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value;


-- Seed Plan Feature Flags
-- Trial Features
INSERT INTO public.plan_features (plan_id, feature_code, is_enabled) VALUES
    ('11111111-1111-1111-1111-111111111111', 'parent_portal', true),
    ('11111111-1111-1111-1111-111111111111', 'email', true),
    ('11111111-1111-1111-1111-111111111111', 'ai_assistant', true),
    ('11111111-1111-1111-1111-111111111111', 'library', false),
    ('11111111-1111-1111-1111-111111111111', 'transport', false),
    ('11111111-1111-1111-1111-111111111111', 'analytics', false),
    ('11111111-1111-1111-1111-111111111111', 'custom_reports', false),
    ('11111111-1111-1111-1111-111111111111', 'public_api', false),
    ('11111111-1111-1111-1111-111111111111', 'white_label_branding', false)
ON CONFLICT (plan_id, feature_code) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- Starter Features
INSERT INTO public.plan_features (plan_id, feature_code, is_enabled) VALUES
    ('22222222-2222-2222-2222-222222222222', 'parent_portal', true),
    ('22222222-2222-2222-2222-222222222222', 'email', true),
    ('22222222-2222-2222-2222-222222222222', 'sms', true),
    ('22222222-2222-2222-2222-222222222222', 'ai_assistant', true),
    ('22222222-2222-2222-2222-222222222222', 'library', false),
    ('22222222-2222-2222-2222-222222222222', 'transport', false),
    ('22222222-2222-2222-2222-222222222222', 'analytics', false),
    ('22222222-2222-2222-2222-222222222222', 'custom_reports', false),
    ('22222222-2222-2222-2222-222222222222', 'public_api', false),
    ('22222222-2222-2222-2222-222222222222', 'white_label_branding', false)
ON CONFLICT (plan_id, feature_code) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- Professional Features
INSERT INTO public.plan_features (plan_id, feature_code, is_enabled) VALUES
    ('33333333-3333-3333-3333-333333333333', 'parent_portal', true),
    ('33333333-3333-3333-3333-333333333333', 'email', true),
    ('33333333-3333-3333-3333-333333333333', 'sms', true),
    ('33333333-3333-3333-3333-333333333333', 'whatsapp_integration', true),
    ('33333333-3333-3333-3333-333333333333', 'ai_assistant', true),
    ('33333333-3333-3333-3333-333333333333', 'library', true),
    ('33333333-3333-3333-3333-333333333333', 'transport', true),
    ('33333333-3333-3333-3333-333333333333', 'analytics', true),
    ('33333333-3333-3333-3333-333333333333', 'custom_reports', true),
    ('33333333-3333-3333-3333-333333333333', 'public_api', false),
    ('33333333-3333-3333-3333-333333333333', 'white_label_branding', false)
ON CONFLICT (plan_id, feature_code) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- Enterprise Features
INSERT INTO public.plan_features (plan_id, feature_code, is_enabled) VALUES
    ('44444444-4444-4444-4444-444444444444', 'parent_portal', true),
    ('44444444-4444-4444-4444-444444444444', 'email', true),
    ('44444444-4444-4444-4444-444444444444', 'sms', true),
    ('44444444-4444-4444-4444-444444444444', 'whatsapp_integration', true),
    ('44444444-4444-4444-4444-444444444444', 'ai_assistant', true),
    ('44444444-4444-4444-4444-444444444444', 'library', true),
    ('44444444-4444-4444-4444-444444444444', 'transport', true),
    ('44444444-4444-4444-4444-444444444444', 'analytics', true),
    ('44444444-4444-4444-4444-444444444444', 'custom_reports', true),
    ('44444444-4444-4444-4444-444444444444', 'public_api', true),
    ('44444444-4444-4444-4444-444444444444', 'white_label_branding', true)
ON CONFLICT (plan_id, feature_code) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;


-- ========================================================
-- 6. Link Existing Subscriptions to Database Plans
-- ========================================================

UPDATE public.subscriptions
SET plan_id = (SELECT id FROM public.subscription_plans WHERE name = subscriptions.plan_name LIMIT 1)
WHERE plan_id IS NULL;

-- Default mapping in case of unlinked subscriptions (Fallback to Trial)
UPDATE public.subscriptions
SET plan_id = '11111111-1111-1111-1111-111111111111'
WHERE plan_id IS NULL;
