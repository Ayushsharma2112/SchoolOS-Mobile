'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabase'
import { useSchool } from '../../../../../lib/SchoolContext'
import ClientAuth from '../../../ClientAuth'
import {
  TeacherAttendanceRecord,
  TeacherCorrectionRequest,
  TeacherAttendanceStatus,
  getLocalTodayDateStr,
  formatTimeDisplay,
  calculateWorkingHours,
  getSchoolTeacherAttendance,
  getSchoolCorrectionRequests,
  reviewCorrectionRequest,
  adminUpdateTeacherAttendance,
  generateMonthlyAttendanceCSV
} from '../../../../../lib/services/teacherAttendance'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

type TeacherItem = {
  id: string
  full_name: string
  email: string
  role: string
}

export default function AdminTeacherAttendancePage() {
  const { schoolId, schoolName, profile } = useSchool()
  const todayStr = getLocalTodayDateStr()

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Selected Filters
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Data
  const [teachers, setTeachers] = useState<TeacherItem[]>([])
  const [dailyAttendance, setDailyAttendance] = useState<TeacherAttendanceRecord[]>([])
  const [monthlyAttendance, setMonthlyAttendance] = useState<TeacherAttendanceRecord[]>([])
  const [corrections, setCorrections] = useState<TeacherCorrectionRequest[]>([])

  // Tabs & Modals
  const [activeTab, setActiveTab] = useState<'daily' | 'corrections'>('daily')

  // Direct Admin Mark / Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null)
  const [editStatus, setEditStatus] = useState<TeacherAttendanceStatus>('PRESENT')
  const [editCheckIn, setEditCheckIn] = useState<string>('')
  const [editCheckOut, setEditCheckOut] = useState<string>('')
  const [editRemarks, setEditRemarks] = useState<string>('')
  const [editReason, setEditReason] = useState<string>('Administrative manual update')

  // Review Correction Modal
  const [reviewingReq, setReviewingReq] = useState<TeacherCorrectionRequest | null>(null)
  const [reviewRemarks, setReviewRemarks] = useState<string>('')

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Load School Attendance Data
  const loadData = async () => {
    if (!schoolId) return
    try {
      setLoading(true)

      // 1. Fetch Daily Attendance for selectedDate
      const dailyRes = await getSchoolTeacherAttendance(schoolId, selectedDate)
      setTeachers(dailyRes.teachers)
      setDailyAttendance(dailyRes.attendanceRecords)

      // 2. Fetch Monthly Attendance for calculation & export
      const monthlyRes = await getSchoolTeacherAttendance(schoolId, undefined, selectedYear, selectedMonth)
      setMonthlyAttendance(monthlyRes.attendanceRecords)

      // 3. Fetch Correction Requests
      const reqs = await getSchoolCorrectionRequests(schoolId)
      setCorrections(reqs)
    } catch (err) {
      console.error('Error loading admin teacher attendance:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (schoolId) {
      void loadData()
    }
  }, [schoolId, selectedDate, selectedYear, selectedMonth])

  // Summary Metrics for Today / Selected Date
  const summaryMetrics = useMemo(() => {
    const totalTeachers = teachers.length
    let presentCount = 0
    let absentCount = 0
    let halfDayCount = 0
    let leaveCount = 0
    let unmarkedCount = 0

    const attMap = new Map(dailyAttendance.map(r => [r.teacher_id, r]))

    teachers.forEach(t => {
      const rec = attMap.get(t.id)
      if (!rec) {
        unmarkedCount++
      } else if (rec.status === 'PRESENT') {
        presentCount++
      } else if (rec.status === 'HALF_DAY') {
        halfDayCount++
      } else if (rec.status === 'LEAVE') {
        leaveCount++
      } else {
        absentCount++
      }
    })

    return {
      total: totalTeachers,
      present: presentCount,
      absent: absentCount,
      halfDay: halfDayCount,
      leave: leaveCount,
      unmarked: unmarkedCount
    }
  }, [teachers, dailyAttendance])

  // Monthly stats per teacher map (teacherId -> attendance rate %)
  const monthlyStatsMap = useMemo(() => {
    const stats = new Map<string, { present: number; absent: number; halfDay: number; leave: number; totalWorking: number; pct: number }>()

    const attByTeacher = new Map<string, TeacherAttendanceRecord[]>()
    monthlyAttendance.forEach(r => {
      const existing = attByTeacher.get(r.teacher_id) || []
      existing.push(r)
      attByTeacher.set(r.teacher_id, existing)
    })

    teachers.forEach(t => {
      const recs = attByTeacher.get(t.id) || []
      const present = recs.filter(r => r.status === 'PRESENT').length
      const absent = recs.filter(r => r.status === 'ABSENT').length
      const halfDay = recs.filter(r => r.status === 'HALF_DAY').length
      const leave = recs.filter(r => r.status === 'LEAVE').length
      const totalWorking = present + absent + halfDay + leave

      const effectivePresent = present + halfDay * 0.5
      const pct = totalWorking > 0 ? Number(((effectivePresent / totalWorking) * 100).toFixed(1)) : 100

      stats.set(t.id, {
        present,
        absent,
        halfDay,
        leave,
        totalWorking,
        pct
      })
    })

    return stats
  }, [teachers, monthlyAttendance])

  // Filtered Teachers Table Rows
  const filteredTeacherRows = useMemo(() => {
    const attMap = new Map(dailyAttendance.map(r => [r.teacher_id, r]))

    return teachers.filter(t => {
      // Search filter
      const matchesSearch =
        t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.email.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      // Status filter
      const rec = attMap.get(t.id)
      const currentStat = rec ? rec.status : 'NOT_MARKED'

      if (statusFilter === 'all') return true
      return currentStat === statusFilter
    }).map(t => {
      const rec = attMap.get(t.id)
      const mStats = monthlyStatsMap.get(t.id) || { present: 0, absent: 0, halfDay: 0, leave: 0, totalWorking: 0, pct: 100 }
      const workingHours = rec ? calculateWorkingHours(rec.check_in, rec.check_out).formatted : '0h 0m'

      return {
        teacher: t,
        attendance: rec,
        status: rec ? rec.status : 'NOT_MARKED',
        checkIn: rec?.check_in,
        checkOut: rec?.check_out,
        workingHours,
        monthlyPct: mStats.pct
      }
    })
  }, [teachers, dailyAttendance, searchQuery, statusFilter, monthlyStatsMap])

  // Open Edit Modal for a Teacher
  const openEditModal = (t: TeacherItem, currentAtt?: TeacherAttendanceRecord) => {
    setEditingTeacher(t)
    setEditStatus(currentAtt ? currentAtt.status : 'PRESENT')
    setEditCheckIn(currentAtt?.check_in ? new Date(currentAtt.check_in).toTimeString().slice(0, 5) : '')
    setEditCheckOut(currentAtt?.check_out ? new Date(currentAtt.check_out).toTimeString().slice(0, 5) : '')
    setEditRemarks(currentAtt?.remarks || '')
    setEditReason('Administrative attendance edit')
    setIsEditModalOpen(true)
  }

  // Handle Admin Manual Save
  const handleAdminSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schoolId || !editingTeacher || !profile) return

    try {
      setActionLoading(true)

      // Construct ISO check-in/out timestamps if time inputs provided
      let checkInIso: string | null = null
      let checkOutIso: string | null = null

      if (editCheckIn) {
        checkInIso = new Date(`${selectedDate}T${editCheckIn}:00`).toISOString()
      }
      if (editCheckOut) {
        checkOutIso = new Date(`${selectedDate}T${editCheckOut}:00`).toISOString()
      }

      const res = await adminUpdateTeacherAttendance({
        schoolId,
        teacherId: editingTeacher.id,
        attendanceDate: selectedDate,
        status: editStatus,
        checkIn: checkInIso,
        checkOut: checkOutIso,
        remarks: editRemarks,
        adminUserId: profile.id,
        reason: editReason || 'Admin update'
      })

      if (res.success) {
        showToast(`Attendance updated for ${editingTeacher.full_name}`, 'success')
        setIsEditModalOpen(false)
        await loadData()
      } else {
        showToast(res.error || 'Failed to update attendance', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating attendance', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Review Correction (Approve / Reject)
  const handleReviewCorrection = async (action: 'APPROVE' | 'REJECT') => {
    if (!schoolId || !reviewingReq || !profile) return

    try {
      setActionLoading(true)
      const res = await reviewCorrectionRequest({
        requestId: reviewingReq.id,
        schoolId,
        adminUserId: profile.id,
        action,
        reviewRemarks: reviewRemarks.trim()
      })

      if (res.success) {
        showToast(`Correction request ${action.toLowerCase()}d!`, 'success')
        setReviewingReq(null)
        setReviewRemarks('')
        await loadData()
      } else {
        showToast(res.error || 'Failed to review correction request', 'error')
      }
    } catch (e: any) {
      showToast(e.message || 'Review error', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // CSV Export Handler
  const handleExportCSV = () => {
    const rows = teachers.map(t => {
      const stats = monthlyStatsMap.get(t.id) || { present: 0, absent: 0, leave: 0, halfDay: 0, totalWorking: 0, pct: 100 }
      return {
        teacherName: t.full_name,
        teacherEmail: t.email,
        presentDays: stats.present,
        absentDays: stats.absent,
        leaveDays: stats.leave,
        halfDays: stats.halfDay,
        totalWorkingDays: stats.totalWorking,
        attendancePercentage: stats.pct
      }
    })

    const csvContent = generateMonthlyAttendanceCSV({
      schoolName: schoolName || 'SchoolOS',
      year: selectedYear,
      monthName: MONTH_NAMES[selectedMonth - 1],
      rows
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Teacher_Attendance_${MONTH_NAMES[selectedMonth - 1]}_${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Monthly Attendance Report downloaded successfully!', 'success')
  }

  const pendingCount = corrections.filter(c => c.status === 'PENDING').length

  return (
    <>
      <ClientAuth />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
        {/* Toast Notification */}
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
                <Link href="/dashboard/staff" className="hover:underline">Teachers</Link>
                <span>/</span>
                <span>Attendance Management</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Teacher Attendance Command Center</h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                Track, correct, and audit daily & monthly staff attendance records for {schoolName || 'your school'}.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 active:scale-95 transition cursor-pointer flex items-center gap-2"
              >
                <span>📥</span>
                <span>Export Report (CSV)</span>
              </button>
            </div>
          </div>

          {/* TOP SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Staff</span>
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{summaryMetrics.total}</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
              <span className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider block">Present</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{summaryMetrics.present}</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
              <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider block">Absent</span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{summaryMetrics.absent}</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
              <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider block">Half Day</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{summaryMetrics.halfDay}</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
              <span className="text-[10px] font-extrabold text-purple-500 uppercase tracking-wider block">On Leave</span>
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{summaryMetrics.leave}</span>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-4 rounded-3xl shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Not Marked</span>
              <span className="text-2xl font-black text-slate-400">{summaryMetrics.unmarked}</span>
            </div>
          </div>

          {/* MAIN CONTAINER PANEL */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            {/* TABS & FILTERS BAR */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              {/* Tab Selector */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                <button
                  onClick={() => setActiveTab('daily')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === 'daily'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Daily Roster
                </button>

                <button
                  onClick={() => setActiveTab('corrections')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                    activeTab === 'corrections'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>Correction Requests</span>
                  {pendingCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-white">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Filters */}
              {activeTab === 'daily' && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {/* Date Filter */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Date</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>

                  {/* Month / Year Filter for Stats */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Month Stats</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                    >
                      <option value="all">All Statuses</option>
                      <option value="PRESENT">PRESENT</option>
                      <option value="ABSENT">ABSENT</option>
                      <option value="HALF_DAY">HALF DAY</option>
                      <option value="LEAVE">LEAVE</option>
                      <option value="NOT_MARKED">NOT MARKED</option>
                    </select>
                  </div>

                  {/* Search Input */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Search Teacher</label>
                    <input
                      type="text"
                      placeholder="Search name/email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold w-40 sm:w-48"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* TAB 1: DAILY ROSTER TABLE */}
            {activeTab === 'daily' && (
              <div className="overflow-x-auto">
                {filteredTeacherRows.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm font-semibold">No teachers found matching selected criteria.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Teacher</th>
                        <th className="py-3 px-4">Today's Status</th>
                        <th className="py-3 px-4">Check-In</th>
                        <th className="py-3 px-4">Check-Out</th>
                        <th className="py-3 px-4">Working Hours</th>
                        <th className="py-3 px-4">Monthly Rate</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredTeacherRows.map((row) => (
                        <tr key={row.teacher.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-slate-100 block">{row.teacher.full_name}</span>
                              <span className="text-[10px] text-slate-400 block">{row.teacher.email}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {row.status === 'PRESENT' ? (
                              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">PRESENT</span>
                            ) : row.status === 'HALF_DAY' ? (
                              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">HALF DAY</span>
                            ) : row.status === 'LEAVE' ? (
                              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">LEAVE</span>
                            ) : row.status === 'ABSENT' ? (
                              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">ABSENT</span>
                            ) : (
                              <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">NOT MARKED</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">{formatTimeDisplay(row.checkIn)}</td>
                          <td className="py-3.5 px-4">{formatTimeDisplay(row.checkOut)}</td>
                          <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">{row.workingHours}</td>

                          <td className="py-3.5 px-4">
                            <span className={`font-black ${row.monthlyPct >= 90 ? 'text-emerald-600 dark:text-emerald-400' : row.monthlyPct >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {row.monthlyPct}%
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-3">
                            <Link
                              href={`/dashboard/staff/attendance/${row.teacher.id}`}
                              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              View
                            </Link>

                            <button
                              onClick={() => openEditModal(row.teacher, row.attendance)}
                              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:underline cursor-pointer"
                            >
                              Edit/Mark
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB 2: CORRECTION REQUESTS MANAGEMENT */}
            {activeTab === 'corrections' && (
              <div className="overflow-x-auto">
                {corrections.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm font-semibold">No attendance correction requests found.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Teacher</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Current Status</th>
                        <th className="py-3 px-4">Requested Status</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4">Submitted At</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {corrections.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                            {req.teacher_name}
                            <span className="text-[10px] font-normal text-slate-400 block">{req.teacher_email}</span>
                          </td>
                          <td className="py-3.5 px-4 font-bold">{req.attendance_date}</td>
                          <td className="py-3.5 px-4 text-slate-500">{req.current_status}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">{req.requested_status}</td>
                          <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-600 dark:text-slate-300">{req.reason}</td>
                          <td className="py-3.5 px-4 text-slate-400">{new Date(req.created_at).toLocaleDateString()}</td>
                          <td className="py-3.5 px-4">
                            {req.status === 'PENDING' ? (
                              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                PENDING
                              </span>
                            ) : req.status === 'APPROVED' ? (
                              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                APPROVED
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                REJECTED
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {req.status === 'PENDING' ? (
                              <button
                                onClick={() => setReviewingReq(req)}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
                              >
                                Review Request
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Reviewed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ADMIN EDIT / MARK ATTENDANCE MODAL */}
        {isEditModalOpen && editingTeacher && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-black">Edit Teacher Attendance</h3>
                  <p className="text-xs text-slate-400">{editingTeacher.full_name} ({selectedDate})</p>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAdminSave} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Attendance Status</label>
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
                    placeholder="e.g. On-duty event"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Audit Reason (Required)</label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g. Correction upon administrative verification"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
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

        {/* REVIEW CORRECTION REQUEST MODAL */}
        {reviewingReq && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black">Review Correction Request</h3>
                <button
                  onClick={() => setReviewingReq(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Teacher:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{reviewingReq.teacher_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Date:</span>
                    <span className="font-bold">{reviewingReq.attendance_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Current Status:</span>
                    <span className="text-rose-500 font-bold">{reviewingReq.current_status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Requested Status:</span>
                    <span className="text-emerald-500 font-bold">{reviewingReq.requested_status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-1">Teacher Reason:</span>
                    <p className="italic text-slate-600 dark:text-slate-300">{reviewingReq.reason}</p>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Admin Remarks (Optional)</label>
                  <textarea
                    rows={2}
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    placeholder="e.g. Verified presence in logs."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleReviewCorrection('REJECT')}
                    className="px-4 py-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold hover:bg-rose-200 cursor-pointer disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleReviewCorrection('APPROVE')}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : 'Approve Request'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
