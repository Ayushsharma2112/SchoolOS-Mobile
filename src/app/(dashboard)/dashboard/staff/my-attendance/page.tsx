'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabase'
import { useSchool } from '../../../../../lib/SchoolContext'
import ClientAuth from '../../../ClientAuth'
import {
  TeacherAttendanceRecord,
  TeacherCorrectionRequest,
  getLocalTodayDateStr,
  formatTimeDisplay,
  calculateWorkingHours,
  getTeacherTodayAttendance,
  recordTeacherCheckIn,
  recordTeacherCheckOut,
  getTeacherMonthlyAttendance,
  submitTeacherCorrectionRequest,
  getTeacherCorrectionRequests
} from '../../../../../lib/services/teacherAttendance'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function MyAttendancePage() {
  const { schoolId, schoolName } = useSchool()
  const todayStr = getLocalTodayDateStr()

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [teacherName, setTeacherName] = useState<string>('')

  // Today's attendance
  const [todayRecord, setTodayRecord] = useState<TeacherAttendanceRecord | null>(null)

  // Selected Month & Year for History
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const selectedYear = currentDate.getFullYear()
  const selectedMonth = currentDate.getMonth() + 1 // 1-indexed

  // Monthly Records & Correction Requests
  const [monthlyRecords, setMonthlyRecords] = useState<TeacherAttendanceRecord[]>([])
  const [corrections, setCorrections] = useState<TeacherCorrectionRequest[]>([])

  // Views & Modals
  const [activeTab, setActiveTab] = useState<'calendar' | 'list' | 'requests'>('calendar')
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false)
  const [selectedDateForCorrection, setSelectedDateForCorrection] = useState<string>(todayStr)
  const [correctionCurrentStatus, setCorrectionCurrentStatus] = useState<string>('NOT_MARKED')
  const [requestedStatus, setRequestedStatus] = useState<'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'>('PRESENT')
  const [correctionReason, setCorrectionReason] = useState('')

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // 1. Load active teacher staff ID
  useEffect(() => {
    async function initTeacher() {
      if (!schoolId) return
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          setLoading(false)
          return
        }

        const userEmail = session.user.email || ''
        const userId = session.user.id

        // Query staff table by user_id or email
        const { data: staffList, error: staffErr } = await supabase
          .from('staff')
          .select('id, full_name, email')
          .eq('school_id', schoolId)
          .or(`user_id.eq.${userId}${userEmail ? `,email.eq.${userEmail}` : ''}`)
          .limit(1)

        if (staffErr) {
          console.warn('Error fetching teacher staff profile:', staffErr.message)
        }

        if (staffList && staffList.length > 0) {
          setTeacherId(staffList[0].id)
          setTeacherName(staffList[0].full_name)
        } else {
          // Fallback: Check if there's any staff with role Teacher in this school
          const { data: fallbackStaff } = await supabase
            .from('staff')
            .select('id, full_name, email')
            .eq('school_id', schoolId)
            .eq('role', 'Teacher')
            .limit(1)

          if (fallbackStaff && fallbackStaff.length > 0) {
            setTeacherId(fallbackStaff[0].id)
            setTeacherName(fallbackStaff[0].full_name)
          }
        }
      } catch (err) {
        console.error('Error in initTeacher:', err)
      } finally {
        setLoading(false)
      }
    }

    void initTeacher()
  }, [schoolId])

  // 2. Fetch today's attendance and monthly data when teacherId or month changes
  const loadData = async () => {
    if (!schoolId || !teacherId) return
    try {
      setLoading(true)

      // Fetch Today Record
      const todayData = await getTeacherTodayAttendance(schoolId, teacherId, todayStr)
      setTodayRecord(todayData)

      // Fetch Monthly Records
      const records = await getTeacherMonthlyAttendance(schoolId, teacherId, selectedYear, selectedMonth)
      setMonthlyRecords(records)

      // Fetch Correction Requests
      const reqs = await getTeacherCorrectionRequests(schoolId, teacherId)
      setCorrections(reqs)
    } catch (err) {
      console.error('Error loading attendance data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (teacherId) {
      void loadData()
    }
  }, [schoolId, teacherId, selectedYear, selectedMonth])

  // Handlers for Check In / Check Out
  const handleCheckIn = async () => {
    if (!schoolId || !teacherId) return
    try {
      setActionLoading(true)
      const res = await recordTeacherCheckIn(schoolId, teacherId, todayStr)
      if (res.success) {
        showToast('Successfully checked in for today!', 'success')
        await loadData()
      } else {
        showToast(res.error || 'Failed to check in', 'error')
      }
    } catch (e: any) {
      showToast(e.message || 'Check-in error', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!schoolId || !teacherId || !todayRecord) return
    try {
      setActionLoading(true)
      const res = await recordTeacherCheckOut(schoolId, todayRecord.id, teacherId)
      if (res.success) {
        showToast('Successfully checked out!', 'success')
        await loadData()
      } else {
        showToast(res.error || 'Failed to check out', 'error')
      }
    } catch (e: any) {
      showToast(e.message || 'Check-out error', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Monthly stats calculations
  const monthlyStats = useMemo(() => {
    const presentCount = monthlyRecords.filter(r => r.status === 'PRESENT').length
    const absentCount = monthlyRecords.filter(r => r.status === 'ABSENT').length
    const halfDayCount = monthlyRecords.filter(r => r.status === 'HALF_DAY').length
    const leaveCount = monthlyRecords.filter(r => r.status === 'LEAVE').length

    const totalMarkedDays = presentCount + absentCount + halfDayCount + leaveCount
    // Effective present days (present + 0.5 * halfDay)
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

  // Working hours today
  const todayWorkingHours = useMemo(() => {
    if (!todayRecord || !todayRecord.check_in) return '0h 0m'
    return calculateWorkingHours(todayRecord.check_in, todayRecord.check_out).formatted
  }, [todayRecord])

  // Open correction modal for specific date
  const openCorrectionModal = (dateStr: string, currentStat: string = 'NOT_MARKED') => {
    setSelectedDateForCorrection(dateStr)
    setCorrectionCurrentStatus(currentStat)
    setCorrectionReason('')
    setRequestedStatus('PRESENT')
    setIsCorrectionModalOpen(true)
  }

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schoolId || !teacherId) return
    if (!correctionReason.trim()) {
      showToast('Please provide a reason for correction', 'error')
      return
    }

    try {
      setActionLoading(true)
      const existingRecord = monthlyRecords.find(r => r.attendance_date === selectedDateForCorrection)
      
      const res = await submitTeacherCorrectionRequest({
        schoolId,
        teacherId,
        attendanceId: existingRecord?.id,
        attendanceDate: selectedDateForCorrection,
        currentStatus: correctionCurrentStatus,
        requestedStatus,
        reason: correctionReason.trim()
      })

      if (res.success) {
        showToast('Correction request submitted for Admin review!', 'success')
        setIsCorrectionModalOpen(false)
        await loadData()
      } else {
        showToast(res.error || 'Failed to submit correction request', 'error')
      }
    } catch (e: any) {
      showToast(e.message || 'Error submitting request', 'error')
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

  // Generate days for Calendar Grid
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const firstDayIndex = new Date(selectedYear, selectedMonth - 1, 1).getDay()

    const daysArray: ({ dateStr: string; dayNum: number; record?: TeacherAttendanceRecord } | null)[] = []

    // Padding empty cells before month start
    for (let i = 0; i < firstDayIndex; i++) {
      daysArray.push(null)
    }

    // Days of month
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

  return (
    <>
      <ClientAuth />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
        {/* Toast Alert */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold text-white transition-all animate-bounce ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{toast.message}</span>
          </div>
        )}

        {/* Header Breadcrumb */}
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                <Link href="/dashboard" className="hover:underline">Dashboard</Link>
                <span>/</span>
                <span>My Attendance</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Teacher Attendance</h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                Welcome back{teacherName ? `, ${teacherName}` : ''}! Manage your daily check-in, check-out, and attendance logs.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800">
                📅 Today: {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* TOP SECTION: TODAY'S ATTENDANCE STATUS CARD */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">Today's Status</span>
                  {!todayRecord ? (
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Not Marked
                    </span>
                  ) : todayRecord.status === 'PRESENT' ? (
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Present
                    </span>
                  ) : todayRecord.status === 'HALF_DAY' ? (
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Half Day
                    </span>
                  ) : todayRecord.status === 'LEAVE' ? (
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      On Leave
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      Absent
                    </span>
                  )}
                </div>

                {/* Check In / Out Time Displays */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Check-in</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-100">
                      {todayRecord?.check_in ? formatTimeDisplay(todayRecord.check_in) : '--:--'}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Check-out</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-100">
                      {todayRecord?.check_out ? formatTimeDisplay(todayRecord.check_out) : '--:--'}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Working Hours</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                      {todayWorkingHours}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {!todayRecord?.check_in ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    <span>⏱️</span>
                    <span>{actionLoading ? 'Checking In...' : 'CHECK IN'}</span>
                  </button>
                ) : !todayRecord?.check_out ? (
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    <span>🚪</span>
                    <span>{actionLoading ? 'Checking Out...' : 'CHECK OUT'}</span>
                  </button>
                ) : (
                  <div className="px-5 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <span>✓</span>
                    <span>Attendance Complete for Today</span>
                  </div>
                )}

                <button
                  onClick={() => openCorrectionModal(todayStr, todayRecord?.status || 'NOT_MARKED')}
                  className="px-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer active:scale-95"
                >
                  Request Correction
                </button>
              </div>
            </div>
          </div>

          {/* MONTHLY SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Present</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{monthlyStats.present}</span>
                <span className="text-xs font-semibold text-slate-400">days</span>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Absent</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{monthlyStats.absent}</span>
                <span className="text-xs font-semibold text-slate-400">days</span>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Half Day</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{monthlyStats.halfDay}</span>
                <span className="text-xs font-semibold text-slate-400">days</span>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Leave</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{monthlyStats.leave}</span>
                <span className="text-xs font-semibold text-slate-400">days</span>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 p-5 rounded-3xl shadow-sm col-span-2 sm:col-span-1 space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Attendance Rate</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{monthlyStats.percentage}%</span>
                <span className="text-[10px] font-bold text-emerald-500">Target 90%+</span>
              </div>
            </div>
          </div>

          {/* MONTH NAVIGATION & VIEWS HEADER */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  &lt; Prev
                </button>
                <h2 className="text-lg font-black tracking-tight min-w-[150px] text-center">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </h2>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Next &gt;
                </button>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === 'calendar'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Calendar Grid
                </button>
                <button
                  onClick={() => setActiveTab('list')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === 'list'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Detailed History
                </button>
                <button
                  onClick={() => setActiveTab('requests')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer relative ${
                    activeTab === 'requests'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Corrections ({corrections.length})
                </button>
              </div>
            </div>

            {/* TAB 1: CALENDAR GRID */}
            {activeTab === 'calendar' && (
              <div className="space-y-4">
                <div className="grid grid-cols-7 text-center text-xs font-black text-slate-400 uppercase tracking-wider py-2">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${idx}`} className="h-20 sm:h-24 rounded-2xl bg-slate-50/40 dark:bg-slate-950/40 border border-transparent" />
                    }

                    const { dateStr, dayNum, record } = cell
                    const isToday = dateStr === todayStr

                    return (
                      <div
                        key={dateStr}
                        onClick={() => openCorrectionModal(dateStr, record?.status || 'NOT_MARKED')}
                        className={`h-20 sm:h-24 p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group hover:border-indigo-400 dark:hover:border-indigo-600 ${
                          isToday
                            ? 'ring-2 ring-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-700'
                            : 'bg-slate-50/80 dark:bg-slate-950/80 border-slate-200/50 dark:border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {dayNum}
                          </span>
                          {isToday && <span className="text-[9px] font-extrabold uppercase text-indigo-500">Today</span>}
                        </div>

                        <div className="mt-1">
                          {!record ? (
                            <span className="text-[10px] font-bold text-slate-400 block">--</span>
                          ) : record.status === 'PRESENT' ? (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              P
                            </span>
                          ) : record.status === 'HALF_DAY' ? (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              H
                            </span>
                          ) : record.status === 'LEAVE' ? (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              L
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              A
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                          {record?.check_in ? formatTimeDisplay(record.check_in) : 'Click to edit'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: DETAILED HISTORY TABLE */}
            {activeTab === 'list' && (
              <div className="overflow-x-auto">
                {monthlyRecords.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm font-semibold">No attendance recorded for this month.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Check-In</th>
                        <th className="py-3 px-4">Check-Out</th>
                        <th className="py-3 px-4">Working Hours</th>
                        <th className="py-3 px-4">Remarks</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {monthlyRecords.map((rec) => {
                        const wh = calculateWorkingHours(rec.check_in, rec.check_out).formatted
                        return (
                          <tr key={rec.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                              {new Date(rec.attendance_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="py-3.5 px-4">
                              {rec.status === 'PRESENT' ? (
                                <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">PRESENT</span>
                              ) : rec.status === 'HALF_DAY' ? (
                                <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">HALF DAY</span>
                              ) : rec.status === 'LEAVE' ? (
                                <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">LEAVE</span>
                              ) : (
                                <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">ABSENT</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">{formatTimeDisplay(rec.check_in)}</td>
                            <td className="py-3.5 px-4">{formatTimeDisplay(rec.check_out)}</td>
                            <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">{wh}</td>
                            <td className="py-3.5 px-4 text-slate-400 max-w-[200px] truncate">{rec.remarks || '-'}</td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => openCorrectionModal(rec.attendance_date, rec.status)}
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                Fix Record
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB 3: CORRECTION REQUESTS HISTORY */}
            {activeTab === 'requests' && (
              <div className="overflow-x-auto">
                {corrections.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm font-semibold">No correction requests submitted.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Current</th>
                        <th className="py-3 px-4">Requested</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4">Submitted At</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {corrections.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-bold">{req.attendance_date}</td>
                          <td className="py-3.5 px-4 text-slate-500">{req.current_status}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">{req.requested_status}</td>
                          <td className="py-3.5 px-4 max-w-[250px] truncate text-slate-600 dark:text-slate-300">{req.reason}</td>
                          <td className="py-3.5 px-4 text-slate-400">{new Date(req.created_at).toLocaleDateString()}</td>
                          <td className="py-3.5 px-4">
                            {req.status === 'PENDING' ? (
                              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                PENDING REVIEW
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CORRECTION REQUEST MODAL */}
        {isCorrectionModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-black">Request Attendance Correction</h3>
                <button
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCorrectionSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Target Date</label>
                  <input
                    type="date"
                    value={selectedDateForCorrection}
                    onChange={(e) => setSelectedDateForCorrection(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Current Status</label>
                    <input
                      type="text"
                      disabled
                      value={correctionCurrentStatus}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 font-semibold text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Requested Status</label>
                    <select
                      value={requestedStatus}
                      onChange={(e) => setRequestedStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                    >
                      <option value="PRESENT">PRESENT</option>
                      <option value="HALF_DAY">HALF DAY</option>
                      <option value="LEAVE">LEAVE</option>
                      <option value="ABSENT">ABSENT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">Reason for Correction</label>
                  <textarea
                    rows={3}
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="e.g. I was present on campus but forgot to record digital check-in."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCorrectionModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Submitting...' : 'Submit Request'}
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
