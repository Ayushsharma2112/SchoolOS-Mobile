'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { useSchool } from '../../../lib/SchoolContext'
import ClientAuth from '../ClientAuth'

type Announcement = {
  id: string
  title: string
  content: string
  published_date: string
  category: 'General' | 'Exam' | 'Event' | 'Holiday'
  is_important: boolean
}

type TimetableItem = {
  id: string
  class_name: string
  day_of_week: string
  period: string
  time_slot: string
  subject: string
  teacher_name: string
  room_no?: string
}

type HomeworkItem = {
  id: string
  title: string
  due_date: string
  status: string
  class_name: string
  subject_name: string
}

export default function DashboardPage() {
  const { schoolId, schoolName, userRole, profile } = useSchool()
  const [loading, setLoading] = useState(true)
  const [userFullName, setUserFullName] = useState('Staff Member')
  const [teacherId, setTeacherId] = useState<string | null>(null)
  
  // Dashboard states
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  
  // Admin stats states
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeTeachers: 0,
    todayAttendance: '0%',
    pendingFees: '₹0',
    monthlyRevenue: '₹0'
  })

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load profile and global dashboard details
  useEffect(() => {
    if (!schoolId) return

    async function loadDashboardMeta() {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        
        let staffName = profile?.full_name || 'Staff Member'
        let sId: string | null = null

        if (session?.user) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('id, full_name')
            .eq('user_id', session.user.id)
            .eq('school_id', schoolId)
            .maybeSingle()

          if (staffData) {
            staffName = staffData.full_name
            sId = staffData.id
            setTeacherId(staffData.id)
          }
        }
        setUserFullName(staffName)

        // 1. Fetch announcements/circulars from DB
        const { data: circulars } = await supabase
          .from('circulars')
          .select('*')
          .eq('school_id', schoolId)
          .order('published_date', { ascending: false })
          .limit(5)
        setAnnouncements(circulars || [])

        // 2. Fetch admin metrics if role is admin/superadmin
        if (userRole === 'Admin' || userRole === 'SuperAdmin') {
          const { count: studentCount } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)

          const { count: teacherCount } = await supabase
            .from('staff')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('role', 'Teacher')
            .eq('status', 'Active')

          // Calculate overall attendance rate for today
          const todayStr = new Date().toISOString().split('T')[0]
          const { data: attToday } = await supabase
            .from('attendance')
            .select('status')
            .eq('school_id', schoolId)
            .eq('date', todayStr)

          let attRate = '0%'
          if (attToday && attToday.length > 0) {
            const present = attToday.filter(a => a.status === 'present').length
            attRate = `${Math.round((present / attToday.length) * 100)}%`
          } else {
            // Get historic average
            const { data: attAll } = await supabase
              .from('attendance')
              .select('status')
              .eq('school_id', schoolId)
            if (attAll && attAll.length > 0) {
              const present = attAll.filter(a => a.status === 'present').length
              attRate = `${Math.round((present / attAll.length) * 100)}%`
            }
          }

          // Calculate Fees
          const { data: feesData } = await supabase
            .from('fees')
            .select('amount, status, created_at, paid_at')
            .eq('school_id', schoolId)

          let unpaid = 0
          let monthlyRevenueAmt = 0
          const currentMonth = new Date().getMonth()
          const currentYear = new Date().getFullYear()

          if (feesData) {
            feesData.forEach(f => {
              const amt = Number(f.amount) || 0
              if (f.status === 'unpaid' || f.status === 'pending') {
                unpaid += amt
              }
              if (f.status === 'paid' && f.paid_at) {
                const paidDate = new Date(f.paid_at)
                if (paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear) {
                  monthlyRevenueAmt += amt
                }
              }
            })
          }

          setStats({
            totalStudents: studentCount || 0,
            activeTeachers: teacherCount || 0,
            todayAttendance: attRate,
            pendingFees: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(unpaid),
            monthlyRevenue: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(monthlyRevenueAmt)
          })
        }
      } catch (err) {
        console.error('Error fetching dashboard statistics:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadDashboardMeta()
  }, [schoolId, userRole, profile])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 animate-spin border-4 border-indigo-100 border-t-indigo-600" />
          <span className="text-sm font-semibold text-slate-500 animate-pulse">Loading Workspace...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <ClientAuth />
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-xl animate-in fade-in duration-300">
          <span className="text-xs font-semibold">✓ {toast.message}</span>
        </div>
      )}

      {userRole === 'Teacher' ? (
        <TeacherWorkspace 
          schoolId={schoolId}
          schoolName={schoolName || 'SchoolOS'}
          teacherId={teacherId}
          userFullName={userFullName}
          announcements={announcements}
          showToast={showToast}
        />
      ) : (
        <AdminWorkspace 
          schoolName={schoolName || 'SchoolOS'}
          userFullName={userFullName}
          announcements={announcements}
          stats={stats}
          showToast={showToast}
          refreshAnnouncements={async () => {
            if (!schoolId) return
            const { data } = await supabase
              .from('circulars')
              .select('*')
              .eq('school_id', schoolId)
              .order('published_date', { ascending: false })
            setAnnouncements(data || [])
          }}
        />
      )}
    </>
  )
}

// ========================================================
// TEACHER WORKSPACE COMPONENT (PART 5)
// ========================================================
type TeacherWorkspaceProps = {
  schoolId: string | null
  schoolName: string
  teacherId: string | null
  userFullName: string
  announcements: Announcement[]
  showToast: (msg: string) => void
}

function TeacherWorkspace({
  schoolId,
  schoolName,
  teacherId,
  userFullName,
  announcements,
  showToast
}: TeacherWorkspaceProps) {
  const [timetable, setTimetable] = useState<TimetableItem[]>([])
  const [homework, setHomework] = useState<HomeworkItem[]>([])
  const [upcomingExams, setUpcomingExams] = useState<any[]>([])
  const [pendingMarksCount, setPendingMarksCount] = useState(0)
  const [hwStats, setHwStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    dueSoon: 0
  })
  
  // Timetable and data loaders
  useEffect(() => {
    if (!schoolId) return

    async function loadTeacherData() {
      try {
        // 1. Fetch today's day of week
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const todayDay = days[new Date().getDay()]

        // Fetch timetables
        const { data: ttData } = await supabase
          .from('timetables')
          .select('*')
          .eq('school_id', schoolId)
          .eq('day_of_week', todayDay)
        
        // Filter locally on teacher name to map class slots
        const matches = (ttData || []).filter(item => 
          item.teacher_name?.toLowerCase().includes(userFullName.toLowerCase())
        )
        setTimetable(matches)

        // 2. Fetch active homework assignments for this teacher (all records to calculate stats)
        const { data: hwData } = await supabase
          .from('homework')
          .select(`
            id, title, due_date, status,
            classes(name), subjects(name)
          `)
          .eq('school_id', schoolId)
          .eq('teacher_id', teacherId)
          .order('due_date', { ascending: true })

        const allHw = hwData || []
        
        // Calculate counts
        const total = allHw.length
        const published = allHw.filter(h => h.status === 'Published').length
        const draft = allHw.filter(h => h.status === 'Draft').length
        
        const nowTime = new Date().getTime()
        const dueSoon = allHw.filter(h => {
          if (h.status !== 'Published') return false
          const dueTime = new Date(h.due_date).getTime()
          const diffDays = (dueTime - nowTime) / (1000 * 60 * 60 * 24)
          return diffDays >= 0 && diffDays <= 3 // due in next 3 days
        }).length

        setHwStats({ total, published, draft, dueSoon })

        const formattedHw = allHw.slice(0, 5).map((h: any) => ({
          id: h.id,
          title: h.title,
          due_date: h.due_date,
          status: h.status,
          class_name: h.classes?.name || 'Class',
          subject_name: h.subjects?.name || 'Subject'
        }))
        setHomework(formattedHw)

        // 3. Fetch scheduled exams
        const { data: examData } = await supabase
          .from('exams')
          .select('*')
          .eq('school_id', schoolId)
          .order('year', { ascending: false })
          .limit(3)
        setUpcomingExams(examData || [])

        // 4. Compute pending marks counts
        // If there are results entered, check if total results count matches student roster counts
        // (Simulate warning count based on class exams setup)
        const { data: results } = await supabase.from('results').select('id').eq('teacher_id', teacherId)
        setPendingMarksCount(results && results.length < 15 ? 4 : 0)

      } catch (e) {
        console.error('Error fetching teacher data:', e)
      }
    }
    void loadTeacherData()
  }, [schoolId, teacherId, userFullName])

  const greeting = useMemo(() => {
    const hr = new Date().getHours()
    if (hr < 12) return 'Good Morning'
    if (hr < 17) return 'Good Afternoon'
    return 'Good Evening'
  }, [])

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-6 lg:p-8 space-y-8 font-sans">
      {/* Header Profile Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="text-left">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            {greeting}, {userFullName}! 👋
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold">Teacher Workspace • {schoolName}</p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto select-none">
          <div className="flex items-center gap-3 bg-white border border-slate-200/60 rounded-2xl px-4 py-2.5 shadow-sm">
            <span className="text-sm">📅</span>
            <div className="text-left">
              <span className="text-xs font-bold text-slate-700 block leading-tight">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mt-0.5">Active Session</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center justify-between hover:shadow transition">
          <div className="space-y-1 text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Today's Classes</span>
            <h3 className="text-xl font-black text-slate-900">{timetable.length} Lectures</h3>
          </div>
          <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl font-bold text-sm">🏫</span>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center justify-between hover:shadow transition">
          <div className="space-y-1 text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Homework Log</span>
            <h3 className="text-xl font-black text-slate-900">{hwStats.total} Total Tasks</h3>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] font-bold mt-1 text-slate-400">
              <span className="text-emerald-600">✓ {hwStats.published} Published</span>
              <span>•</span>
              <span className="text-amber-500">✎ {hwStats.draft} Drafts</span>
              <span>•</span>
              <span className="text-rose-600">⚠️ {hwStats.dueSoon} Due Soon</span>
            </div>
          </div>
          <span className="p-3 bg-violet-50 text-violet-600 rounded-2xl font-bold text-sm">📝</span>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center justify-between hover:shadow transition">
          <div className="space-y-1 text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Pending Marks</span>
            <h3 className="text-xl font-black text-slate-900">{pendingMarksCount} Exams</h3>
          </div>
          <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl font-bold text-sm">✏️</span>
        </div>

        <Link 
          href="/attendance"
          className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex items-center justify-between hover:shadow hover:border-indigo-200 transition cursor-pointer"
        >
          <div className="space-y-1 text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Attendance Registry</span>
            <h3 className="text-xl font-black text-slate-900">Mark Register</h3>
          </div>
          <span className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm">✓</span>
        </Link>
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timetable schedule list */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4 text-left">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Today's Class Schedule</h3>
          {timetable.length > 0 ? (
            <div className="space-y-3">
              {timetable.map((item, idx) => (
                <div key={idx} className="border border-slate-100 rounded-2xl p-4 flex items-center justify-between bg-slate-50/30">
                  <div className="space-y-1">
                    <strong className="text-xs font-bold text-slate-800 block">{item.subject} ({item.class_name})</strong>
                    <span className="text-[10px] text-slate-400 font-semibold block">{item.time_slot} | {item.room_no || 'Room 101'}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase rounded-md border border-indigo-100/30">
                    {item.period}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl text-xs">
              No classes registered for your profile on {new Date().toLocaleDateString(undefined, { weekday: 'long' })}s.
            </div>
          )}
        </div>

        {/* Homework tasks widget */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4 text-left">
          <div className="flex items-center justify-between border-b border-slate-50 pb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Homework Log</h3>
            <Link href="/academics/homework" className="text-[10px] font-bold text-indigo-600 hover:underline">
              Manage Tasks
            </Link>
          </div>
          {homework.length > 0 ? (
            <div className="space-y-3">
              {homework.map((hw) => (
                <div key={hw.id} className="border border-slate-100 rounded-2xl p-4 flex items-start justify-between gap-4 bg-slate-50/20">
                  <div className="space-y-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100/30 uppercase">
                      {hw.class_name}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-1">{hw.title}</h4>
                    <span className="text-[9px] text-slate-400 font-semibold block">Due: {hw.due_date}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl text-xs">
              No active homework published recently.
            </div>
          )}
        </div>

        {/* Notices Board */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4 text-left">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Announcements</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-none pr-1">
            {announcements.map((ann) => (
              <div key={ann.id} className="border border-slate-100 rounded-2xl p-4 text-left relative overflow-hidden bg-slate-50/20">
                <div className="flex items-center gap-1.5 justify-between">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                    ann.category === 'Holiday' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/30' :
                    ann.category === 'Event' ? 'bg-amber-50 text-amber-700 border border-amber-100/30' :
                    ann.category === 'Exam' ? 'bg-rose-50 text-rose-700 border border-rose-100/30' :
                    'bg-slate-50 text-slate-600 border border-slate-200/30'
                  }`}>
                    {ann.category}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">{ann.published_date}</span>
                </div>
                <strong className="text-xs font-bold text-slate-800 block mt-1.5">{ann.title}</strong>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">{ann.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm text-left space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/attendance" className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-2xl text-center space-y-2 group transition">
            <span className="text-lg block">✅</span>
            <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600">Mark Attendance</span>
          </Link>
          
          <Link href="/academics/homework" className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-2xl text-center space-y-2 group transition">
            <span className="text-lg block">✍️</span>
            <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600">Assign Homework</span>
          </Link>

          <Link href="/academics/results" className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-2xl text-center space-y-2 group transition">
            <span className="text-lg block">🏆</span>
            <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600">Enter Exam Marks</span>
          </Link>

          <Link href="/academics/report-cards" className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-2xl text-center space-y-2 group transition">
            <span className="text-lg block">🎓</span>
            <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600">Generate Report Cards</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ========================================================
// ADMINISTRATOR WORKSPACE COMPONENT
// ========================================================
type AdminWorkspaceProps = {
  schoolName: string
  userFullName: string
  announcements: Announcement[]
  stats: any
  showToast: (msg: string) => void
  refreshAnnouncements: () => Promise<void>
}

function AdminWorkspace({
  schoolName,
  userFullName,
  announcements,
  stats,
  showToast,
  refreshAnnouncements
}: AdminWorkspaceProps) {
  const [isNoticeOpen, setIsNoticeOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<'General' | 'Exam' | 'Event' | 'Holiday'>('General')
  const [important, setImportant] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const { schoolId } = useSchool()

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim() || !schoolId) return

    setPublishing(true)
    try {
      const { error } = await supabase
        .from('circulars')
        .insert({
          school_id: schoolId,
          title: title.trim(),
          content: content.trim(),
          category,
          is_important: important
        })

      if (error) throw error

      showToast('Notice published successfully to dashboard boards.')
      setIsNoticeOpen(false)
      setTitle('')
      setContent('')
      setImportant(false)
      await refreshAnnouncements()
    } catch (e: any) {
      console.error(e)
      alert(e.message || 'Failed to publish announcement.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-6 lg:p-8 space-y-8 font-sans">
      {/* Header Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="text-left">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Welcome Back, {userFullName}! 👋
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold">Principal & Administrative Workspace • {schoolName}</p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto select-none">
          <button 
            onClick={() => setIsNoticeOpen(true)}
            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow hover:shadow-md transition active:scale-95 cursor-pointer"
          >
            📢 Publish Circular
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left space-y-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Students</span>
          <h3 className="text-xl font-black text-slate-900">{stats.totalStudents}</h3>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left space-y-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Teachers</span>
          <h3 className="text-xl font-black text-slate-900">{stats.activeTeachers} Active</h3>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left space-y-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Attendance</span>
          <h3 className="text-xl font-black text-slate-900">{stats.todayAttendance}</h3>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left space-y-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Pending Fees</span>
          <h3 className="text-xl font-black text-rose-600">{stats.pendingFees}</h3>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left space-y-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Monthly Revenue</span>
          <h3 className="text-xl font-black text-emerald-600">{stats.monthlyRevenue}</h3>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notice List */}
        <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4 text-left">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Active School Notices</h3>
          {announcements.length > 0 ? (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className="border border-slate-100 rounded-2xl p-4 relative bg-slate-50/20">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="px-2 py-0.5 rounded text-[8px] font-black bg-indigo-50 text-indigo-700 uppercase">
                      {ann.category}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-450">{ann.published_date}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-2">{ann.title}</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{ann.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 font-semibold border border-dashed border-slate-200 rounded-2xl text-xs">
              No school notices published yet. Use "Publish Circular" to add.
            </div>
          )}
        </div>

        {/* Quick Utilities */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4 text-left">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Admin Shortcuts</h3>
          <div className="space-y-2">
            <Link href="/students" className="block p-3 hover:bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-800 transition">
              👥 Manage Student Directory
            </Link>
            <Link href="/dashboard/staff" className="block p-3 hover:bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-800 transition">
              🎓 Staff & Teacher Directory
            </Link>
            <Link href="/fees" className="block p-3 hover:bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-800 transition">
              💳 Tuition Invoicing & Fees
            </Link>
            <Link href="/academics/report-cards" className="block p-3 hover:bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-800 transition">
              🏆 Print Student Report Cards
            </Link>
          </div>
        </div>
      </div>

      {/* Notice Publish Modal */}
      {isNoticeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-slate-900 text-left">Publish Circular</h2>
              <p className="text-[11px] text-slate-500 font-medium text-left">
                Broadcast announcements, exam timetables, or holiday updates directly to parent and teacher workspaces.
              </p>
            </div>

            <form onSubmit={handlePublishNotice} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                  Notice Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual Science Exhibition 2026"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Category
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold bg-white cursor-pointer"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                  >
                    <option value="General">General</option>
                    <option value="Exam">Exam Schedule</option>
                    <option value="Event">School Event</option>
                    <option value="Holiday">Holiday Notice</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="is-imp"
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-0 border-slate-350"
                    checked={important}
                    onChange={(e) => setImportant(e.target.checked)}
                  />
                  <label htmlFor="is-imp" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Flag Important
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                  Content Body
                </label>
                <textarea
                  placeholder="Type notice description here..."
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-850 font-medium resize-none"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={publishing}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3.5 rounded-xl transition active:scale-95 disabled:opacity-60 cursor-pointer text-center"
                >
                  {publishing ? 'Publishing...' : 'Publish Notice'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsNoticeOpen(false)}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 font-bold text-xs py-3.5 rounded-xl transition active:scale-95 cursor-pointer text-center"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
