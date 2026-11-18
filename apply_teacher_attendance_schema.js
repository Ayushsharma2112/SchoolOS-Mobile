const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local if present
try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
        process.env[key] = val;
      }
    });
  }
} catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('--- TEACHER ATTENDANCE INITIALIZER ---');
console.log('Supabase URL:', supabaseUrl || '(not configured in .env.local)');

if (!supabaseUrl || !supabaseKey) {
  console.log('Env variables missing. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('Verifying staff members in database...');
    const { data: staffList, error: staffErr } = await supabase
      .from('staff')
      .select('id, school_id, full_name, email, role')
      .eq('role', 'Teacher');

    if (staffErr) {
      console.warn('Could not fetch staff list:', staffErr.message);
      return;
    }

    console.log(`Found ${staffList ? staffList.length : 0} teachers in staff table.`);

    if (!staffList || staffList.length === 0) {
      console.log('No teachers found to seed attendance for.');
      return;
    }

    // Seed mock attendance for current month if table exists
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    console.log(`Seeding attendance for current month (${currentYear}-${currentMonth + 1}) for ${staffList.length} teachers...`);

    const statuses = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'HALF_DAY', 'LEAVE', 'ABSENT'];

    for (const teacher of staffList) {
      // Seed past 15 days
      for (let day = 1; day <= Math.min(today.getDate() - 1, 28); day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Skip weekends
        const d = new Date(currentYear, currentMonth, day);
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const checkIn = new Date(currentYear, currentMonth, day, 8, Math.floor(Math.random() * 30));
        const checkOut = status === 'PRESENT' ? new Date(currentYear, currentMonth, day, 16, Math.floor(Math.random() * 30)) : null;

        await supabase
          .from('teacher_attendance')
          .upsert({
            school_id: teacher.school_id,
            teacher_id: teacher.id,
            attendance_date: dateStr,
            status: status,
            check_in: status !== 'ABSENT' && status !== 'LEAVE' ? checkIn.toISOString() : null,
            check_out: status === 'PRESENT' ? checkOut.toISOString() : null,
            remarks: status === 'LEAVE' ? 'Casual Leave' : status === 'HALF_DAY' ? 'Half day morning session' : null
          }, { onConflict: 'school_id,teacher_id,attendance_date' })
          .then(({ error }) => {
            if (error) {
              // Silence if table not created via SQL script yet
            }
          });
      }
    }

    console.log('Teacher attendance seeding process completed successfully!');
  } catch (err) {
    console.error('Error seeding teacher attendance:', err.message);
  }
}

run();
