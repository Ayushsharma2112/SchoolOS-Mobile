'use client'

import { useEffect, useMemo, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../../../lib/supabase'
import { useSchool } from '../../../../../../lib/SchoolContext'
import ClientAuth from '../../../../ClientAuth'
import {
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
  getLocalTodayDateStr,
  formatTimeDisplay,
  calculateWorkingHours,
  getTeacherMonthlyAttendance,
  adminUpdateTeacherAttendance
} from '../../../../../../lib/services/teacherAttendance'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

type StaffMember = {
  id: string
  full_name: string
  email: string
  role: string
  phone?: string
  school_id: string
}

export default function IndividualTeacherAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const teacherId = resolvedParams.id

  const { schoolId, schoolName, profile } = useSchool()
  const todayStr = getLocalTodayDateStr()

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [teacher, setTeacher] = useState<StaffMember | null>(null)

  // Month navigation
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const selectedYear = currentDate.getFullYear()
  const selectedMonth = currentDate.getMonth() + 1 // 1-indexed

  // Monthly Records
  const [monthlyRecords, setMonthlyRecords] = useState<TeacherAttendanceRecord[]>([])

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [targetDateForEdit, setTargetDateForEdit] = useState<string>(todayStr)
  const [editStatus, setEditStatus] = useState<TeacherAttendanceStatus>('PRESENT')
  const [editCheckIn, setEditCheckIn] = useState<string>('')
  const [editCheckOut, setEditCheckOut] = useState<string>('')
  const [editRemarks, setEditRemarks] = useState<string>('')
  const [editReason, setEditReason] = useState<string>('Admin direct correction')

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // 1. Fetch Teacher Info & Attendance
  const loadData = async () => {
    if (!schoolId || !teacherId) return
    try {
      setLoading(true)

      // Fetch teacher staff member info
      const { data: staffData, error: staffErr } = await supabase
        .from('staff')
        .select('*')
        .eq('id', teacherId)
        .single()

      if (staffErr || !staffData) {
        console.error('Teacher staff member not found:', staffErr?.message)
        setTeacher(null)
        setLoading(false)
        return
      }

      setTeacher(staffData)

      // Fetch monthly attendance records
      const records = await getTeacherMonthlyAttendance(schoolId, teacherId, selectedYear, selectedMonth)
      setMonthlyRecords(records)
    } catch (err) {
      console.error('Error loading individual teacher attendance:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (schoolId && teacherId) {
      void loadData()
    }
  }, [schoolId, teacherId, selectedYear, selectedMonth])

  // Monthly Stats
  const monthlyStats = useMemo(() => {
    const presentCount = monthlyRecords.filter(r => r.status === 'PRESENT').length
    const absentCount = monthlyRecords.filter(r => r.status === 'ABSENT').length
    const halfDayCount = monthlyRecords.filter(r => r.status === 'HALF_DAY').length
    const leaveCount = monthlyRecords.filter(r => r.status === 'LEAVE').length

    const totalMarkedDays = presentCount + absentCount + halfDayCount + leaveCount
    const effectivePresent = presentCount + halfDayCount * 0.5
    const attendancePercentage = totalMarkedDays > 0
      ? Number(((effectivePresent / totalMarkedDays) * 100).toFixed(1))
      : 100

    return {
      present: presentCount,
      absent: absentCount,
      halfDay: halfDayCount,
      leave: leaveCount,
      percentage: attendancePercentage,
      totalMarked: totalMarkedDays
    }
  }, [monthlyRecords])

  // Open Edit Modal for a Date
  const openEditModalForDate = (dateStr: string, currentRecord?: TeacherAttendanceRecord) => {
    setTargetDateForEdit(dateStr)
    setEditStatus(currentRecord ? currentRecord.status : 'PRESENT')
    setEditCheckIn(currentRecord?.check_in ? new Date(currentRecord.check_in).toTimeString().slice(0, 5) : '')
    setEditCheckOut(currentRecord?.check_out ? new Date(currentRecord.check_out).toTimeString().slice(0, 5) : '')
    setEditRemarks(currentRecord?.remarks || '')
    setEditReason('Admin direct attendance correction')
    setIsEditModalOpen(true)
  }

  const handleAdminSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schoolId || !teacherId || !profile) return

    try {
      setActionLoading(true)

      let checkInIso: string | null = null
      let checkOutIso: string | null = null

      if (editCheckIn) {
        checkInIso = new Date(`${targetDateForEdit}T${editCheckIn}:00`).toISOString()
      }
      if (editCheckOut) {
        checkOutIso = new Date(`${targetDateForEdit}T${editCheckOut}:00`).toISOString()
      }

      const res = await adminUpdateTeacherAttendance({
        schoolId,
        teacherId,
        attendanceDate: targetDateForEdit,
        status: editStatus,
        checkIn: checkInIso,
        checkOut: checkOutIso,
        remarks: editRemarks,
        adminUserId: profile.id,
        reason: editReason || 'Admin direct correction'
      })

      if (res.success) {
        showToast('Attendance record saved successfully!', 'success')
        setIsEditModalOpen(false)
        await loadData()
      } else {
        showToast(res.error || 'Failed to save attendance', 'error')
      }
    } catch (e: any) {
      showToast(e.message || 'Save error', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Month Navigation
  const prevMonth = () => {
    setCurrentDate(new Date(selectedYear, currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(selectedYear, currentDate.getMonth() + 1, 1))
  }

  // Calendar Days
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const firstDayIndex = new Date(selectedYear, selectedMonth - 1, 1).getDay()

    const daysArray: ({ dateStr: string; dayNum: number; record?: TeacherAttendanceRecord } | null)[] = []

    for (let i = 0; i < firstDayIndex; i++) {
      daysArray.push(null)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const record = monthlyRecords.find(r => r.attendance_date === dateStr)
      daysArray.push({
        dateStr,
        dayNum: d,
        record
      })
    }

    return daysArray
  }, [selectedYear, selectedMonth, monthlyRecords])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!teacher) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 flex flex-col items-center justify-center text-center space-y-4">
        <h2 className="text-xl font-bold">Teacher Not Found</h2>
        <p className="text-slate-400 text-xs">The requested teacher staff record could not be found.</p>
        <Link href="/dashboard/staff/attendance" className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs">
          Back to Teacher Attendance
        </Link>
      </div>
    )
  }

  return (
    <>
      <ClientAuth />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold text-white transition-all animate-bounce ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{toast.message}</span>
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                <Link href="/dashboard" className="hover:underline">Dashboard</Link>
                <span>/</span>
                <Link href="/dashboard/staff/attendance" className="hover:underline">Teacher Attendance</Link>
                <span>/</span>
                <span>{teacher.full_name}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">{teacher.full_name} — Attendance Profile</h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                Detailed attendance log for teacher staff member at {schoolName || 'SchoolOS'}.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => openEditModalForDate(todayStr)}
                className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 cursor-pointer"
              >
                + Mark/Edit Attendance
              </button>
            </div>
          </div>

          {/* TEACHER PROFILE SUMMARY CARD */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-black text-xl flex items-center justify-center shadow-md">
                {teacher.full_name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-black">{teacher.full_name}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>ID: {teacher.id.slice(0, 8)}</span>
                  <span>•</span>
                  <span>{teacher.email}</span>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                    {teacher.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 flex items-center gap-6">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-indigo-400 block">Attendance Rate</span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{monthlyStats.percentage}%</span>
              </div>
              <div className="h-8 w-px bg-indigo-200 dark:bg-indigo-800" />
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Selected Month</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
              </div>
            </div>
          </div>

          {/* MONTHLY SUMMARY METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 p-5 rounded-3xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Present</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{monthlyStats.present} days</span>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 p-5 rounded-3xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Absent</span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{monthlyStats.absent} days</span>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 p-5 rounded-3xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Half Day</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{monthlyStats.halfDay} days</span>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 p-5 rounded-3xl space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Leave</span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{monthlyStats.leave} days</span>
            </div>
          </div>

          {/* CALENDAR & HISTORY LOG */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition cursor-pointer text-xs font-bold">
                  &lt; Prev
                </button>
                <h3 className="text-base font-black min-w-[150px] text-center">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </h3>
                <button onClick={nextMonth} className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition cursor-pointer text-xs font-bold">
                  Next &gt;
                </button>
              </div>
            </div>

            {/* CALENDAR GRID */}
            <div className="space-y-3">
              <div className="grid grid-cols-7 text-center text-xs font-black text-slate-400 uppercase tracking-wider py-2">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`empty-${idx}`} className="h-20 rounded-2xl bg-slate-50/40 dark:bg-slate-950/40 border border-transparent" />
                  }

                  const { dateStr, dayNum, record } = cell
                  const isToday = dateStr === todayStr

                  return (
                    <div
                      key={dateStr}
                      onClick={() => openEditModalForDate(dateStr, record)}
                      className={`h-20 p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group hover:border-indigo-400 ${
                        isToday
                          ? 'ring-2 ring-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-700'
                          : 'bg-slate-50/80 dark:bg-slate-950/80 border-slate-200/50 dark:border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">{dayNum}</span>
                        {isToday && <span className="text-[9px] font-extrabold text-indigo-500 uppercase">Today</span>}
                      </div>

                      <div>
                        {!record ? (
                          <span className="text-[10px] text-slate-400 block">--</span>
                        ) : record.status === 'PRESENT' ? (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">P</span>
                        ) : record.status === 'HALF_DAY' ? (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">H</span>
                        ) : record.status === 'LEAVE' ? (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">L</span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">A</span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 truncate">{record?.check_in ? formatTimeDisplay(record.check_in) : 'Edit'}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* DETAILED HISTORY TABLE */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">Monthly Attendance Log</h4>
              <div className="overflow-x-auto">
                {monthlyRecords.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No records logged for this month.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Check In</th>
                        <th className="py-2.5 px-3">Check Out</th>
                        <th className="py-2.5 px-3">Working Hours</th>
                        <th className="py-2.5 px-3">Remarks</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {monthlyRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-3 font-bold">{r.attendance_date}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3 px-3">{formatTimeDisplay(r.check_in)}</td>
                          <td className="py-3 px-3">{formatTimeDisplay(r.check_out)}</td>
                          <td className="py-3 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                            {calculateWorkingHours(r.check_in, r.check_out).formatted}
                          </td>
                          <td className="py-3 px-3 text-slate-400">{r.remarks || '-'}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => openEditModalForDate(r.attendance_date, r)}
                              className="text-indigo-600 font-bold hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* EDIT MODAL */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black">Edit Attendance ({targetDateForEdit})</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 font-bold text-xl cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleAdminSave} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="HALF_DAY">HALF DAY</option>
                    <option value="LEAVE">LEAVE</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Check In Time</label>
                    <input
                      type="time"
                      value={editCheckIn}
                      onChange={(e) => setEditCheckIn(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Check Out Time</label>
                    <input
                      type="time"
                      value={editCheckOut}
                      onChange={(e) => setEditCheckOut(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Remarks</label>
                  <input
                    type="text"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Remarks"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Audit Reason</label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Reason for correction"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
