import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

export async function POST(request: NextRequest) {
  let requestBody: any = {}
  try {
    requestBody = await request.json()
  } catch (e) {
    return Response.json({ success: false, error: 'Invalid JSON request body.' }, { status: 400 })
  }

  const { schoolId, studentData, parentData, documents, photo } = requestBody

  if (!schoolId || !studentData || !parentData) {
    return Response.json({ success: false, error: 'Missing required parameters (schoolId, studentData, parentData).' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  try {
    // 1. Check subscription limits
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle()

    if (sub) {
      if (sub.status === 'expired' || sub.status === 'suspended') {
        return Response.json({ success: false, error: 'Registration blocked: Your active subscription has expired or is suspended.' }, { status: 403 })
      }
      if (sub.status === 'grace_period') {
        return Response.json({ success: false, error: 'Registration locked: Workspace is currently in a grace period. Please settle outstanding invoices.' }, { status: 403 })
      }

      // Count students in this school
      const { count } = await supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)

      if (count !== null && count >= sub.max_students) {
        return Response.json({ 
          success: false, 
          error: `Plan Limit Exceeded: Your plan '${sub.plan_name}' allows up to ${sub.max_students} students. Please upgrade your subscription.` 
        }, { status: 403 })
      }
    }

    // 2. Resolve/Generate admission number
    const finalAdmissionNo = studentData.admission_number || `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

    // 3. Process Parent account
    const parentPhoneRaw = parentData.phone || studentData.emergency_contact || ''
    const cleanPhone = parentPhoneRaw.trim().replace(/\s+/g, '')
    if (!cleanPhone) {
      return Response.json({ success: false, error: 'Parent phone number is required.' }, { status: 400 })
    }

    let parentUserId: string | null = null

    // Check if parent profile already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle()

    if (existingProfile) {
      parentUserId = existingProfile.id
      console.log(`Found existing parent account: ${parentUserId}`)
    } else {
      // Create new Parent Auth User
      const parentName = parentData.father_name || parentData.mother_name || parentData.guardian_name || 'Parent User'
      const derivedEmail = parentData.email || `${cleanPhone}@parent.schoolos.com`
      const tempPassword = `Parent123!`

      console.log(`Creating parent user for phone ${cleanPhone} email ${derivedEmail}...`)
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: derivedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: parentName,
          role: 'Parent'
        }
      })

      if (userError || !userData?.user) {
        throw new Error(`Failed to create parent auth account: ${userError?.message || 'No user returned.'}`)
      }

      parentUserId = userData.user.id

      // Create Parent profile record
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: parentUserId,
          full_name: parentName,
          phone: cleanPhone
        })

      if (profileError) {
        console.error('Failed to create parent profile:', profileError.message)
      }
    }

    // 4. Create School Membership for parent
    if (parentUserId) {
      await supabaseAdmin
        .from('school_memberships')
        .upsert({
          user_id: parentUserId,
          school_id: schoolId,
          role: 'Parent'
        }, { onConflict: 'user_id,school_id,role' })
    }

    // 5. Insert Student
    const studentPayload = {
      school_id: schoolId,
      full_name: studentData.name,
      class_name: studentData.class || '1',
      gender: studentData.gender || 'Male',
      date_of_birth: studentData.dob || null,
      admission_date: studentData.admission_date || new Date().toISOString().split('T')[0],
      address: studentData.address || null,
      parent_name: parentData.father_name || parentData.mother_name || parentData.guardian_name || 'Parent User',
      parent_phone: cleanPhone,
      section: studentData.section || 'A'
    }

    const { data: newStudent, error: studentError } = await supabaseAdmin
      .from('students')
      .insert(studentPayload)
      .select()
      .single()

    if (studentError || !newStudent) {
      throw new Error(`Failed to insert student: ${studentError?.message || 'No student returned.'}`)
    }

    const studentId = newStudent.id
    console.log(`Successfully created student record: ${studentId}`)

    // Helper: upload base64 to storage bucket
    const uploadBase64 = async (base64Data: string, filePath: string, mime: string) => {
      const base64Clean = base64Data.replace(/^data:.*?;base64,/, '')
      const fileBuffer = Buffer.from(base64Clean, 'base64')
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from('student-documents')
        .upload(filePath, fileBuffer, {
          contentType: mime,
          upsert: true
        })

      if (uploadError) {
        throw new Error(`Document upload to bucket failed: ${uploadError.message}`)
      }
      return filePath
    }

    // 6. Process student cropped photo
    let avatarUrl = ''
    if (photo && photo.fileBase64) {
      const ext = photo.mimeType.split('/').pop() || 'jpg'
      const photoPath = `student-photos/${studentId}_${Date.now()}.${ext}`
      try {
        await uploadBase64(photo.fileBase64, photoPath, photo.mimeType)
        avatarUrl = photoPath

        // Save as a document record as well
        await supabaseAdmin
          .from('documents')
          .insert({
            school_id: schoolId,
            student_id: studentId,
            document_type: 'Student Photograph',
            file_url: photoPath
          })
      } catch (photoErr: any) {
        console.error('Failed to save student profile photograph:', photoErr.message)
      }
    }

    // 7. Process other detected/uploaded documents
    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (doc.fileBase64) {
          const docPath = `student-docs/${studentId}_${Date.now()}_${doc.name}`
          try {
            await uploadBase64(doc.fileBase64, docPath, doc.mimeType)
            await supabaseAdmin
              .from('documents')
              .insert({
                school_id: schoolId,
                student_id: studentId,
                document_type: doc.type,
                file_url: docPath
              })
          } catch (docErr: any) {
            console.error(`Failed to upload document ${doc.name}:`, docErr.message)
          }
        }
      }
    }

    // 8. Build extra student metadata for local storage sync
    const extraMetadata = {
      admissionNo: finalAdmissionNo,
      rollNumber: studentData.roll_number || '',
      section: studentData.section || 'A',
      status: 'Active',
      bloodGroup: studentData.blood_group || '',
      allergies: studentData.allergies || '',
      conditions: studentData.medical_notes || '',
      vaccinationStatus: 'Completed',
      heightWeight: '',
      emergencyName: parentData.father_name || parentData.mother_name || parentData.guardian_name || '',
      emergencyRelation: parentData.father_name ? 'Father' : parentData.mother_name ? 'Mother' : 'Guardian',
      emergencyPhone: cleanPhone,
      rte: 'No',
      nationality: studentData.nationality || 'Indian',
      religion: studentData.religion || 'Hindu',
      house: 'Red House',
      previousSchool: studentData.previous_school || '',
      academicYear: '2026-27',
      fatherName: parentData.father_name || '',
      fatherPhone: parentData.phone || '',
      fatherEmail: parentData.email || '',
      motherName: parentData.mother_name || '',
      motherPhone: parentData.phone || '',
      motherEmail: parentData.email || '',
      guardianName: parentData.guardian_name || '',
      guardianPhone: parentData.phone || '',
      guardianRelation: '',
      classTeacherName: 'Class Teacher',
      classTeacherEmail: '',
      classTeacherPhone: ''
    }

    return Response.json({
      success: true,
      studentId,
      parentUserId,
      extraMetadata
    })
  } catch (err: any) {
    console.error('AI Student Save Route error:', err)
    return Response.json({ success: false, error: err.message || 'Saving failed.' }, { status: 500 })
  }
}
