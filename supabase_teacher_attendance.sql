-- ========================================================
-- SCHOOLOS TEACHER ATTENDANCE MODULE MIGRATION
-- ========================================================

-- 1. CREATE TEACHER ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE')),
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    remarks TEXT,
    marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_school_teacher_date UNIQUE (school_id, teacher_id, attendance_date)
);

-- 2. CREATE TEACHER ATTENDANCE CORRECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.teacher_attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    attendance_id UUID REFERENCES public.teacher_attendance(id) ON DELETE SET NULL,
    attendance_date DATE NOT NULL,
    current_status TEXT NOT NULL,
    requested_status TEXT NOT NULL CHECK (requested_status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE')),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CREATE TEACHER ATTENDANCE AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.teacher_attendance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    attendance_id UUID REFERENCES public.teacher_attendance(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'CHECK_IN', 'CHECK_OUT', 'ADMIN_MARK', 'ADMIN_CORRECT', 'CORRECTION_APPROVED', 'CORRECTION_REJECTED'
    previous_status TEXT,
    new_status TEXT,
    previous_check_in TIMESTAMP WITH TIME ZONE,
    new_check_in TIMESTAMP WITH TIME ZONE,
    previous_check_out TIMESTAMP WITH TIME ZONE,
    new_check_out TIMESTAMP WITH TIME ZONE,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school_date 
    ON public.teacher_attendance (school_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher_date 
    ON public.teacher_attendance (teacher_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_corrections_school_status 
    ON public.teacher_attendance_corrections (school_id, status);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. DROP EXISTING POLICIES IF RE-RUNNING
DROP POLICY IF EXISTS "Select teacher attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Insert teacher attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Update teacher attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Delete teacher attendance" ON public.teacher_attendance;

DROP POLICY IF EXISTS "Select teacher attendance corrections" ON public.teacher_attendance_corrections;
DROP POLICY IF EXISTS "Insert teacher attendance corrections" ON public.teacher_attendance_corrections;
DROP POLICY IF EXISTS "Update teacher attendance corrections" ON public.teacher_attendance_corrections;

DROP POLICY IF EXISTS "Select teacher attendance audit logs" ON public.teacher_attendance_audit_logs;
DROP POLICY IF EXISTS "Insert teacher attendance audit logs" ON public.teacher_attendance_audit_logs;

-- 7. RLS POLICIES FOR TEACHER ATTENDANCE
-- Read policy: Teachers can read their own attendance; Admins/SuperAdmins can read all for their school.
CREATE POLICY "Select teacher attendance" ON public.teacher_attendance
    FOR SELECT
    USING (
        public.check_user_is_school_admin(auth.uid(), school_id)
        OR public.check_user_is_super_admin(auth.uid())
        OR teacher_id IN (
            SELECT id FROM public.staff 
            WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
              AND school_id = teacher_attendance.school_id
        )
        OR public.check_user_is_school_member(auth.uid(), school_id)
    );

-- Insert policy: Teachers can insert today's record for themselves; Admins/SuperAdmins can insert for any staff in their school.
CREATE POLICY "Insert teacher attendance" ON public.teacher_attendance
    FOR INSERT
    WITH CHECK (
        public.check_user_is_school_admin(auth.uid(), school_id)
        OR public.check_user_is_super_admin(auth.uid())
        OR (
            teacher_id IN (
                SELECT id FROM public.staff 
                WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
                  AND school_id = teacher_attendance.school_id
            )
            AND public.check_user_is_school_member(auth.uid(), school_id)
        )
    );

-- Update policy: Admins/SuperAdmins can update; Teachers can update today's own record (for check-out).
CREATE POLICY "Update teacher attendance" ON public.teacher_attendance
    FOR UPDATE
    USING (
        public.check_user_is_school_admin(auth.uid(), school_id)
        OR public.check_user_is_super_admin(auth.uid())
        OR (
            teacher_id IN (
                SELECT id FROM public.staff 
                WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
                  AND school_id = teacher_attendance.school_id
            )
            AND public.check_user_is_school_member(auth.uid(), school_id)
        )
    );

-- Delete policy: Only Admins or SuperAdmins
CREATE POLICY "Delete teacher attendance" ON public.teacher_attendance
    FOR DELETE
    USING (
        public.check_user_is_school_admin(auth.uid(), school_id)
        OR public.check_user_is_super_admin(auth.uid())
    );

-- 8. RLS POLICIES FOR CORRECTIONS
CREATE POLICY "Select teacher attendance corrections" ON public.teacher_attendance_corrections
    FOR SELECT
    USING (
        public.check_user_is_school_admin(auth.uid(), school_id)
        OR public.check_user_is_super_admin(auth.uid())
        OR teacher_id IN (
            SELECT id FROM public.staff 
            WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
              AND school_id = teacher_attendance_corrections.school_id
        )
        OR public.check_user_is_school_member(auth.uid(), school_id)
    );

CREATE POLICY "Insert teacher attendance corrections" ON public.teacher_attendance_corrections
    FOR INSERT
    WITH CHECK (
        public.check_user_is_school_member(auth.uid(), school_id)
    );

CREATE POLICY "Update teacher attendance corrections" ON public.teacher_attendance_corrections
    FOR UPDATE
    USING (
        public.check_user_is_school_admin(auth.uid(), school_id)
        OR public.check_user_is_super_admin(auth.uid())
    );

-- 9. RLS POLICIES FOR AUDIT LOGS
CREATE POLICY "Select teacher attendance audit logs" ON public.teacher_attendance_audit_logs
    FOR SELECT
    USING (
        public.check_user_is_school_member(auth.uid(), school_id)
    );

CREATE POLICY "Insert teacher attendance audit logs" ON public.teacher_attendance_audit_logs
    FOR INSERT
    WITH CHECK (
        public.check_user_is_school_member(auth.uid(), school_id)
    );
