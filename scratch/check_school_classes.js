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
  const { data: schools } = await supabase.from('schools').select('id, name');
  
  for (const school of schools) {
    const { data: cls } = await supabase.from('classes').select('id, name').eq('school_id', school.id);
    const { data: studs } = await supabase.from('students').select('class_name').eq('school_id', school.id);
    
    if (cls && cls.length > 0 && studs && studs.length > 0) {
      const classNamesInClasses = cls.map(c => c.name);
      const studentClassNames = Array.from(new Set(studs.map(s => s.class_name)));
      
      console.log(`School: ${school.name} (${school.id})`);
      console.log('  Classes in DB:', classNamesInClasses);
      console.log('  Students Class Assignments:', studentClassNames);
      
      // Check for mismatches
      const mismatches = studentClassNames.filter(name => !classNamesInClasses.includes(name));
      if (mismatches.length > 0) {
        console.log('  ⚠️ WARNING: Mismatch found for student classes:', mismatches);
      } else {
        console.log('  ✅ Class assignments match perfectly!');
      }
    }
  }
}

check();
