import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

function normalizeClassName(input: string): string {
  if (!input) return '1'
  const clean = input.trim().toLowerCase()
    .replace(/^class\s+/i, '')
    .replace(/^grade\s+/i, '')
    .trim()

  const romanMap: Record<string, string> = {
    'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5',
    'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10',
    'xi': '11', 'xii': '12'
  }

  if (romanMap[clean]) return romanMap[clean]

  const wordMap: Record<string, string> = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    'eleven': '11', 'twelve': '12', 'lkg': 'LKG', 'ukg': 'UKG', 'nursery': 'Nursery'
  }

  if (wordMap[clean]) return wordMap[clean]

  return input.trim()
}

function normalizeSectionName(input: string): string {
  if (!input) return 'A'
  const clean = input.trim().toLowerCase()
    .replace(/^section\s+/i, '')
    .replace(/^sec\s+/i, '')
    .trim()
    .toUpperCase()
  return clean || 'A'
}

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch (e) {
      return Response.json({ success: false, error: 'Invalid JSON request body.' }, { status: 400 })
    }

    const { action = 'create', schoolId, studentData, parentData, existingStudentId, jobId, rowIndex } = body

    if (!schoolId || !studentData || !parentData) {
      return Response.json({ success: false, error: 'Missing required parameters (schoolId, studentData, parentData).' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 1. Check SaaS Limits
    try {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('school_id', schoolId)
        .maybeSingle()

      if (sub) {
        if (sub.status === 'expired' || sub.status === 'suspended') {
          return Response.json({ success: false, error: 'Subscription is suspended or expired.' }, { status: 403 })
        }
        if (sub.status === 'grace_period') {
          return Response.json({ success: false, error: 'Registration is locked during grace period.' }, { status: 403 })
        }

        // Count students
        const { count } = await supabaseAdmin
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)

        if (count !== null && count >= sub.max_students && action === 'create') {
          return Response.json({ 
            success: false, 
            error: `Plan Limit Exceeded: Your plan allows up to ${sub.max_students} students.` 
          }, { status: 403 })
        }
      }
    } catch (limitErr: any) {
      console.warn('Subscription check bypassed:', limitErr.message)
    }

    // 2. Normalize and Resolve Fields
    const normalizedClass = normalizeClassName(studentData.class)
    const normalizedSection = normalizeSectionName(studentData.section)
    const finalAdmissionNo = studentData.admission_number || `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

    const parentPhoneRaw = parentData.phone || studentData.phone || ''
    const cleanPhone = parentPhoneRaw.trim().replace(/\s+/g, '')

    if (!cleanPhone) {
      return Response.json({ success: false, error: 'Parent phone number is required.' }, { status: 400 })
    }

    // 3. Resolve Parent Auth User & Profile
    let parentUserId: string | null = null
    try {
      // Check for existing profile by phone
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle()

      if (existingProfile) {
        parentUserId = existingProfile.id
      } else {
        const parentName = parentData.father_name || parentData.mother_name || parentData.guardian_name || 'Parent User'
        const derivedEmail = parentData.email || `${cleanPhone}@parent.schoolos.com`
        const tempPassword = `Parent123!`

        // Create Auth User
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
          email: derivedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: parentName,
            role: 'Parent'
          }
        })

        if (!userError && userData?.user) {
          parentUserId = userData.user.id
          
          // Create Profile
          await supabaseAdmin
            .from('profiles')
            .upsert({
              id: parentUserId,
              full_name: parentName,
              phone: cleanPhone
            })
        } else {
          // If already in use, try to fallback
          console.warn('Parent user creation warning (email/phone already exists):', userError?.message)
          // Find user by email in profile
          const { data: profileByEmail } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('full_name', parentName) // best effort fallback
            .limit(1)
            .maybeSingle()
          
          if (profileByEmail) {
            parentUserId = profileByEmail.id
          }
        }
      }

      // Establish School Membership for Parent
      if (parentUserId) {
        await supabaseAdmin
          .from('school_memberships')
          .upsert({
            user_id: parentUserId,
            school_id: schoolId,
            role: 'Parent'
          }, { onConflict: 'user_id,school_id,role' })
      }
    } catch (parentErr: any) {
      console.warn('Parent account creation bypassed or resolved with profiles lookup:', parentErr.message)
    }

    // 4. Perform Insert / Update / Replace operations on Students table
    let studentId = existingStudentId
    let resultRecord = null

    const studentPayload: any = {
      school_id: schoolId,
      full_name: studentData.student_name,
      class_name: normalizedClass,
      gender: studentData.gender || 'Male',
      date_of_birth: studentData.date_of_birth || null,
      admission_date: studentData.admission_date || new Date().toISOString().split('T')[0],
      address: studentData.address || null,
      parent_name: parentData.father_name || parentData.mother_name || parentData.guardian_name || 'Parent User',
      parent_phone: cleanPhone,
      section: normalizedSection
    }

    if (action === 'create' || !studentId) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('students')
        .insert(studentPayload)
        .select()
        .single()

      if (insertError || !inserted) {
        throw new Error(`Failed to insert student: ${insertError?.message}`)
      }
      resultRecord = inserted
      studentId = inserted.id
    } else {
      // action is 'update' or 'replace'
      if (action === 'update') {
        // Fetch current record to merge
        const { data: current } = await supabaseAdmin
          .from('students')
          .select('*')
          .eq('id', studentId)
          .single()

        if (current) {
          // Merge non-blank fields
          Object.keys(studentPayload).forEach(key => {
            if (studentPayload[key] !== null && studentPayload[key] !== undefined && studentPayload[key] !== '') {
              current[key] = studentPayload[key]
            }
          })
          
          const { data: updated, error: updateError } = await supabaseAdmin
            .from('students')
            .update(current)
            .eq('id', studentId)
            .select()
            .single()

          if (updateError) throw new Error(`Failed to update student: ${updateError.message}`)
          resultRecord = updated
        }
      } else {
        // action is 'replace' - overwrite everything
        const { data: replaced, error: replaceError } = await supabaseAdmin
          .from('students')
          .update(studentPayload)
          .eq('id', studentId)
          .select()
          .single()

        if (replaceError) throw new Error(`Failed to replace student fields: ${replaceError.message}`)
        resultRecord = replaced
      }
    }

    // 5. Construct metadata for local storage synchronization
    const extraMetadata = {
      admissionNo: finalAdmissionNo,
      rollNumber: studentData.roll_number || '',
      section: normalizedSection,
      status: 'Active',
      bloodGroup: studentData.blood_group || '',
      allergies: '',
      conditions: studentData.remarks || '',
      vaccinationStatus: 'Completed',
      emergencyName: parentData.father_name || parentData.mother_name || parentData.guardian_name || '',
      emergencyRelation: parentData.father_name ? 'Father' : parentData.mother_name ? 'Mother' : 'Guardian',
      emergencyPhone: cleanPhone,
      rte: 'No',
      nationality: studentData.nationality || 'Indian',
      religion: studentData.religion || 'Hindu',
      house: 'Blue House',
      previousSchool: '',
      academicYear: '2026-27',
      fatherName: parentData.father_name || '',
      fatherPhone: parentData.phone || '',
      fatherEmail: parentData.email || '',
      motherName: parentData.mother_name || '',
      motherPhone: parentData.phone || '',
      motherEmail: parentData.email || '',
      guardianName: parentData.guardian_name || '',
      guardianPhone: parentData.phone || '',
      guardianRelation: ''
    }

    // 6. DB Logging updates (graceful degradation if tables are missing)
    if (jobId) {
      try {
        const statusField = action === 'skip' ? 'skipped_rows' : action === 'update' ? 'updated_rows' : 'imported_rows'
        
        // Increment job counter
        await supabaseAdmin.rpc('increment_import_counter', {
          job_id: jobId,
          field_name: statusField
        })

        // Also insert import_records entry if the table exists
        await supabaseAdmin
          .from('import_records')
          .insert({
            job_id: jobId,
            row_index: rowIndex || 0,
            raw_data: { studentData, parentData },
            status: action === 'skip' ? 'skipped' : 'imported',
            confidence_scores: {},
            resolution_action: action
          })
      } catch (dbErr: any) {
        // Ignored, fallback silently
      }
    }

    return Response.json({
      success: true,
      studentId,
      actionExecuted: action,
      extraMetadata
    })
  } catch (err: any) {
    console.error('Import record error:', err)
    
    // Log error in database if jobId is provided and table is available
    const body: any = await request.clone().json().catch(() => ({}))
    if (body.jobId) {
      try {
        const supabaseAdmin = getSupabaseAdmin()
        await supabaseAdmin
          .from('import_errors')
          .insert({
            job_id: body.jobId,
            row_index: body.rowIndex || 0,
            error_message: err.message || 'Import failed.'
          })
      } catch (dbErr) {}
    }

    return Response.json({ success: false, error: err.message || 'Failed to import student record.' }, { status: 500 })
  }
}
