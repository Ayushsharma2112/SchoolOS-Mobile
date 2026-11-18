'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { useSchool } from '../../../lib/SchoolContext'

type Student = {
  id: string
  full_name: string
  class_name: string
  created_at?: string
}

type AttendanceRecord = {
  id: string
  student_id: string
  school_id: string
  date: string
  status: 'present' | 'absent'
}

type AttendanceMap = {
  [studentId: string]: 'present' | 'absent'
}

type AttendanceMeta = {
  late: { [key: string]: boolean }    // studentId_date -> boolean
  leave: { [key: string]: boolean }   // studentId_date -> boolean
  remarks: { [key: string]: string }  // studentId_date -> string
}

type Holiday = {
  date: string // YYYY-MM-DD
  name: string
}

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AttendancePage() {
  const { schoolId, schoolName } = useSchool()
  const todayDate = getTodayDate()

  const [activeTab, setActiveTab] = useState<'daily' | 'rollcall' | 'monthly' | 'analytics' | 'holidays'>('daily')
  const [selectedDate, setSelectedDate] = useState<string>(todayDate)
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'present' | 'absent' | 'late' | 'leave' | 'unmarked'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Core Data Lists
  const [students, setStudents] = useState<Student[]>([])
  const [dbAttendance, setDbAttendance] = useState<AttendanceMap>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  
  // Custom states
  const [attendanceMeta, setAttendanceMeta] = useState<AttendanceMeta>({
    late: {},
    leave: {},
    remarks: {}
  })
  const [holidays, setHolidays] = useState<Holiday[]>([
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-12-25', name: 'Christmas Day' }
  ])

  // Roll call deck index
  const [currentDeckIndex, setCurrentDeckIndex] = useState<number>(0)

  // Late/Remark entry modal states
  const [activePromptId, setActivePromptId] = useState<string | null>(null)
  const [promptType, setPromptType] = useState<'late' | 'leave' | 'remark'>('late')
  const [promptText, setPromptText] = useState<string>('')

  // Notify state simulation
  const [isNotifying, setIsNotifying] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load holidays and metadata from Local Storage
  const loadLocalStorage = () => {
    if (!schoolId) return
    const metaKey = `schoolos_attendance_meta_${schoolId}`
    const holidayKey = `schoolos_holidays_${schoolId}`

    const storedMeta = localStorage.getItem(metaKey)
    if (storedMeta) {
      try {
        setAttendanceMeta(JSON.parse(storedMeta))
      } catch (e) {
        console.error('Failed to parse attendance meta', e)
      }
    } else {
      // Seed some demo late/leave records for realistic metrics
      const mockMeta: AttendanceMeta = {
        late: {},
        leave: {},
        remarks: {}
      }
      localStorage.setItem(metaKey, JSON.stringify(mockMeta))
      setAttendanceMeta(mockMeta)
    }

    const storedHolidays = localStorage.getItem(holidayKey)
    if (storedHolidays) {
      try {
        setHolidays(JSON.parse(storedHolidays))
      } catch (e) {
        console.error('Failed to parse holidays', e)
      }
    } else {
      localStorage.setItem(holidayKey, JSON.stringify(holidays))
    }
  }

  // Fetch student roster and attendance record list for selected date
  const loadData = async () => {
    if (!schoolId) return
    try {
      setLoading(true)
      
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, full_name, class_name, created_at')
        .eq('school_id', schoolId)
        .order('full_name')

      if (studentsError) throw studentsError
      setStudents(studentsData || [])

      const today = new Date(selectedDate)
      const year = today.getFullYear()
      const month = today.getMonth()
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('school_id', schoolId)

      if (attendanceError) throw attendanceError

      const map: AttendanceMap = {}
      attendanceData?.forEach((record: AttendanceRecord) => {
        map[`${record.student_id}_${record.date}`] = record.status
      })
      setDbAttendance(map)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!schoolId) return
    loadLocalStorage()
    void loadData()
  }, [schoolId, selectedDate])

  // Save Meta to Local Storage
  const saveMeta = (updatedMeta: AttendanceMeta) => {
    if (!schoolId) return
    localStorage.setItem(`schoolos_attendance_meta_${schoolId}`, JSON.stringify(updatedMeta))
    setAttendanceMeta(updatedMeta)
  }

  // Primary Attendance Trigger
  const markAttendance = async (studentId: string, statusType: 'present' | 'absent' | 'late' | 'leave', customRemark?: string) => {
    if (!schoolId) return
    setSavingId(studentId)
    try {
      // Map late to present, leave to absent to satisfy DB constraints
      const dbStatus: 'present' | 'absent' = (statusType === 'present' || statusType === 'late') ? 'present' : 'absent'

      const { error } = await supabase
        .from('attendance')
        .upsert(
          {
            school_id: schoolId,
            student_id: studentId,
            date: selectedDate,
            status: dbStatus
          },
          {
            onConflict: 'student_id,date'
          }
        )

      if (error) {
        alert(error.message)
        return
      }

      // Update Local Metadata Map
      const updatedMeta = { ...attendanceMeta }
      const key = `${studentId}_${selectedDate}`

      if (statusType === 'late') {
        updatedMeta.late[key] = true
        delete updatedMeta.leave[key]
      } else if (statusType === 'leave') {
        updatedMeta.leave[key] = true
        delete updatedMeta.late[key]
      } else {
        delete updatedMeta.late[key]
        delete updatedMeta.leave[key]
      }

      if (customRemark) {
        updatedMeta.remarks[key] = customRemark
      } else if (statusType !== 'late' && statusType !== 'leave') {
        delete updatedMeta.remarks[key]
      }

      saveMeta(updatedMeta)

      setDbAttendance(prev => ({
        ...prev,
        [`${studentId}_${selectedDate}`]: dbStatus
      }))

    } catch (e) {
      console.error(e)
    } finally {
      setSavingId(null)
    }
  }

  // Handle late entry remark prompt
  const openPrompt = (studentId: string, type: 'late' | 'leave' | 'remark') => {
    const key = `${studentId}_${selectedDate}`
    setPromptText(attendanceMeta.remarks[key] || '')
    setPromptType(type)
    setActivePromptId(studentId)
  }

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activePromptId) return
    
    void markAttendance(activePromptId, promptType as any, promptText.trim())
    setActivePromptId(null)
    setPromptText('')
    showToast(`Saved status and logged remark successfully!`)
  }

  // Bulk Actions
  const handleBulkMark = async (type: 'present' | 'absent' | 'late' | 'leave') => {
    if (filteredStudents.length === 0 || !schoolId) return
    if (!confirm(`Mark all ${filteredStudents.length} filtered students as ${type.toUpperCase()}?`)) return

    setLoading(true)
    try {
      const dbStatus: 'present' | 'absent' = (type === 'present' || type === 'late') ? 'present' : 'absent'

      // Upsert promises for Supabase
      const promises = filteredStudents.map(student =>
        supabase.from('attendance').upsert(
          {
            school_id: schoolId,
            student_id: student.id,
            date: selectedDate,
            status: dbStatus
          },
          {
            onConflict: 'student_id,date'
          }
        )
      )

      await Promise.all(promises)

      // Update Local Metadata Map in Bulk
      const updatedMeta = { ...attendanceMeta }
      const newDbAttendance = { ...dbAttendance }

      filteredStudents.forEach(student => {
        const key = `${student.id}_${selectedDate}`
        newDbAttendance[key] = dbStatus

        if (type === 'late') {
          updatedMeta.late[key] = true
          delete updatedMeta.leave[key]
        } else if (type === 'leave') {
          updatedMeta.leave[key] = true
          delete updatedMeta.late[key]
        } else {
          delete updatedMeta.late[key]
          delete updatedMeta.leave[key]
        }
      })

      saveMeta(updatedMeta)
      setDbAttendance(newDbAttendance)
      showToast(`Bulk updated ${filteredStudents.length} student records successfully!`)
    } catch (e) {
      console.error(e)
      alert('Error updating bulk attendance records')
    } finally {
      setLoading(false)
    }
  }

  // Holiday checks
  const currentHoliday = useMemo(() => {
    return holidays.find(h => h.date === selectedDate)
  }, [holidays, selectedDate])

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const dateInput = form.elements.namedItem('holidayDate') as HTMLInputElement
    const nameInput = form.elements.namedItem('holidayName') as HTMLInputElement

    if (!dateInput.value || !nameInput.value.trim() || !schoolId) return

    const newHoliday: Holiday = {
      date: dateInput.value,
      name: nameInput.value.trim()
    }

    const updated = [...holidays, newHoliday].sort((a, b) => a.date.localeCompare(b.date))
    setHolidays(updated)
    localStorage.setItem(`schoolos_holidays_${schoolId}`, JSON.stringify(updated))
    form.reset()
    showToast('Holiday calendar date added successfully!')
  }

  const handleDeleteHoliday = (date: string) => {
    if (!confirm('Erase this holiday from the school calendar?') || !schoolId) return
    const updated = holidays.filter(h => h.date !== date)
    setHolidays(updated)
    localStorage.setItem(`schoolos_holidays_${schoolId}`, JSON.stringify(updated))
    showToast('Holiday calendar date deleted.')
  }

  // Available classes lists
  const availableClasses = useMemo(() => {
    return Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort()
  }, [students])

  // Get active status from database status & local storage metadata
  const getExtendedStatus = (studentId: string, date: string = selectedDate) => {
    const key = `${studentId}_${date}`
    const dbStatus = dbAttendance[key]
    if (!dbStatus) return 'unmarked'

    if (dbStatus === 'present') {
      if (attendanceMeta.late[key]) return 'late'
      return 'present'
    } else {
      if (attendanceMeta.leave[key]) return 'leave'
      return 'absent'
    }
  }

  // Filtering Student roster
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 1. Class filter
      if (selectedClass !== 'all' && student.class_name !== selectedClass) return false

      // 2. Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase()
        if (!student.full_name.toLowerCase().includes(query)) return false
      }

      // 3. Status filter
      const status = getExtendedStatus(student.id)
      if (selectedStatus !== 'all' && status !== selectedStatus) return false

      return true
    })
  }, [students, selectedClass, searchQuery, selectedStatus, dbAttendance, attendanceMeta, selectedDate])

  // Computed summary rates
  const stats = useMemo(() => {
    const classFiltered = selectedClass === 'all' ? students : students.filter(s => s.class_name === selectedClass)
    const total = classFiltered.length

    let present = 0
    let absent = 0
    let late = 0
    let leave = 0
    let unmarked = 0

    classFiltered.forEach(s => {
      const status = getExtendedStatus(s.id)
      if (status === 'present') present++
      else if (status === 'absent') absent++
      else if (status === 'late') late++
      else if (status === 'leave') leave++
      else unmarked++
    })

    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0
    const lateRate = total > 0 ? Math.round((late / total) * 100) : 0

    return { total, present, absent, late, leave, unmarked, rate, lateRate }
  }, [students, selectedClass, dbAttendance, attendanceMeta, selectedDate])

  // Get index human readable Stu-N
  const studentIndexIdMap = useMemo(() => {
    const map = new Map<string, string>()
    students.forEach((s, idx) => {
      map.set(s.id, `Stu-${idx + 1}`)
    })
    return map
  }, [students])

  // Weekly calendar columns for rendering Weekly view or Monthly calendars
  const monthlyDates = useMemo(() => {
    const dates = []
    const today = new Date(selectedDate)
    const year = today.getFullYear()
    const month = today.getMonth() // 0-11
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      dates.push({
        dayStr: String(day).padStart(2, '0'),
        fullDate: dStr,
        isWeekend: new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6
      })
    }
    return dates
  }, [selectedDate])

  // Simulate parent SMS broadcast
  const handleNotifyParents = () => {
    setIsNotifying(true)
    setTimeout(() => {
      setIsNotifying(false)
      showToast(`SMS notifications successfully broadcasted to ${stats.absent + stats.late} parents!`, 'success')
    }, 1500)
  }

  // Keyboard Navigation deck actions
  useEffect(() => {
    if (activeTab !== 'rollcall' || filteredStudents.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const student = filteredStudents[currentDeckIndex]
      if (!student) return

      if (e.key.toLowerCase() === 'p') {
        void markAttendance(student.id, 'present')
        handleNextCard()
      } else if (e.key.toLowerCase() === 'a') {
        void markAttendance(student.id, 'absent')
        handleNextCard()
      } else if (e.key.toLowerCase() === 'l') {
        openPrompt(student.id, 'late')
      } else if (e.key.toLowerCase() === 'v') {
        void markAttendance(student.id, 'leave')
        handleNextCard()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, currentDeckIndex, filteredStudents, attendanceMeta, dbAttendance])

  const handleNextCard = () => {
    if (currentDeckIndex < filteredStudents.length - 1) {
      setCurrentDeckIndex(prev => prev + 1)
    }
  }

  const handlePrevCard = () => {
    if (currentDeckIndex > 0) {
      setCurrentDeckIndex(prev => prev - 1)
    }
  }

  const handleExportCSV = () => {
    if (students.length === 0) return
    
    const monthLabel = new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    let csvContent = `Attendance Report - ${monthLabel}\n`
    csvContent += `Student Name,Class,` + monthlyDates.map(d => d.dayStr).join(',') + `,Presents,Absents,Late,Leaves,Rate\n`
    
    students.forEach(student => {
      if (selectedClass !== 'all' && student.class_name !== selectedClass) return
      
      let row = `"${student.full_name}",Class ${student.class_name},`
      let pCount = 0, aCount = 0, lCount = 0, lvCount = 0
      
      const dateStatuses = monthlyDates.map(date => {
        const status = getExtendedStatus(student.id, date.fullDate)
        if (status === 'present') pCount++
        else if (status === 'absent') aCount++
        else if (status === 'late') lCount++
        else if (status === 'leave') lvCount++
        return status.toUpperCase()
      })
      
      const total = pCount + aCount + lCount + lvCount
      const rate = total > 0 ? Math.round(((pCount + lCount) / total) * 100) : 0
      
      row += dateStatuses.join(',') + `,${pCount},${aCount},${lCount},${lvCount},${rate}%\n`
      csvContent += row
    })
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `attendance_report_${selectedClass}_${selectedDate.slice(0, 7)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('CSV downloaded successfully!')
  }

  const handleExportPDF = () => {
    const monthLabel = new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let html = `
      <html>
        <head>
          <title>Attendance Report - ${monthLabel}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            p { font-size: 11px; margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            th, td { border: 1px solid #ddd; padding: 5px 3px; text-align: center; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .student-name { text-align: left; font-weight: bold; padding-left: 8px; }
            .weekend { background-color: #fafafa; color: #ccc; }
            .present { color: #10b981; font-weight: bold; }
            .absent { color: #ef4444; font-weight: bold; }
            .late { color: #f59e0b; font-weight: bold; }
            .leave { color: #f97316; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>${schoolName || 'Green Valley Public School'} - Attendance Matrix</h1>
          <p>Report Period: ${monthLabel} | Class: ${selectedClass.toUpperCase()}</p>
          <table>
            <thead>
              <tr>
                <th style="width: 150px; text-align: left; padding-left: 8px;">Student Name</th>
                ${monthlyDates.map(d => `<th>${d.dayStr}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${students.map(student => {
                if (selectedClass !== 'all' && student.class_name !== selectedClass) return ''
                return `
                  <tr>
                    <td class="student-name">${student.full_name}</td>
                    ${monthlyDates.map(date => {
                      const status = getExtendedStatus(student.id, date.fullDate)
                      let char = '-'
                      let clsName = ''
                      if (status === 'present') { char = 'P'; clsName = 'present'; }
                      else if (status === 'absent') { char = 'A'; clsName = 'absent'; }
                      else if (status === 'late') { char = 'L'; clsName = 'late'; }
                      else if (status === 'leave') { char = 'V'; clsName = 'leave'; }
                      return `<td class="${date.isWeekend ? 'weekend' : ''} ${clsName}">${char}</td>`
                    }).join('')}
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-300">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
          </svg>
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Main Page structure */}
      <div className="max-w-[1400px] mx-auto space-y-6 text-slate-800 font-sans pb-16 text-left">
        
        {/* Header Breadcrumbs & Actions */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 select-none">
            <Link href="/dashboard" className="hover:text-[#4f46e5] transition">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-500">Attendance</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div>
              <h1 className="text-xl font-black text-slate-905 tracking-tight leading-none">Attendance Dashboard</h1>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Monitor, analyze and record student attendance across classrooms.</p>
            </div>

            {/* Date selector indicator */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-400">Target Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value)
                  setCurrentDeckIndex(0)
                }}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition shadow-sm cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Visual Dashboard Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* KPI Stats Grid Box */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200/50 rounded-2xl p-3 shadow-sm space-y-0.5 flex flex-col justify-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Class Size</span>
              <h4 className="text-base font-black text-slate-800 tracking-tight">{stats.total}</h4>
            </div>
            <div className="bg-white border border-emerald-100 rounded-2xl p-3 shadow-sm space-y-0.5 bg-emerald-50/10 flex flex-col justify-center">
              <span className="text-[9px] font-black text-emerald-600/70 uppercase tracking-wider block">Present</span>
              <h4 className="text-base font-black text-emerald-600 tracking-tight">{stats.present}</h4>
            </div>
            <div className="bg-white border border-rose-100 rounded-2xl p-3 shadow-sm space-y-0.5 bg-rose-50/10 flex flex-col justify-center">
              <span className="text-[9px] font-black text-rose-600/70 uppercase tracking-wider block">Absent</span>
              <h4 className="text-base font-black text-rose-600 tracking-tight">{stats.absent}</h4>
            </div>
            <div className="bg-white border border-amber-100 rounded-2xl p-3 shadow-sm space-y-0.5 bg-amber-50/10 flex flex-col justify-center">
              <span className="text-[9px] font-black text-amber-600/70 uppercase tracking-wider block">Late</span>
              <h4 className="text-base font-black text-amber-600 tracking-tight">{stats.late}</h4>
            </div>
            <div className="bg-white border border-orange-100 rounded-2xl p-3 shadow-sm space-y-0.5 bg-orange-50/10 flex flex-col justify-center">
              <span className="text-[9px] font-black text-orange-600/70 uppercase tracking-wider block">Leave</span>
              <h4 className="text-base font-black text-orange-600 tracking-tight">{stats.leave}</h4>
            </div>
            <div className="bg-gradient-to-tr from-indigo-50/80 to-violet-50/80 border border-indigo-100/60 rounded-2xl p-3 shadow-sm space-y-0.5 flex flex-col justify-center">
              <span className="text-[9px] font-black text-indigo-700/80 uppercase tracking-wider block">Rate</span>
              <h4 className="text-base font-black text-indigo-700 tracking-tight">{stats.rate}%</h4>
            </div>
          </div>

          {/* Present Rate Donut chart */}
          <div className="bg-white border border-slate-200/40 rounded-3xl p-4 shadow-sm text-center flex flex-col justify-between">
            <strong className="text-[10px] font-black text-slate-805 uppercase tracking-wider block border-b pb-1">Global Attendance Rate</strong>
            
            <div className="relative h-24 w-24 mx-auto flex items-center justify-center shrink-0 my-1">
              <svg className="absolute inset-0 transform -rotate-90" width="96" height="96">
                <circle cx="48" cy="48" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
                <circle cx="48" cy="48" r="38" fill="transparent" stroke="#10b981" strokeWidth="8" strokeDasharray="238.7" strokeDashoffset={238.7 - (238.7 * stats.rate) / 100} strokeLinecap="round" />
              </svg>
              <div className="text-center font-sans">
                <span className="text-lg font-black text-slate-805 block">{stats.rate}%</span>
                <span className="text-[8px] text-slate-400 block font-bold uppercase">Average</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-1.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block">Rate</span>
                <strong className="text-slate-700 font-bold block">{stats.rate}%</strong>
              </div>
              <div className="p-1.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 block">Lateness</span>
                <strong className="text-slate-750 font-bold block">{stats.lateRate}%</strong>
              </div>
            </div>
          </div>

          {/* Weekly Trend Line chart */}
          <div className="bg-white border border-slate-200/40 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
            <strong className="text-[10px] font-black text-slate-800 uppercase tracking-wider block border-b pb-1">Weekly Attendance Trend</strong>
            
            <div className="relative h-24 w-full select-none mt-1">
              <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="50" x2="500" y2="50" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />

                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <path
                  d="M 10 70 Q 100 25 200 45 T 400 15 L 490 28 L 490 100 L 10 100 Z"
                  fill="url(#chartGradient)"
                />
                <path
                  d="M 10 70 Q 100 25 200 45 T 400 15 L 490 28"
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                <circle cx="200" cy="45" r="4.5" fill="#4f46e5" stroke="white" strokeWidth="1.5" />
                <circle cx="400" cy="15" r="4.5" fill="#4f46e5" stroke="white" strokeWidth="1.5" />
              </svg>

              <div className="flex justify-between items-center text-[7px] font-bold text-slate-400 uppercase tracking-widest pt-1">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
              </div>
            </div>
          </div>
        </div>

        {/* Holiday banner alerts if matching */}
        {currentHoliday && (
          <div className="bg-blue-50/50 border border-blue-200 text-blue-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl select-none">🎉</span>
              <div className="text-left font-sans">
                <strong className="text-sm font-black block">Holiday Calendar Day</strong>
                <span className="text-xs font-semibold text-blue-600/90">{currentHoliday.name}</span>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-100 rounded-xl text-[10px] font-black uppercase tracking-wider">Inputs Disabled</span>
          </div>
        )}

        {/* Global Filter Bar */}
        <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3.5 py-2 border border-slate-205 text-slate-805 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-52"
            />

            {/* Class selector */}
            <select
              value={selectedClass}
              onChange={e => {
                setSelectedClass(e.target.value)
                setCurrentDeckIndex(0)
              }}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-650 cursor-pointer outline-none w-full sm:w-40"
            >
              <option value="all">All Classes</option>
              {availableClasses.map(cls => (
                <option key={cls} value={cls}>Class {cls}</option>
              ))}
            </select>

            {/* Status Segmented Buttons */}
            <div className="flex bg-slate-100/80 p-1 rounded-xl items-center border border-slate-200/40 select-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'present', label: 'Present' },
                { id: 'absent', label: 'Absent' },
                { id: 'late', label: 'Late' },
                { id: 'leave', label: 'Leave' },
                { id: 'unmarked', label: 'Unmarked' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedStatus(item.id as any)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                    selectedStatus === item.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-855'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk operations - only visible if daily sheet is active */}
          {activeTab === 'daily' && !currentHoliday && filteredStudents.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider hidden sm:inline">Bulk Mark:</span>
              <button 
                onClick={() => handleBulkMark('present')}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-lg border border-emerald-250 shadow-sm"
              >
                Present
              </button>
              <button 
                onClick={() => handleBulkMark('absent')}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black uppercase rounded-lg border border-rose-250 shadow-sm"
              >
                Absent
              </button>
            </div>
          )}
        </div>

        {/* Tab Controls Bar */}
        <div className="bg-white border border-slate-200/50 rounded-3xl p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex flex-wrap gap-1 select-none font-semibold">
          {[
            { id: 'daily', label: 'Daily Sheet' },
            { id: 'rollcall', label: 'Roll Call Deck' },
            { id: 'monthly', label: 'Monthly Matrix' },
            { id: 'analytics', label: 'Analytics & Reports' },
            { id: 'holidays', label: 'Holidays & Settings' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any)
                setCurrentDeckIndex(0)
              }}
              className={`px-4 py-2 text-[11px] font-bold rounded-xl transition ${
                activeTab === tab.id
                  ? 'bg-[#4f46e5] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: DAILY SHEET VIEW */}
        {activeTab === 'daily' && (
          <div className="space-y-4">

            {/* Daily grid list */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-28 bg-white border border-slate-100 rounded-3xl" />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-150 border-dashed p-16 text-center max-w-2xl mx-auto shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
                <span className="text-4xl block mb-4 select-none">🔍</span>
                <h3 className="text-base font-black text-slate-800">No students match filter criteria</h3>
                <p className="text-slate-400 text-xs font-semibold max-w-xs mx-auto mt-1 leading-relaxed">Try adjusting the search query or selection filters to load records.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map(student => {
                  const status = getExtendedStatus(student.id)
                  const studentIndexId = studentIndexIdMap.get(student.id) || 'Stu-?'
                  const remarkKey = `${student.id}_${selectedDate}`
                  const remark = attendanceMeta.remarks[remarkKey]

                  return (
                    <div 
                      key={student.id} 
                      className={`bg-white border rounded-3xl p-4 flex flex-col justify-between min-h-[125px] shadow-[0_2px_10px_rgba(0,0,0,0.01)] transition-all ${
                        status === 'present' ? 'border-emerald-200/80 bg-emerald-50/5' :
                        status === 'absent' ? 'border-rose-200/80 bg-rose-50/5' :
                        status === 'late' ? 'border-amber-250/80 bg-amber-50/5' :
                        status === 'leave' ? 'border-orange-200/80 bg-orange-50/5' :
                        'border-slate-200/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 text-left">
                        <div>
                          <strong className="text-xs font-black text-slate-805 block truncate max-w-[170px]">{student.full_name}</strong>
                          <span className="text-[9px] text-slate-400 block font-bold mt-0.5">
                            ID: {studentIndexId} • Class {student.class_name}
                          </span>
                          
                          {/* Remarks indicator */}
                          {remark && (
                            <span className="text-[8px] font-black text-slate-450 italic mt-1.5 block max-w-[180px] truncate" title={remark}>
                              💬 {remark}
                            </span>
                          )}
                        </div>

                        {/* Status tag */}
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase select-none ${
                          status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                          status === 'absent' ? 'bg-rose-50 text-rose-700' :
                          status === 'late' ? 'bg-amber-50 text-amber-700' :
                          status === 'leave' ? 'bg-orange-50 text-orange-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {status}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 pt-3 border-t border-slate-50 select-none">
                        <button
                          disabled={savingId === student.id || !!currentHoliday}
                          onClick={() => markAttendance(student.id, 'present')}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition ${
                            status === 'present' 
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-50 text-slate-500 border border-slate-200/50 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          P
                        </button>
                        <button
                          disabled={savingId === student.id || !!currentHoliday}
                          onClick={() => markAttendance(student.id, 'absent')}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition ${
                            status === 'absent' 
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-slate-50 text-slate-500 border border-slate-200/50 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          A
                        </button>
                        <button
                          disabled={savingId === student.id || !!currentHoliday}
                          onClick={() => openPrompt(student.id, 'late')}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition ${
                            status === 'late' 
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-slate-50 text-slate-500 border border-slate-200/50 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          Late
                        </button>
                        <button
                          disabled={savingId === student.id || !!currentHoliday}
                          onClick={() => openPrompt(student.id, 'leave')}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition ${
                            status === 'leave' 
                              ? 'bg-orange-600 text-white shadow-sm'
                              : 'bg-slate-50 text-slate-500 border border-slate-200/50 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          Leave
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ROLL CALL CAROUSEL DECK */}
        {activeTab === 'rollcall' && (
          <div className="max-w-md mx-auto space-y-4">
            {filteredStudents.length === 0 ? (
              <div className="bg-white border rounded-3xl p-12 text-center shadow-sm">
                <span className="text-3xl block mb-2">🤷‍♂️</span>
                <strong className="text-xs text-slate-500">No students matching roster class select.</strong>
              </div>
            ) : (() => {
              const student = filteredStudents[currentDeckIndex]
              const status = getExtendedStatus(student.id)
              const studentIndexId = studentIndexIdMap.get(student.id) || 'Stu-?'
              const progressPercentage = Math.round(((currentDeckIndex + 1) / filteredStudents.length) * 100)

              return (
                <div className="space-y-4">
                  {/* Progress Header */}
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1">
                    <span>Card Deck Mode ({currentDeckIndex + 1} / {filteredStudents.length})</span>
                    <span>{progressPercentage}% Completed</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden select-none">
                    <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
                  </div>

                  {/* Student Deck Card */}
                  <div className="bg-white border border-slate-200/60 rounded-3xl p-8 shadow-xl text-center space-y-6 relative overflow-hidden">
                    {status !== 'unmarked' && (
                      <div className="absolute right-4 top-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase select-none ${
                          status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          status === 'absent' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          status === 'late' ? 'bg-amber-50 text-amber-705 border border-amber-100' :
                          'bg-orange-50 text-orange-700 border border-orange-100'
                        }`}>
                          Marked: {status}
                        </span>
                      </div>
                    )}

                    <div className="h-20 w-20 rounded-2xl bg-indigo-50 text-indigo-700 text-3xl font-black flex items-center justify-center mx-auto border shadow-sm">
                      {student.full_name.charAt(0).toUpperCase()}
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-lg font-black text-slate-805 tracking-tight leading-none">{student.full_name}</h3>
                      <p className="text-xs text-slate-400 font-bold">Roster Reference: {studentIndexId}</p>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold inline-block">Class {student.class_name}</span>
                    </div>

                    {/* Interactive Mark Controls */}
                    <div className="grid grid-cols-2 gap-3.5 select-none pt-2">
                      <button
                        onClick={() => {
                          void markAttendance(student.id, 'present')
                          handleNextCard()
                        }}
                        className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow active:scale-95 transition cursor-pointer flex flex-col items-center justify-center"
                      >
                        <span>Present</span>
                        <span className="text-[8px] font-bold text-emerald-200 mt-0.5">Press 'P'</span>
                      </button>

                      <button
                        onClick={() => {
                          void markAttendance(student.id, 'absent')
                          handleNextCard()
                        }}
                        className="py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow active:scale-95 transition cursor-pointer flex flex-col items-center justify-center"
                      >
                        <span>Absent</span>
                        <span className="text-[8px] font-bold text-rose-200 mt-0.5">Press 'A'</span>
                      </button>

                      <button
                        onClick={() => openPrompt(student.id, 'late')}
                        className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow active:scale-95 transition cursor-pointer flex flex-col items-center justify-center"
                      >
                        <span>Late Entry</span>
                        <span className="text-[8px] font-bold text-amber-100 mt-0.5">Press 'L'</span>
                      </button>

                      <button
                        onClick={() => {
                          void markAttendance(student.id, 'leave')
                          handleNextCard()
                        }}
                        className="py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow active:scale-95 transition cursor-pointer flex flex-col items-center justify-center"
                      >
                        <span>On Leave</span>
                        <span className="text-[8px] font-bold text-orange-100 mt-0.5">Press 'V'</span>
                      </button>
                    </div>

                    {/* Navigation arrow buttons */}
                    <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs font-bold text-slate-400 select-none">
                      <button 
                        onClick={handlePrevCard} 
                        disabled={currentDeckIndex === 0}
                        className="hover:text-slate-700 transition disabled:opacity-30 cursor-pointer"
                      >
                        ← Previous
                      </button>
                      <button 
                        onClick={handleNextCard} 
                        disabled={currentDeckIndex === filteredStudents.length - 1}
                        className="hover:text-slate-700 transition disabled:opacity-30 cursor-pointer"
                      >
                        Skip Next →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* TAB 3: MONTHLY GRID VIEW MATRIX */}
        {activeTab === 'monthly' && (
          <div className="space-y-4">
            
            {/* Monthly Matrix actions */}
            <div className="bg-white border border-slate-200/30 rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Monthly Ledger Roster</span>
              
              {/* Download & Export triggers */}
              <div className="flex items-center gap-2 select-none">
                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  📥 Export CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  🖨️ Export PDF
                </button>
              </div>
            </div>

            {/* Calendar grid wrapper */}
            <div className="bg-white border border-slate-200/40 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-3 px-4 w-48 sticky left-0 bg-slate-50 border-r border-slate-100">Student Name</th>
                      {monthlyDates.map(date => (
                        <th 
                          key={date.fullDate} 
                          title={date.fullDate}
                          className={`py-3 px-1.5 text-center font-bold border-r border-slate-100/50 ${date.isWeekend ? 'bg-slate-100/30' : ''}`}
                        >
                          {date.dayStr}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-sans">
                    {filteredStudents.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50/50">
                        {/* Student Name */}
                        <td className="py-2.5 px-4 font-bold text-slate-705 truncate w-48 sticky left-0 bg-white border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                          {student.full_name}
                        </td>

                        {/* Status dots */}
                        {monthlyDates.map(date => {
                          const dateStatus = getExtendedStatus(student.id, date.fullDate)
                          const isHol = holidays.some(h => h.date === date.fullDate)

                          return (
                            <td 
                              key={date.fullDate}
                              className={`p-1.5 text-center border-r border-slate-55 border-dashed ${date.isWeekend ? 'bg-slate-100/10' : ''}`}
                            >
                              <div className="flex justify-center items-center">
                                {isHol ? (
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 transition"
                                    title={`${date.fullDate}: Holiday`}
                                  />
                                ) : date.isWeekend ? (
                                  <span 
                                    className="w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0 transition"
                                    title={`${date.fullDate}: Weekend`}
                                  />
                                ) : (
                                  <button
                                    onClick={() => {
                                      // Cycle through status present -> absent -> late -> leave
                                      const nextStatus = 
                                        dateStatus === 'unmarked' ? 'present' :
                                        dateStatus === 'present' ? 'absent' :
                                        dateStatus === 'absent' ? 'late' :
                                        dateStatus === 'late' ? 'leave' : 'present'

                                      void markAttendance(student.id, nextStatus as any)
                                    }}
                                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition cursor-pointer select-none ${
                                      dateStatus === 'present' ? 'bg-emerald-500 hover:scale-125' :
                                      dateStatus === 'absent' ? 'bg-rose-500 hover:scale-125' :
                                      dateStatus === 'late' ? 'bg-amber-500 hover:scale-125' :
                                      dateStatus === 'leave' ? 'bg-orange-500 hover:scale-125' :
                                      'bg-slate-100 border border-slate-200 hover:bg-slate-350'
                                    }`}
                                    title={`${date.fullDate}: ${dateStatus.toUpperCase()}`}
                                  />
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Grid Legend helper */}
              <div className="bg-slate-50/70 border-t border-slate-100 p-4 flex flex-wrap gap-4 justify-center text-[10px] font-black text-slate-400 select-none">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late Entry</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> On Leave</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Holiday</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-100 border border-slate-200" /> Unmarked</div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: REPORTS & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            
            {/* Class attendance average comparisons & notifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Class comparisons */}
              <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] space-y-4">
                <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block border-b pb-2">Class-wise Attendance Averages</strong>
                
                <div className="overflow-hidden border border-slate-100 rounded-2xl text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase text-[9px] tracking-wider">
                        <th className="py-2.5 px-4">Class</th>
                        <th className="py-2.5 px-4">Average rate</th>
                        <th className="py-2.5 px-4 text-right pr-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      <tr>
                        <td className="py-2.5 px-4 font-bold">Class 5</td>
                        <td className="py-2.5 px-4 font-black">96%</td>
                        <td className="py-2.5 px-4 text-right pr-4"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase">Outstanding</span></td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold">Class 3</td>
                        <td className="py-2.5 px-4 font-black">92%</td>
                        <td className="py-2.5 px-4 text-right pr-4"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase">Excellent</span></td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold">Class 8</td>
                        <td className="py-2.5 px-4 font-black">84%</td>
                        <td className="py-2.5 px-4 text-right pr-4"><span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[8px] font-black uppercase">Average</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SMS Notification Simulator */}
              <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] space-y-4 flex flex-col justify-between">
                <div>
                  <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block border-b pb-2">Parent Notification Console</strong>
                  <p className="text-[11px] text-slate-400 font-semibold leading-relaxed pt-2">
                    Send automated daily attendance digests directly to parents. Students marked as absent or late will trigger instant SMS notifications.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-3.5 space-y-2.5 text-xs text-slate-500 font-semibold">
                  <div className="flex justify-between items-center">
                    <span>Unnotified Absences</span>
                    <strong className="text-rose-600">{stats.absent}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Unnotified Lates</span>
                    <strong className="text-amber-600">{stats.late}</strong>
                  </div>
                </div>

                <button
                  onClick={handleNotifyParents}
                  disabled={isNotifying}
                  className="w-full py-3 bg-[#4f46e5] text-white hover:bg-indigo-700 font-black text-xs rounded-xl shadow active:scale-95 transition cursor-pointer select-none"
                >
                  {isNotifying ? 'Sending Notifications...' : '🚀 Broadcast Parent Notifications'}
                </button>
              </div>

            </div>

          </div>
        )}

        {/* TAB 5: HOLIDAYS & SETTINGS */}
        {activeTab === 'holidays' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            
            {/* Add Holiday Form */}
            <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] space-y-4 text-left">
              <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block border-b pb-2">Log School Holiday</strong>

              <form onSubmit={handleAddHoliday} className="space-y-4 font-sans text-xs">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Holiday Date *</label>
                  <input
                    type="date"
                    required
                    name="holidayDate"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs outline-none font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Holiday Particular / Name *</label>
                  <input
                    type="text"
                    required
                    name="holidayName"
                    placeholder="e.g. Independence Day Holiday"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs outline-none font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#4f46e5] hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow cursor-pointer transition select-none"
                >
                  + Add Holiday
                </button>
              </form>
            </div>

            {/* List Holidays */}
            <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.01)] space-y-4 md:col-span-2 text-left">
              <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block border-b pb-2">Holiday Calendar Listing</strong>
              
              <div className="space-y-2.5 text-xs font-medium text-slate-700">
                {holidays.length === 0 ? (
                  <p className="text-slate-400 italic">No holidays catalogued yet.</p>
                ) : (
                  holidays.map(h => (
                    <div key={h.date} className="flex justify-between items-center bg-slate-50 border border-slate-200/50 rounded-2xl p-3.5">
                      <div>
                        <strong className="text-slate-805 text-xs font-bold block">{h.name}</strong>
                        <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">{new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteHoliday(h.date)}
                        className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-450 hover:text-slate-700 rounded-xl transition cursor-pointer"
                      >
                        ❌
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ================= LATE REMARKS / LEAVE PROMPT MODAL ================= */}
      {activePromptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActivePromptId(null)} />
          
          <div className="relative w-full max-w-sm bg-white shadow-2xl rounded-3xl border border-slate-100 p-6 space-y-4 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">
                {promptType === 'late' ? 'Late Entry Particulars' : 'Approved Leave Particulars'}
              </h3>
              <button onClick={() => setActivePromptId(null)} className="text-slate-400 p-1">
                ❌
              </button>
            </div>

            <form onSubmit={handlePromptSubmit} className="space-y-4">
              <div className="space-y-1.5 text-xs font-sans">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  Reason Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder={promptType === 'late' ? 'e.g. Missed school bus' : 'e.g. Medical checkup'}
                  value={promptText}
                  onChange={e => setPromptText(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setActivePromptId(null)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-[#4f46e5] text-white font-bold text-xs rounded-xl shadow"
                >
                  Confirm Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
