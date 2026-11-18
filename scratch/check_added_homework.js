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
  const { data: homework, error } = await supabase
    .from('homework')
    .select(`
      *,
      classes(name),
      schools(name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching homework:', error);
  } else {
    console.log(`Found ${homework.length} total homework assignments:`);
    homework.slice(0, 5).forEach((hw, idx) => {
      console.log(`[${idx + 1}] Title: "${hw.title}"`);
      console.log(`    School: "${hw.schools?.name}" (${hw.school_id})`);
      console.log(`    Class ID: ${hw.class_id} (${hw.classes?.name})`);
      console.log(`    Status: ${hw.status}`);
      console.log(`    Created At: ${hw.created_at}`);
    });
  }
}

check();
