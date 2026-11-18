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

const firstNames = ['Aarav', 'Vihaan', 'Kabir', 'Sai', 'Arjun', 'Aditya', 'Krishna', 'Reyansh', 'Ishaan', 'Rahul', 'Ananya', 'Diya', 'Aditi', 'Sanya', 'Pari', 'Sneha', 'Meera', 'Riya', 'Kavya', 'Avani'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Reddy', 'Kumar', 'Singh', 'Joshi', 'Mehta', 'Nair', 'Rao', 'Choudhury', 'Sen', 'Das', 'Mishra'];
const parentNames = ['Rajesh', 'Sunita', 'Ramesh', 'Geeta', 'Sanjay', 'Anita', 'Anil', 'Kiran', 'Vijay', 'Meena', 'Rakesh', 'Suman', 'Manoj', 'Pooja', 'Vikram'];
const cities = ['New Delhi', 'Mumbai', 'Bangalore', 'Pune', 'Kolkata', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Jaipur', 'Lucknow'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
}

async function seed() {
  console.log('--- STARTING MULTI-TENANT DEMO DATA SEEDING ---');

  // 1. Clean up existing tables
  console.log('Deleting existing data...');
  
  const { error: delDocsErr } = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delDocsErr) console.warn('Warning deleting docs:', delDocsErr.message);

  const { error: delAttErr } = await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delAttErr) console.warn('Warning deleting attendance:', delAttErr.message);

  const { error: delFeesErr } = await supabase.from('fees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delFeesErr) console.warn('Warning deleting fees:', delFeesErr.message);

  const { error: delStudErr } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delStudErr) {
    console.error('Error deleting students:', delStudErr.message);
    process.exit(1);
  }

  const { error: delStaffErr } = await supabase.from('staff').delete().like('email', '%@mockteacher.com');
  if (delStaffErr) console.warn('Warning deleting mock staff:', delStaffErr.message);

  console.log('Successfully cleared database tables.');

  // 2. Fetch all schools in the system
  const { data: schools, error: schoolsError } = await supabase.from('schools').select('id, name');
  if (schoolsError || !schools) {
    console.error('Error fetching schools to seed:', schoolsError?.message);
    process.exit(1);
  }

  console.log(`Found ${schools.length} schools to seed.`);

  const studentsToInsert = [];
  const staffToInsert = [];

  schools.forEach(school => {
    console.log(`Generating students and staff for school: ${school.name} (${school.id})...`);
    
    // Generate 20 students per school
    for (let i = 1; i <= 20; i++) {
      const gender = Math.random() > 0.5 ? 'Male' : 'Female';
      const firstName = getRandomElement(firstNames);
      const lastName = getRandomElement(lastNames);
      const fullName = `${firstName} ${lastName}`;
      const pName = `${getRandomElement(parentNames)} ${lastName}`;
      const pPhone = `+91 ${Math.floor(6000000000 + Math.random() * 4000000000)}`;
      const className = String(Math.floor(1 + Math.random() * 10)); // Class 1 to 10
      const dob = getRandomDate(new Date(2010, 0, 1), new Date(2020, 11, 31));
      const admDate = getRandomDate(new Date(2024, 0, 1), new Date(2026, 5, 1));
      const address = `${Math.floor(1 + Math.random() * 200)}, Pocket ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}, Vasant Kunj, ${getRandomElement(cities)}`;

      studentsToInsert.push({
        school_id: school.id,
        full_name: fullName,
        parent_name: pName,
        parent_phone: pPhone,
        class_name: className,
        gender: gender,
        date_of_birth: dob,
        admission_date: admDate,
        address: address
      });
    }

    // Generate 3 active teachers per school
    const teacherNames = [
      { name: 'Mrs. Seema Sharma', email: `seema.sharma.${school.id.slice(0, 4)}@mockteacher.com` },
      { name: 'Mr. Rajesh Verma', email: `rajesh.verma.${school.id.slice(0, 4)}@mockteacher.com` },
      { name: 'Mrs. Kavya Sen', email: `kavya.sen.${school.id.slice(0, 4)}@mockteacher.com` }
    ];
    teacherNames.forEach((t, index) => {
      staffToInsert.push({
        school_id: school.id,
        user_id: null,
        full_name: t.name,
        email: t.email,
        phone: `+91 ${Math.floor(7000000000 + Math.random() * 3000000000)}`,
        role: 'Teacher',
        status: 'Active'
      });
    });
  });

  // Bulk Insert Students
  console.log(`Inserting ${studentsToInsert.length} total students into Supabase...`);
  const { data: insertedStudents, error: insertStudErr } = await supabase
    .from('students')
    .insert(studentsToInsert)
    .select();

  if (insertStudErr || !insertedStudents) {
    console.error('Error inserting students:', insertStudErr?.message || 'No data returned');
    process.exit(1);
  }
  console.log(`Inserted ${insertedStudents.length} students successfully.`);

  // Bulk Insert Staff
  console.log(`Inserting ${staffToInsert.length} total staff/teachers into Supabase...`);
  const { error: insertStaffErr } = await supabase
    .from('staff')
    .insert(staffToInsert);
  if (insertStaffErr) {
    console.error('Error inserting staff:', insertStaffErr.message);
  } else {
    console.log(`Inserted ${staffToInsert.length} teachers successfully.`);
  }

  // 3. Generate attendance logs & billing invoices for all students
  const feesToInsert = [];
  const attendanceToInsert = [];

  for (const student of insertedStudents) {
    // Generate Admission Fee
    feesToInsert.push({
      student_id: student.id,
      school_id: student.school_id,
      amount: 5000,
      status: Math.random() > 0.1 ? 'paid' : 'unpaid',
      month: 'Admission Fee'
    });

    // Term 1 Fee
    if (Math.random() > 0.3) {
      feesToInsert.push({
        student_id: student.id,
        school_id: student.school_id,
        amount: 3000,
        status: Math.random() > 0.5 ? 'paid' : 'unpaid',
        month: 'Term 1 Fee'
      });
    }

    // Term 2 Fee
    if (Math.random() > 0.6) {
      feesToInsert.push({
        student_id: student.id,
        school_id: student.school_id,
        amount: 3500,
        status: 'unpaid',
        month: 'Term 2 Fee'
      });
    }

    // Generate last 10 days of attendance
    for (let d = 0; d < 10; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      attendanceToInsert.push({
        student_id: student.id,
        school_id: student.school_id,
        date: date.toISOString().split('T')[0],
        status: Math.random() > 0.12 ? 'present' : 'absent'
      });
    }
  }

  // Batch insert fees
  console.log(`Inserting ${feesToInsert.length} fee records...`);
  const { error: feesErr } = await supabase.from('fees').insert(feesToInsert);
  if (feesErr) console.error('Error inserting fees:', feesErr.message);

  // Batch insert attendance
  console.log(`Inserting ${attendanceToInsert.length} attendance logs...`);
  const chunkSize = 200;
  for (let i = 0; i < attendanceToInsert.length; i += chunkSize) {
    const chunk = attendanceToInsert.slice(i, i + chunkSize);
    const { error: attErr } = await supabase.from('attendance').insert(chunk);
    if (attErr) console.error(`Error inserting attendance chunk at index ${i}:`, attErr.message);
  }

  console.log('--- MULTI-TENANT SEEDING COMPLETED SUCCESSFULLY ---');
}

seed();
