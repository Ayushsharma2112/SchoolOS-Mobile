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
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('--- USERS ---');
    users.forEach(u => {
      console.log(`ID: ${u.id}, Email: ${u.email}, Metadata:`, u.user_metadata);
    });
  }
}

check();
