import { supabase } from '../supabase'

export type TeacherAttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'

export type TeacherAttendanceRecord = {
  id: string
  school_id: string
  teacher_id: string
  attendance_date: string
  status: TeacherAttendanceStatus
  check_in: string | null
  check_out: string | null
  remarks: string | null
  marked_by: string | null
  created_at: string
  updated_at: string
  teacher_name?: string
  teacher_email?: string
}

export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type TeacherCorrectionRequest = {
  id: string
  school_id: string
  teacher_id: string
  attendance_id: string | null
  attendance_date: string
  current_status: string
  requested_status: TeacherAttendanceStatus
  reason: string
  status: CorrectionStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_remarks: string | null
  created_at: string
  teacher_name?: string
  teacher_email?: string
}

export type TeacherAuditLog = {
  id: string
  school_id: string
  teacher_id: string
  attendance_id: string | null
  action: string
  previous_status: string | null
  new_status: string | null
  previous_check_in: string | null
  new_check_in: string | null
  previous_check_out: string | null
  new_check_out: string | null
  changed_by: string | null
  reason: string | null
  created_at: string
}

/**
 * Format a Javascript Date object to local YYYY-MM-DD
 */
export function getLocalTodayDateStr(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format ISO timestamp string into readable time format (e.g., "08:32 AM")
 */
export function formatTimeDisplay(isoString: string | null | undefined): string {
  if (!isoString) return '--:--'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return '--:--'
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch (e) {
    return '--:--'
  }
}

/**
 * Calculate working hours between check_in and check_out
 */
export function calculateWorkingHours(
  checkInIso: string | null | undefined,
  checkOutIso: string | null | undefined
): { formatted: string; decimalHours: number } {
  if (!checkInIso) {
    return { formatted: '0h 0m', decimalHours: 0 }
  }

  const startTime = new Date(checkInIso).getTime()
  if (isNaN(startTime)) return { formatted: '0h 0m', decimalHours: 0 }

  const endTime = checkOutIso ? new Date(checkOutIso).getTime() : new Date().getTime()
  if (isNaN(endTime) || endTime < startTime) return { formatted: '0h 0m', decimalHours: 0 }

  const diffMs = endTime - startTime
  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const decimalHours = Number((totalMinutes / 60).toFixed(2))

  return {
    formatted: `${hours}h ${minutes}m`,
    decimalHours
  }
}

/**
 * Fetch today's attendance record for a teacher
 */
export async function getTeacherTodayAttendance(
  schoolId: string,
  teacherId: string,
  dateStr: string = getLocalTodayDateStr()
): Promise<TeacherAttendanceRecord | null> {
  const { data, error } = await supabase
    .from('teacher_attendance')
    .select('*')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .eq('attendance_date', dateStr)
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
      console.warn('Teacher attendance table not migrated in database yet:', error.message)
    } else {
      console.error('Error fetching today teacher attendance:', error.message)
    }
    return null
  }
  return data
}

/**
 * Check In for a teacher today
 */
export async function recordTeacherCheckIn(
  schoolId: string,
  teacherId: string,
  dateStr: string = getLocalTodayDateStr(),
  remarks?: string
): Promise<{ success: boolean; data?: TeacherAttendanceRecord; error?: string }> {
  const existing = await getTeacherTodayAttendance(schoolId, teacherId, dateStr)
  if (existing && existing.check_in) {
    return { success: false, error: 'You have already checked in for today.' }
  }

  const nowIso = new Date().toISOString()
  const payload = {
    school_id: schoolId,
    teacher_id: teacherId,
    attendance_date: dateStr,
    status: 'PRESENT' as TeacherAttendanceStatus,
    check_in: nowIso,
    remarks: remarks || 'Checked in via Teacher Portal'
  }

  let resultData: TeacherAttendanceRecord | null = null
  let resultErr: string | null = null

  if (existing) {
    const { data, error } = await supabase
      .from('teacher_attendance')
      .update({
        status: 'PRESENT',
        check_in: nowIso,
        updated_at: nowIso,
        remarks: remarks || existing.remarks
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) resultErr = error.message
    else resultData = data
  } else {
    const { data, error } = await supabase
      .from('teacher_attendance')
      .insert(payload)
      .select()
      .single()

    if (error) resultErr = error.message
    else resultData = data
  }

  if (resultErr) {
    return { success: false, error: resultErr }
  }

  if (resultData) {
    try {
      await supabase.from('teacher_attendance_audit_logs').insert({
        school_id: schoolId,
        teacher_id: teacherId,
        attendance_id: resultData.id,
        action: 'CHECK_IN',
        previous_status: existing?.status || 'NOT_MARKED',
        new_status: 'PRESENT',
        new_check_in: nowIso,
        reason: 'Self check-in'
      })
    } catch (e) {}
  }

  return { success: true, data: resultData! }
}

/**
 * Check Out for a teacher today
 */
export async function recordTeacherCheckOut(
  schoolId: string,
  attendanceId: string,
  teacherId: string
): Promise<{ success: boolean; data?: TeacherAttendanceRecord; error?: string }> {
  const { data: record, error: fetchErr } = await supabase
    .from('teacher_attendance')
    .select('*')
    .eq('id', attendanceId)
    .single()

  if (fetchErr || !record) {
    return { success: false, error: 'Check-in record not found. Please check in first.' }
  }

  if (!record.check_in) {
    return { success: false, error: 'Cannot check out before checking in.' }
  }

  if (record.check_out) {
    return { success: false, error: 'You have already checked out for today.' }
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('teacher_attendance')
    .update({
      check_out: nowIso,
      updated_at: nowIso
    })
    .eq('id', attendanceId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  try {
    await supabase.from('teacher_attendance_audit_logs').insert({
      school_id: schoolId,
      teacher_id: teacherId,
      attendance_id: attendanceId,
      action: 'CHECK_OUT',
      previous_check_out: null,
      new_check_out: nowIso,
      reason: 'Self check-out'
    })
  } catch (e) {}

  return { success: true, data }
}

/**
 * Fetch monthly attendance records for a specific teacher
 */
export async function getTeacherMonthlyAttendance(
  schoolId: string,
  teacherId: string,
  year: number,
  month: number
): Promise<TeacherAttendanceRecord[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('teacher_attendance')
    .select('*')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate)
    .order('attendance_date', { ascending: true })

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
      console.warn('Teacher attendance table not migrated in database yet:', error.message)
    } else {
      console.error('Error fetching monthly teacher attendance:', error.message)
    }
    return []
  }

  return data || []
}

/**
 * Submit attendance correction request by teacher
 */
export async function submitTeacherCorrectionRequest(params: {
  schoolId: string
  teacherId: string
  attendanceId?: string | null
  attendanceDate: string
  currentStatus: string
  requestedStatus: TeacherAttendanceStatus
  reason: string
}): Promise<{ success: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from('teacher_attendance_corrections')
    .select('id')
    .eq('school_id', params.schoolId)
    .eq('teacher_id', params.teacherId)
    .eq('attendance_date', params.attendanceDate)
    .eq('status', 'PENDING')
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'A pending correction request already exists for this date.' }
  }

  const { error } = await supabase
    .from('teacher_attendance_corrections')
    .insert({
      school_id: params.schoolId,
      teacher_id: params.teacherId,
      attendance_id: params.attendanceId || null,
      attendance_date: params.attendanceDate,
      current_status: params.currentStatus,
      requested_status: params.requestedStatus,
      reason: params.reason,
      status: 'PENDING'
    })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Fetch all correction requests for a teacher
 */
export async function getTeacherCorrectionRequests(
  schoolId: string,
  teacherId: string
): Promise<TeacherCorrectionRequest[]> {
  const { data, error } = await supabase
    .from('teacher_attendance_corrections')
    .select('*')
    .eq('school_id', schoolId)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
      console.warn('Teacher attendance corrections table not migrated in database yet:', error.message)
    } else {
      console.error('Error fetching teacher correction requests:', error.message)
    }
    return []
  }
  return data || []
}

/**
 * ADMIN: Fetch attendance of all teachers for a given date or month
 */
export async function getSchoolTeacherAttendance(
  schoolId: string,
  dateStr?: string,
  year?: number,
  month?: number
): Promise<{
  teachers: { id: string; full_name: string; email: string; role: string }[]
  attendanceRecords: TeacherAttendanceRecord[]
}> {
  const { data: teachers, error: tErr } = await supabase
    .from('staff')
    .select('id, full_name, email, role')
    .eq('school_id', schoolId)
    .eq('role', 'Teacher')

  if (tErr) {
    console.error('Error fetching staff for school:', tErr.message)
    return { teachers: [], attendanceRecords: [] }
  }

  let query = supabase
    .from('teacher_attendance')
    .select('*')
    .eq('school_id', schoolId)

  if (dateStr) {
    query = query.eq('attendance_date', dateStr)
  } else if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    query = query.gte('attendance_date', startDate).lte('attendance_date', endDate)
  }

  const { data: attendanceRecords, error: aErr } = await query

  if (aErr) {
    if (aErr.code === 'PGRST205' || aErr.message.includes('schema cache')) {
      console.warn('Teacher attendance table not migrated in database yet:', aErr.message)
    } else {
      console.error('Error fetching school teacher attendance records:', aErr.message)
    }
    return { teachers: teachers || [], attendanceRecords: [] }
  }

  return {
    teachers: teachers || [],
    attendanceRecords: attendanceRecords || []
  }
}

/**
 * ADMIN: Fetch all correction requests for the school
 */
export async function getSchoolCorrectionRequests(
  schoolId: string
): Promise<TeacherCorrectionRequest[]> {
  const { data: requests, error } = await supabase
    .from('teacher_attendance_corrections')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
      console.warn('Teacher attendance corrections table not migrated in database yet:', error.message)
    } else {
      console.error('Error fetching school correction requests:', error.message)
    }
    return []
  }

  if (!requests || requests.length === 0) return []

  const teacherIds = Array.from(new Set(requests.map(r => r.teacher_id)))
  const { data: staffData } = await supabase
    .from('staff')
    .select('id, full_name, email')
    .in('id', teacherIds)

  const staffMap = new Map(staffData?.map(s => [s.id, s]))

  return requests.map(req => {
    const st = staffMap.get(req.teacher_id)
    return {
      ...req,
      teacher_name: st?.full_name || 'Unknown Teacher',
      teacher_email: st?.email || ''
    }
  })
}

/**
 * ADMIN: Approve or Reject a correction request
 */
export async function reviewCorrectionRequest(params: {
  requestId: string
  schoolId: string
  adminUserId: string
  action: 'APPROVE' | 'REJECT'
  reviewRemarks?: string
}): Promise<{ success: boolean; error?: string }> {
  const { data: reqData, error: fetchErr } = await supabase
    .from('teacher_attendance_corrections')
    .select('*')
    .eq('id', params.requestId)
    .eq('school_id', params.schoolId)
    .single()

  if (fetchErr || !reqData) {
    return { success: false, error: 'Correction request not found.' }
  }

  if (reqData.status !== 'PENDING') {
    return { success: false, error: `Request has already been ${reqData.status.toLowerCase()}.` }
  }

  const nowIso = new Date().toISOString()
  const newStatus: CorrectionStatus = params.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'

  const { error: updateErr } = await supabase
    .from('teacher_attendance_corrections')
    .update({
      status: newStatus,
      reviewed_by: params.adminUserId,
      reviewed_at: nowIso,
      review_remarks: params.reviewRemarks || null,
      updated_at: nowIso
    })
    .eq('id', params.requestId)

  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  if (params.action === 'APPROVE') {
    const { data: existingAtt } = await supabase
      .from('teacher_attendance')
      .select('*')
      .eq('school_id', params.schoolId)
      .eq('teacher_id', reqData.teacher_id)
      .eq('attendance_date', reqData.attendance_date)
      .maybeSingle()

    const previousStatus = existingAtt ? existingAtt.status : 'NOT_MARKED'
    let targetAttId = existingAtt?.id

    if (existingAtt) {
      const { data: updatedAtt } = await supabase
        .from('teacher_attendance')
        .update({
          status: reqData.requested_status,
          marked_by: params.adminUserId,
          updated_at: nowIso,
          remarks: `Correction approved: ${params.reviewRemarks || reqData.reason}`
        })
        .eq('id', existingAtt.id)
        .select()
        .single()

      if (updatedAtt) targetAttId = updatedAtt.id
    } else {
      const { data: newAtt } = await supabase
        .from('teacher_attendance')
        .insert({
          school_id: params.schoolId,
          teacher_id: reqData.teacher_id,
          attendance_date: reqData.attendance_date,
          status: reqData.requested_status,
          marked_by: params.adminUserId,
          remarks: `Correction approved: ${params.reviewRemarks || reqData.reason}`
        })
        .select()
        .single()

      if (newAtt) targetAttId = newAtt.id
    }

    try {
      await supabase.from('teacher_attendance_audit_logs').insert({
        school_id: params.schoolId,
        teacher_id: reqData.teacher_id,
        attendance_id: targetAttId || null,
        action: 'CORRECTION_APPROVED',
        previous_status: previousStatus,
        new_status: reqData.requested_status,
        changed_by: params.adminUserId,
        reason: `Correction request approved. Reason: ${reqData.reason}`
      })
    } catch (e) {}
  } else {
    try {
      await supabase.from('teacher_attendance_audit_logs').insert({
        school_id: params.schoolId,
        teacher_id: reqData.teacher_id,
        attendance_id: reqData.attendance_id || null,
        action: 'CORRECTION_REJECTED',
        previous_status: reqData.current_status,
        new_status: reqData.current_status,
        changed_by: params.adminUserId,
        reason: `Correction request rejected. ${params.reviewRemarks || ''}`
      })
    } catch (e) {}
  }

  return { success: true }
}

/**
 * ADMIN: Directly update or correct attendance for a teacher
 */
export async function adminUpdateTeacherAttendance(params: {
  schoolId: string
  teacherId: string
  attendanceDate: string
  status: TeacherAttendanceStatus
  checkIn?: string | null
  checkOut?: string | null
  remarks?: string
  adminUserId: string
  reason: string
}): Promise<{ success: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from('teacher_attendance')
    .select('*')
    .eq('school_id', params.schoolId)
    .eq('teacher_id', params.teacherId)
    .eq('attendance_date', params.attendanceDate)
    .maybeSingle()

  const nowIso = new Date().toISOString()
  const prevStatus = existing ? existing.status : 'NOT_MARKED'
  const prevCheckIn = existing ? existing.check_in : null
  const prevCheckOut = existing ? existing.check_out : null

  let targetId = existing?.id

  if (existing) {
    const { data: updated } = await supabase
      .from('teacher_attendance')
      .update({
        status: params.status,
        check_in: params.checkIn !== undefined ? params.checkIn : existing.check_in,
        check_out: params.checkOut !== undefined ? params.checkOut : existing.check_out,
        remarks: params.remarks || existing.remarks,
        marked_by: params.adminUserId,
        updated_at: nowIso
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updated) targetId = updated.id
  } else {
    const { data: inserted } = await supabase
      .from('teacher_attendance')
      .insert({
        school_id: params.schoolId,
        teacher_id: params.teacherId,
        attendance_date: params.attendanceDate,
        status: params.status,
        check_in: params.checkIn || null,
        check_out: params.checkOut || null,
        remarks: params.remarks || 'Marked by Administrator',
        marked_by: params.adminUserId
      })
      .select()
      .single()

    if (inserted) targetId = inserted.id
  }

  try {
    await supabase.from('teacher_attendance_audit_logs').insert({
      school_id: params.schoolId,
      teacher_id: params.teacherId,
      attendance_id: targetId || null,
      action: 'ADMIN_CORRECT',
      previous_status: prevStatus,
      new_status: params.status,
      previous_check_in: prevCheckIn,
      new_check_in: params.checkIn || null,
      previous_check_out: prevCheckOut,
      new_check_out: params.checkOut || null,
      changed_by: params.adminUserId,
      reason: params.reason || 'Admin direct correction'
    })
  } catch (e) {}

  return { success: true }
}

/**
 * Generate CSV text for monthly teacher attendance report
 */
export function generateMonthlyAttendanceCSV(data: {
  schoolName: string
  year: number
  monthName: string
  rows: {
    teacherName: string
    teacherEmail: string
    presentDays: number
    absentDays: number
    leaveDays: number
    halfDays: number
    totalWorkingDays: number
    attendancePercentage: number
  }[]
}): string {
  const headers = [
    'Teacher Name',
    'Email',
    'Total Working Days',
    'Present Days',
    'Absent Days',
    'Leave Days',
    'Half Days',
    'Attendance Rate (%)'
  ]

  const csvLines: string[] = []
  csvLines.push(`"${data.schoolName} - Teacher Attendance Report - ${data.monthName} ${data.year}"`)
  csvLines.push(`"Generated on: ${new Date().toLocaleDateString()}"`)
  csvLines.push('')
  csvLines.push(headers.map(h => `"${h}"`).join(','))

  data.rows.forEach(row => {
    const line = [
      `"${row.teacherName}"`,
      `"${row.teacherEmail}"`,
      row.totalWorkingDays,
      row.presentDays,
      row.absentDays,
      row.leaveDays,
      row.halfDays,
      `"${row.attendancePercentage.toFixed(1)}%"`
    ]
    csvLines.push(line.join(','))
  })

  return csvLines.join('\n')
}
