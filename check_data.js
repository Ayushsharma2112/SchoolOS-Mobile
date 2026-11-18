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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // 1. Get schools
  const { data: schools } = await supabase.from('schools').select('*');
  console.log('--- SCHOOLS ---');
  console.log(schools);

  // 2. Get school memberships
  const { data: memberships } = await supabase.from('school_memberships').select('*');
  console.log('\n--- SCHOOL MEMBERSHIPS ---');
  console.log(memberships);

  // 3. Count students by school_id
  const { data: students } = await supabase.from('students').select('id, school_id, full_name').limit(10);
  console.log('\n--- SAMPLE STUDENTS ---');
  console.log(students);

  const { data: allStudents } = await supabase.from('students').select('school_id');
  const counts = {};
  allStudents?.forEach(s => {
    counts[s.school_id] = (counts[s.school_id] || 0) + 1;
  });
  console.log('\n--- STUDENT COUNT BY SCHOOL ---');
  console.log(counts);
}

check();
