const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '../.env.local');
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('subscriptions').select('*').limit(1);
  console.log('Subscriptions table check:', { data, error });
}
run();
