  -- ========================================================
  -- SCHOOLOS RELATIONAL & ROLE-BASED UPGRADE MIGRATION (V2)
  -- ========================================================

  -- Helper to check if a user is a Member of a given school
  CREATE OR REPLACE FUNCTION public.check_user_is_school_member(p_user_id UUID, p_school_id UUID)
  RETURNS BOOLEAN AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.school_memberships 
      WHERE user_id = p_user_id 
        AND school_id = p_school_id
    );
  $$ LANGUAGE sql SECURITY DEFINER;

  -- Helper to check if a user is an Admin of a given school
  CREATE OR REPLACE FUNCTION public.check_user_is_school_admin(p_user_id UUID, p_school_id UUID)
  RETURNS BOOLEAN AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.school_memberships 
      WHERE user_id = p_user_id 
        AND school_id = p_school_id 
        AND role = 'Admin'
    );
  $$ LANGUAGE sql SECURITY DEFINER;

  -- Helper to check if a user is a SuperAdmin
  CREATE OR REPLACE FUNCTION public.check_user_is_super_admin(p_user_id UUID)
  RETURNS BOOLEAN AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.school_memberships 
      WHERE user_id = p_user_id 
        AND role = 'SuperAdmin'
    );
  $$ LANGUAGE sql SECURITY DEFINER;

  -- 1. EXTEND PROFILES & MEMBERSHIPS FOR PARENTS
  -- Add phone number to profiles for parent authentication mapping
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

  -- Add section column to students for partitioning
  ALTER TABLE public.students ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'A';

  -- Safely update the role constraint on school_memberships to include 'Parent'
  ALTER TABLE public.school_memberships DROP CONSTRAINT IF EXISTS school_memberships_role_check;
  ALTER TABLE public.school_memberships ADD CONSTRAINT school_memberships_role_check 
    CHECK (role IN ('Admin', 'Teacher', 'Accountant', 'Receptionist', 'SuperAdmin', 'Parent'));


  -- 2. CREATE ACADEMICS SUBMODULE TABLES
  -- Create normalized subjects table
  CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_school_subject UNIQUE (school_id, name)
  );

  -- Create normalized exams table
  CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    term TEXT NOT NULL, -- e.g., 'Term 1', 'Term 2', 'Final'
    year TEXT NOT NULL,  -- e.g., '2026'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_school_class_exam UNIQUE (school_id, class_id, title, term, year)
  );

  -- Create normalized results table (replaces academic_results)
  CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    marks NUMERIC NOT NULL DEFAULT 0 CHECK (marks >= 0),
    grade TEXT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_exam_subject UNIQUE (student_id, exam_id, subject_id)
  );


  -- 3. EXPAND HOMEWORK SCHEMA (REPLACING LOCALSTORAGE WITH SUPABASE)
  -- Drop old simple homework table to replace it with rich schema
  DROP TABLE IF EXISTS public.homework CASCADE;

  CREATE TABLE public.homework (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    section TEXT NOT NULL DEFAULT 'A',
    title TEXT NOT NULL,
    description TEXT,
    attachments TEXT[] DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    pdf_url TEXT,
    video_url TEXT,
    due_date DATE NOT NULL,
    submission_required BOOLEAN NOT NULL DEFAULT false,
    max_marks NUMERIC NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Archived')),
    visibility TEXT NOT NULL DEFAULT 'All',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );


  -- 4. CREATE LEAVE REQUESTS TABLE (PARENT DASHBOARD SERVICE)
  CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- 4.5. CREATE TEACHER MESSAGES TABLE (PARENT DASHBOARD CHAT SERVICE)
  CREATE TABLE IF NOT EXISTS public.teacher_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('parent', 'teacher')),
    teacher_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- ========================================================
  -- 5. ROW LEVEL SECURITY (RLS) POLICIES
  -- ========================================================
  ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.teacher_messages ENABLE ROW LEVEL SECURITY;

  -- Clear previous policies
  DROP POLICY IF EXISTS "Manage subjects" ON public.subjects;
  DROP POLICY IF EXISTS "Manage exams" ON public.exams;
  DROP POLICY IF EXISTS "Manage results" ON public.results;
  DROP POLICY IF EXISTS "Select results" ON public.results;
  DROP POLICY IF EXISTS "Modify results" ON public.results;
  DROP POLICY IF EXISTS "Manage homework" ON public.homework;
  DROP POLICY IF EXISTS "Select homework" ON public.homework;
  DROP POLICY IF EXISTS "Modify homework" ON public.homework;
  DROP POLICY IF EXISTS "Manage leave requests" ON public.leave_requests;
  DROP POLICY IF EXISTS "Select leave requests" ON public.leave_requests;
  DROP POLICY IF EXISTS "Insert leave requests" ON public.leave_requests;
  DROP POLICY IF EXISTS "Update leave requests" ON public.leave_requests;

  -- A. Subjects Policies
  CREATE POLICY "Manage subjects" ON public.subjects
    FOR ALL
    USING (
      public.check_user_is_school_member(auth.uid(), school_id)
      OR public.check_user_is_super_admin(auth.uid())
    );

  -- B. Exams Policies
  CREATE POLICY "Manage exams" ON public.exams
    FOR ALL
    USING (
      public.check_user_is_school_member(auth.uid(), school_id)
      OR public.check_user_is_super_admin(auth.uid())
    );

  -- C. Results Policies
  -- Anyone who is a member of the school can select results (teachers/admins/parents can query)
  CREATE POLICY "Select results" ON public.results
    FOR SELECT
    USING (
      student_id IN (
        SELECT id FROM public.students 
        WHERE public.check_user_is_school_member(auth.uid(), school_id)
      )
    );

  -- Only teachers or admins of the school can insert/update results
  CREATE POLICY "Modify results" ON public.results
    FOR ALL
    USING (
      student_id IN (
        SELECT id FROM public.students 
        WHERE school_id IN (
          SELECT school_id FROM public.school_memberships 
          WHERE user_id = auth.uid() AND role IN ('Admin', 'Teacher', 'SuperAdmin')
        )
      )
    );

  -- D. Homework Policies
  -- Standard read policies
  CREATE POLICY "Select homework" ON public.homework
    FOR SELECT
    USING (
      public.check_user_is_school_member(auth.uid(), school_id)
    );

  -- Modify policies for Teachers and Admins
  CREATE POLICY "Modify homework" ON public.homework
    FOR ALL
    USING (
      public.check_user_is_school_admin(auth.uid(), school_id)
      OR EXISTS (
        SELECT 1 FROM public.school_memberships 
        WHERE user_id = auth.uid() AND school_id = homework.school_id AND role = 'Teacher'
      )
      OR public.check_user_is_super_admin(auth.uid())
    );

  -- E. Leave Requests Policies
  -- Select policy: Parents can see their own, teachers/admins can see all for the school
  CREATE POLICY "Select leave requests" ON public.leave_requests
    FOR SELECT
    USING (
      student_id IN (
        SELECT id FROM public.students 
        WHERE public.check_user_is_school_member(auth.uid(), school_id)
      )
    );

  -- Insert policy: Parents (or anyone registered in school memberships) can insert leaves
  CREATE POLICY "Insert leave requests" ON public.leave_requests
    FOR INSERT
    WITH CHECK (
      student_id IN (
        SELECT id FROM public.students 
        WHERE public.check_user_is_school_member(auth.uid(), school_id)
      )
    );

  -- Update policy: School Admins/Teachers can approve/reject leaves
  CREATE POLICY "Update leave requests" ON public.leave_requests
    FOR UPDATE
    USING (
      school_id IN (
        SELECT school_id FROM public.school_memberships 
        WHERE user_id = auth.uid() AND role IN ('Admin', 'Teacher', 'SuperAdmin')
      )
    );

  -- ========================================================
  -- 6. PUBLIC ACCESS POLICIES FOR PARENT PORTAL SUPPORT
  -- ========================================================
  -- Drop and recreate select/insert policies to support simulated OTP parent logins
  DROP POLICY IF EXISTS "Select students parent portal" ON public.students;
  CREATE POLICY "Select students parent portal" ON public.students FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Select attendance parent portal" ON public.attendance;
  CREATE POLICY "Select attendance parent portal" ON public.attendance FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Select fees parent portal" ON public.fees;
  CREATE POLICY "Select fees parent portal" ON public.fees FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Update fees parent portal" ON public.fees;
  CREATE POLICY "Update fees parent portal" ON public.fees FOR UPDATE USING (true);

  DROP POLICY IF EXISTS "Allow all messages" ON public.teacher_messages;
  CREATE POLICY "Allow all messages" ON public.teacher_messages FOR ALL USING (true);

  DROP POLICY IF EXISTS "Select results" ON public.results;
  CREATE POLICY "Select results" ON public.results FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Select homework" ON public.homework;
  CREATE POLICY "Select homework" ON public.homework FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Select leave requests" ON public.leave_requests;
  CREATE POLICY "Select leave requests" ON public.leave_requests FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Insert leave requests" ON public.leave_requests;
  CREATE POLICY "Insert leave requests" ON public.leave_requests FOR INSERT WITH CHECK (true);
