-- SQL Migration for SchoolOS AI Import Center

-- 1. import_jobs table
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    register_type TEXT NOT NULL, -- 'student', 'teacher', 'attendance', 'fee', 'exam', 'library', 'inventory'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    total_rows INT DEFAULT 0,
    imported_rows INT DEFAULT 0,
    failed_rows INT DEFAULT 0,
    updated_rows INT DEFAULT 0,
    skipped_rows INT DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for import_jobs
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow school members to view their import jobs" ON public.import_jobs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.school_memberships
            WHERE school_memberships.school_id = import_jobs.school_id
            AND school_memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "Allow write for school admins" ON public.import_jobs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.school_memberships
            WHERE school_memberships.school_id = import_jobs.school_id
            AND school_memberships.user_id = auth.uid()
            AND school_memberships.role IN ('Admin', 'SuperAdmin')
        )
    );

-- 2. import_files table
CREATE TABLE IF NOT EXISTS public.import_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size INT DEFAULT 0,
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for import_files
ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow school members to view import files" ON public.import_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.import_jobs
            JOIN public.school_memberships ON school_memberships.school_id = import_jobs.school_id
            WHERE import_jobs.id = import_files.job_id
            AND school_memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "Allow write import files for school admins" ON public.import_files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.import_jobs
            JOIN public.school_memberships ON school_memberships.school_id = import_jobs.school_id
            WHERE import_jobs.id = import_files.job_id
            AND school_memberships.user_id = auth.uid()
            AND school_memberships.role IN ('Admin', 'SuperAdmin')
        )
    );

-- 3. import_records table
CREATE TABLE IF NOT EXISTS public.import_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    file_id UUID REFERENCES public.import_files(id) ON DELETE SET NULL,
    row_index INT NOT NULL,
    raw_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'validated', 'imported', 'failed', 'skipped'
    validation_errors JSONB DEFAULT '[]',
    confidence_scores JSONB DEFAULT '{}',
    resolution_action TEXT DEFAULT 'create', -- 'skip', 'update', 'replace', 'create'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for import_records
ALTER TABLE public.import_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow view import records for school members" ON public.import_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.import_jobs
            JOIN public.school_memberships ON school_memberships.school_id = import_jobs.school_id
            WHERE import_jobs.id = import_records.job_id
            AND school_memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "Allow write import records for school admins" ON public.import_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.import_jobs
            JOIN public.school_memberships ON school_memberships.school_id = import_jobs.school_id
            WHERE import_jobs.id = import_records.job_id
            AND school_memberships.user_id = auth.uid()
            AND school_memberships.role IN ('Admin', 'SuperAdmin')
        )
    );

-- 4. import_errors table
CREATE TABLE IF NOT EXISTS public.import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    row_index INT NOT NULL,
    error_message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for import_errors
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow view import errors for school members" ON public.import_errors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.import_jobs
            JOIN public.school_memberships ON school_memberships.school_id = import_jobs.school_id
            WHERE import_jobs.id = import_errors.job_id
            AND school_memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "Allow write import errors for school admins" ON public.import_errors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.import_jobs
            JOIN public.school_memberships ON school_memberships.school_id = import_jobs.school_id
            WHERE import_jobs.id = import_errors.job_id
            AND school_memberships.user_id = auth.uid()
            AND school_memberships.role IN ('Admin', 'SuperAdmin')
        )
    );

-- 5. import_logs table
CREATE TABLE IF NOT EXISTS public.import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for import_logs
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow view import logs for school members" ON public.import_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.import_jobs
            JOIN public.school_memberships ON school_memberships.school_id = import_jobs.school_id
            WHERE import_jobs.id = import_logs.job_id
            AND school_memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "Allow write import logs for school admins" ON public.import_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.import_jobs
            JOIN public.school_memberships ON school_memberships.school_id = import_jobs.school_id
            WHERE import_jobs.id = import_logs.job_id
            AND school_memberships.user_id = auth.uid()
            AND school_memberships.role IN ('Admin', 'SuperAdmin')
        )
    );

-- 6. RPC Function to increment counters dynamically
CREATE OR REPLACE FUNCTION public.increment_import_counter(job_id UUID, field_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('UPDATE public.import_jobs SET %I = %I + 1, updated_at = now() WHERE id = $1', field_name, field_name)
    USING job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

