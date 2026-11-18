const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load environment variables manually
const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found at:', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const cleaned = line.trim();
  if (!cleaned || cleaned.startsWith('#')) return;
  const eqIdx = cleaned.indexOf('=');
  if (eqIdx > 0) {
    const key = cleaned.substring(0, eqIdx).trim();
    const val = cleaned.substring(eqIdx + 1).trim();
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

console.log('Connecting to Supabase at:', supabaseUrl);
const supabase = createClient(supabaseUrl, serviceKey);

// Tables to clear in order of dependency (child tables first, parent tables last)
const tables = [
  'teacher_messages',
  'attendance',
  'leave_requests',
  'fees',
  'documents',
  'student-documents',
  'results',
  'homework',
  'timetables',
  'exams',
  'students',
  'classes',
  'subjects',
  'circulars',
  'school_events'
];

async function clearDatabase() {
  console.log('\n--- Starting Database Operations ---');

  for (const table of tables) {
    try {
      console.log(`Clearing table: ${table}...`);
      
      // Perform a delete matching all rows
      const { data, error, count } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // matches all standard UUIDs
        .select('id');

      if (error) {
        // Fallback delete if id isn't matching (e.g. integer primary keys)
        const { error: err2 } = await supabase
          .from(table)
          .delete()
          .gte('id', 0);
        
        if (err2) {
          console.error(`❌ Failed to clear ${table}:`, err2.message);
        } else {
          console.log(`✓ Table ${table} cleared successfully (fallback).`);
        }
      } else {
        console.log(`✓ Table ${table} cleared successfully. Removed ${data?.length || 0} rows.`);
      }
    } catch (e) {
      console.error(`❌ Error clearing table ${table}:`, e);
    }
  }

  // Clear parent profiles if any
  try {
    console.log('Cleaning parent user profiles...');
    const { data: parentProfiles, error: selectErr } = await supabase
      .from('profiles')
      .select('id, email, phone');

    if (!selectErr && parentProfiles) {
      const parentIds = parentProfiles
        .filter(p => p.email && p.email.endsWith('@parent.schoolos.com'))
        .map(p => p.id);

      if (parentIds.length > 0) {
        const { error: delErr } = await supabase
          .from('profiles')
          .delete()
          .in('id', parentIds);
        
        if (delErr) {
          console.error('❌ Failed to delete parent profiles:', delErr.message);
        } else {
          console.log(`✓ Removed ${parentIds.length} parent profile records.`);
        }
      } else {
        console.log('No parent profiles needed to be cleaned.');
      }
    }
  } catch (e) {
    console.error('Error cleaning profiles:', e);
  }

  console.log('\n--- Database Cleanup Operations Completed ---');
}

void clearDatabase();
