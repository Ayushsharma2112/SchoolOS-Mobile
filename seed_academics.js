const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env.local
try {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
      process.env[key] = val;
    }
  });
} catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const subjectNames = ['Mathematics', 'Science', 'English', 'Social Studies', 'Computer Science'];
const examDefinitions = [
  { title: 'Term 1 Exam', term: 'Term 1', year: '2026' },
  { title: 'Term 2 Exam', term: 'Term 2', year: '2026' },
  { title: 'Final Exam', term: 'Final', year: '2026' }
];

const homeworkTemplates = [
  { title: 'Algebra Practice Set 1', desc: 'Solve equations 1 to 15 on page 42. Show all step-by-step methods.', subName: 'Mathematics', marks: 50 },
  { title: 'Newtonian Laws Lab Report', desc: 'Write a detailed lab report on Newtonian laws experiment including hypothesis, observations, and calculations. Submit in PDF format.', subName: 'Science', marks: 100 },
  { title: 'Shakespeare Hamlet Analysis', desc: 'Read Act 3 of Hamlet and write a 500-word critical analysis on Hamlet Soliloquy.', subName: 'English', marks: 20 },
  { title: 'Industrial Revolution Overview', desc: 'Answer questions regarding the impacts of the Industrial Revolution on social structures in Europe.', subName: 'Social Studies', marks: 50 },
  { title: 'Python Arrays and Loops exercise', desc: 'Write a Python program to sort an array. Attach the script file (.py).', subName: 'Computer Science', marks: 30 }
];

function getGrade(marks) {
  if (marks >= 90) return 'A+';
  if (marks >= 80) return 'A';
  if (marks >= 70) return 'B';
  if (marks >= 60) return 'C';
  if (marks >= 50) return 'D';
  return 'F';
}

function getRemarks(grade) {
  switch (grade) {
    case 'A+': return 'Outstanding performance, keep it up!';
    case 'A': return 'Excellent work, very consistent.';
    case 'B': return 'Good performance, can improve further.';
    case 'C': return 'Satisfactory result, focus more on practice.';
    case 'D': return 'Needs improvement, seek teacher guidance.';
    default: return 'Fail. Mandatory parent-teacher meeting required.';
  }
}

async function seedAcademics() {
  console.log('--- STARTING ACADEMICS SEEDING SCRIPT ---');

  // 1. Fetch schools
  const { data: schools, error: schoolsError } = await supabase.from('schools').select('id, name');
  if (schoolsError || !schools) {
    console.error('Error fetching schools:', schoolsError?.message);
    process.exit(1);
  }

  for (const school of schools) {
    console.log(`\nProcessing school: ${school.name} (${school.id})...`);

    // Delete old values to re-seed clean
    console.log('Clearing existing academic tables for this school...');
    const { data: schoolStuds } = await supabase.from('students').select('id').eq('school_id', school.id);
    const studIds = (schoolStuds || []).map(s => s.id);
    
    if (studIds.length > 0) {
      await supabase.from('results').delete().in('student_id', studIds);
    }
    await supabase.from('homework').delete().eq('school_id', school.id);
    await supabase.from('exams').delete().eq('school_id', school.id);
    await supabase.from('subjects').delete().eq('school_id', school.id);

    // 2. Insert subjects
    console.log('Inserting subjects...');
    const subjectsToInsert = subjectNames.map(name => ({ school_id: school.id, name }));
    const { data: insertedSubjects, error: subError } = await supabase
      .from('subjects')
      .insert(subjectsToInsert)
      .select();

    if (subError || !insertedSubjects) {
      console.error('Failed to insert subjects:', subError?.message);
      continue;
    }
    console.log(`Seeded ${insertedSubjects.length} subjects.`);

    // 3. Fetch students, staff, and classes first
    const { data: students } = await supabase.from('students').select('*').eq('school_id', school.id);
    const { data: staff } = await supabase.from('staff').select('*').eq('school_id', school.id).eq('role', 'Teacher');
    const { data: classes } = await supabase.from('classes').select('*').eq('school_id', school.id);

    if (!classes || classes.length === 0) {
      console.log('No classes found to seed exams for.');
      continue;
    }

    // 4. Insert exams per class
    console.log('Inserting class-specific exams...');
    const examsToInsert = [];
    for (const cls of classes) {
      examDefinitions.forEach(def => {
        examsToInsert.push({
          school_id: school.id,
          class_id: cls.id,
          title: `${def.title} (${cls.name})`,
          term: def.term,
          year: def.year
        });
      });
    }

    const { data: insertedExams, error: examError } = await supabase
      .from('exams')
      .insert(examsToInsert)
      .select();

    if (examError || !insertedExams) {
      console.error('Failed to insert exams:', examError?.message);
      continue;
    }
    console.log(`Seeded ${insertedExams.length} exams.`);

    if (!students || students.length === 0) {
      console.log('No students found to seed results for.');
      continue;
    }
    
    const teacher = staff && staff.length > 0 ? staff[0] : null;
    const teacherId = teacher ? teacher.id : null;

    // 5. Seed results matching students with their specific class exams
    console.log(`Generating results for ${students.length} students...`);
    const resultsToInsert = [];
    
    for (const student of students) {
      const studentClass = classes.find(c => c.name === student.class_name);
      if (!studentClass) continue;

      const classSpecificExams = insertedExams.filter(e => e.class_id === studentClass.id);

      for (const exam of classSpecificExams) {
        for (const subject of insertedSubjects) {
          const marks = Math.floor(45 + Math.random() * 55); // Random marks 45 to 100
          const grade = getGrade(marks);
          const remarks = getRemarks(grade);
          
          resultsToInsert.push({
            student_id: student.id,
            exam_id: exam.id,
            subject_id: subject.id,
            teacher_id: teacherId,
            marks,
            grade,
            remarks
          });
        }
      }
    }

    const { error: resInsertError } = await supabase.from('results').insert(resultsToInsert);
    if (resInsertError) {
      console.error('Error inserting results:', resInsertError.message);
    } else {
      console.log(`Seeded ${resultsToInsert.length} results entries.`);
    }

    // 6. Seed homework
    if (classes && classes.length > 0 && insertedSubjects.length > 0) {
      console.log('Inserting homework...');
      const homeworkToInsert = [];
      const today = new Date();

      classes.forEach((cls) => {
        // Create 2 homeworks per class
        for (let i = 0; i < 2; i++) {
          const template = homeworkTemplates[Math.floor(Math.random() * homeworkTemplates.length)];
          const subject = insertedSubjects.find(s => s.name === template.subName) || insertedSubjects[0];
          const dueDate = new Date();
          dueDate.setDate(today.getDate() + 3 + i * 2);

          homeworkToInsert.push({
            school_id: school.id,
            teacher_id: teacherId,
            subject_id: subject.id,
            class_id: cls.id,
            section: 'A',
            title: `${template.title} (${cls.name})`,
            description: template.desc,
            due_date: dueDate.toISOString().split('T')[0],
            submission_required: Math.random() > 0.3,
            max_marks: template.marks,
            status: 'Published',
            visibility: 'All'
          });
        }
      });

      const { error: hwError } = await supabase.from('homework').insert(homeworkToInsert);
      if (hwError) {
        console.error('Error inserting homework:', hwError.message);
      } else {
        console.log(`Seeded ${homeworkToInsert.length} homework assignments.`);
      }
    }
  }

  console.log('\n--- SEEDING COMPLETED SUCCESSFULLY ---');
}

seedAcademics();
