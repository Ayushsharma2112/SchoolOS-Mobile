const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse env vars
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
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('Using URL:', supabaseUrl);
  
  const clientAnon = createClient(supabaseUrl, supabaseKey);
  const clientService = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n--- 1. Querying with SERVICE ROLE (Bypasses RLS) ---');
  const res1 = await clientService.from('results').select('*').limit(3);
  if (res1.error) {
    console.error('Service Role Error:', res1.error);
  } else {
    console.log('Service Role Data:', res1.data);
  }

  console.log('\n--- 2. Querying with ANON KEY (Applies RLS) ---');
  const res2 = await clientAnon.from('results').select('*').limit(3);
  if (res2.error) {
    console.error('Anon Key Error:', res2.error);
  } else {
    console.log('Anon Key Data:', res2.data);
  }
}

run();
