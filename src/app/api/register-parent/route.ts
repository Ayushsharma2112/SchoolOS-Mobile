import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'

export async function POST(request: NextRequest) {
  let supabaseAdmin: any = null
  let requestBody: any = {}
  
  try {
    requestBody = await request.json()
  } catch (e) {
    return Response.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    )
  }

  const { phone, password, fullName } = requestBody

  if (!phone || !password || !fullName) {
    return Response.json(
      { error: 'Missing required registration fields (phone, password, fullName).' },
      { status: 400 }
    )
  }

  try {
    supabaseAdmin = getSupabaseAdmin()
    const cleanPhone = phone.trim().replace(/\s+/g, '')
    const derivedEmail = `${cleanPhone}@parent.schoolos.com`

    // 1. Create Confirmed Auth User using admin SDK
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: derivedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'Parent'
      }
    })

    if (userError || !userData?.user) {
      throw new Error(userError?.message || 'No user returned.')
    }

    const userId = userData.user.id

    // 2. Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        phone: cleanPhone
      })

    if (profileError) throw profileError

    // 3. Associate school memberships based on student listings
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('school_id')
      .eq('parent_phone', cleanPhone)

    if (students && students.length > 0) {
      const uniqueSchoolIds = Array.from(new Set(students.map((s: any) => s.school_id)))
      for (const schoolId of uniqueSchoolIds) {
        await supabaseAdmin
          .from('school_memberships')
          .upsert({
            user_id: userId,
            school_id: schoolId,
            role: 'Parent'
          })
      }
    }

    return Response.json({ success: true, userId })
  } catch (e: any) {
    console.error('Parent registration API error:', e)
    return Response.json(
      { error: e.message || 'Registration failed.' },
      { status: 500 }
    )
  }
}
