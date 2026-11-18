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
  const { data, error } = await supabase.from('homework').select('*').limit(1);
  if (error) {
    console.error('Error fetching homework:', error);
  } else {
    console.log('Homework record sample:', data[0]);
  }
}

check();
