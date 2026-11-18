-- ========================================================
-- Secure Row Level Security (RLS) Policies for Homework Table
-- ========================================================

-- Re-enable RLS on the homework table
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

-- 1. Drop existing loose or development policies
DROP POLICY IF EXISTS "Allow public read homework" ON public.homework;
DROP POLICY IF EXISTS "Allow all homework" ON public.homework;
DROP POLICY IF EXISTS "School staff can manage homework" ON public.homework;
DROP POLICY IF EXISTS "Parents and students can read assigned published homework" ON public.homework;

-- 2. Define Policy: School Staff Can Manage Homework
-- Allowed operations: SELECT, INSERT, UPDATE, DELETE
-- Restricts management strictly to members of the corresponding school tenant.
CREATE POLICY "School staff can manage homework" ON public.homework
  FOR ALL
  TO authenticated
  USING (
    public.check_user_is_school_member(auth.uid(), school_id)
  )
  WITH CHECK (
    public.check_user_is_school_member(auth.uid(), school_id)
  );

-- 3. Define Policy: Parents and Students Can Select Assigned Homework
-- Allowed operations: SELECT (Read Only)
-- Users can only read homework that is:
--   a) Published (status = 'Published')
--   b) Intended for students or all portal users (visibility IN ('students', 'All'))
--   c) Belongs to their school, matching class, and matching section.
CREATE POLICY "Parents and students can read assigned published homework" ON public.homework
  FOR SELECT
  TO authenticated
  USING (
    status = 'Published' 
    AND (visibility = 'students' OR visibility = 'All')
    AND (
      -- Check if user is the parent of a student who is assigned to this school, class name, and section.
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.profiles p ON p.phone = s.parent_phone
        WHERE p.id = auth.uid()
          AND s.school_id = homework.school_id
          AND s.class_name = (
            SELECT name FROM public.classes c 
            WHERE c.id = homework.class_id
          )
          AND s.section = homework.section
      )
    )
  );
