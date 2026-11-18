-- Supabase Parent Portal Migration Script
-- Creates additional schemas for Homework, Results, Timetable, Circulars, Events, and Messages.

-- 1. Create homework table
CREATE TABLE IF NOT EXISTS homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create academic_results table
CREATE TABLE IF NOT EXISTS academic_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  term TEXT NOT NULL, -- e.g., 'Term 1', 'Term 2', 'Final Term'
  subject TEXT NOT NULL,
  marks_obtained NUMERIC NOT NULL DEFAULT 0,
  max_marks NUMERIC NOT NULL DEFAULT 100,
  passing_marks NUMERIC NOT NULL DEFAULT 40,
  grade TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create timetables table
CREATE TABLE IF NOT EXISTS timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  day_of_week TEXT NOT NULL, -- e.g., 'Monday', 'Tuesday', etc.
  period TEXT NOT NULL, -- e.g., 'Period 1', 'Period 2'
  time_slot TEXT NOT NULL, -- e.g., '08:00 AM - 08:45 AM'
  subject TEXT NOT NULL,
  teacher_name TEXT,
  room_no TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create circulars table
CREATE TABLE IF NOT EXISTS circulars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General' CHECK (category IN ('General', 'Exam', 'Event', 'Holiday')),
  is_important BOOLEAN DEFAULT false,
  published_date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create school_events table
CREATE TABLE IF NOT EXISTS school_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  event_type TEXT NOT NULL DEFAULT 'Event' CHECK (event_type IN ('Holiday', 'Activity', 'PTM', 'Celebration')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create teacher_messages table
CREATE TABLE IF NOT EXISTS teacher_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('parent', 'teacher')),
  teacher_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE circulars ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_messages ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies for Parent Portal
-- Allow parents and users to select entries

-- Homework policies
DROP POLICY IF EXISTS "Allow public read homework" ON homework;
CREATE POLICY "Allow public read homework" ON homework FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all homework" ON homework;
CREATE POLICY "Allow all homework" ON homework FOR ALL USING (true);

-- Academic Results policies
DROP POLICY IF EXISTS "Allow public read results" ON academic_results;
CREATE POLICY "Allow public read results" ON academic_results FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all results" ON academic_results;
CREATE POLICY "Allow all results" ON academic_results FOR ALL USING (true);

-- Timetable policies
DROP POLICY IF EXISTS "Allow public read timetables" ON timetables;
CREATE POLICY "Allow public read timetables" ON timetables FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all timetables" ON timetables;
CREATE POLICY "Allow all timetables" ON timetables FOR ALL USING (true);

-- Circulars policies
DROP POLICY IF EXISTS "Allow public read circulars" ON circulars;
CREATE POLICY "Allow public read circulars" ON circulars FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all circulars" ON circulars;
CREATE POLICY "Allow all circulars" ON circulars FOR ALL USING (true);

-- School Events policies
DROP POLICY IF EXISTS "Allow public read school_events" ON school_events;
CREATE POLICY "Allow public read school_events" ON school_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all school_events" ON school_events;
CREATE POLICY "Allow all school_events" ON school_events FOR ALL USING (true);

-- Messages policies
DROP POLICY IF EXISTS "Allow public read messages" ON teacher_messages;
CREATE POLICY "Allow public read messages" ON teacher_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all messages" ON teacher_messages;
CREATE POLICY "Allow all messages" ON teacher_messages FOR ALL USING (true);

-- Add public SELECT policies for existing tables so that parent lookup by phone succeeds
DROP POLICY IF EXISTS "Allow public read students for parent portal" ON students;
CREATE POLICY "Allow public read students for parent portal" ON students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read attendance for parent portal" ON attendance;
CREATE POLICY "Allow public read attendance for parent portal" ON attendance FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read fees for parent portal" ON fees;
CREATE POLICY "Allow public read fees for parent portal" ON fees FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public update fees for parent portal" ON fees;
CREATE POLICY "Allow public update fees for parent portal" ON fees FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public read schools for parent portal" ON schools;
CREATE POLICY "Allow public read schools for parent portal" ON schools FOR SELECT USING (true);
