const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env.local');
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
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const schoolId = '74d6f085-ee05-4ac3-bc9f-a261cef151d6';
  
  const { data: cls } = await supabase.from('classes').select('id, name').eq('school_id', schoolId);
  const { data: studs } = await supabase.from('students').select('class_name').eq('school_id', schoolId).limit(5);
  const { data: homework } = await supabase.from('homework').select('class_id, title').eq('school_id', schoolId);
  
  console.log('Classes:', cls);
  console.log('Students class_name values:', studs);
  console.log('Homework entries:', homework);
}

check();
