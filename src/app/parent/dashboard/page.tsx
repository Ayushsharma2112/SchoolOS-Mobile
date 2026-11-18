'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type ParentSession = {
  parentPhone: string
  parentName: string
  schoolId: string
  schoolName: string
  studentIds: string[]
}

type StudentDetails = {
  id: string
  full_name: string
  class_name: string
  gender: string
  date_of_birth: string
  admission_date: string
  address: string
  parent_name: string
  parent_phone: string
  school_id: string
  roll_number?: string
  blood_group?: string
  transport_bus?: string
  section?: string
  student_id: string
  class_id: string | null
  section_id: string
}

type AttendanceRecord = {
  id: string
  student_id: string
  date: string
  status: 'present' | 'absent' | 'late' | 'holiday'
}

type HomeworkItem = {
  id: string
  title: string
  description: string
  due_date: string
  created_at: string
  submission_required: boolean
  max_marks: number
  pdf_url?: string
  video_url?: string
  subject_name: string
  teacher_name?: string
}

type ResultItem = {
  id: string
  marks_obtained: number
  max_marks: number
  grade: string
  remarks: string
  subject_name: string
  exam_title: string
  exam_term: string
}

type TimetableItem = {
  id: string
  day_of_week: string
  period: string
  time_slot: string
  subject: string
  teacher_name: string
  room_no?: string
}

type Circular = {
  id: string
  title: string
  content: string
  published_date: string
  category: 'General' | 'Exam' | 'Event' | 'Holiday'
  is_important: boolean
}

type TeacherMessage = {
  id: string
  sender_type: 'parent' | 'teacher'
  teacher_name: string
  message: string
  created_at: string
}

type LeaveRequest = {
  id: string
  start_date: string
  end_date: string
  reason: string
  status: 'Pending' | 'Approved' | 'Rejected'
  created_at: string
}

type FeeRecord = {
  id: string
  student_id: string
  month: string
  amount: number
  status: 'paid' | 'unpaid' | 'pending'
  created_at: string
}

type DocumentRecord = {
  id: string
  student_id: string
  school_id: string
  document_type: string
  file_url: string
  created_at: string
}

type SchoolEvent = {
  id: string
  school_id: string
  title: string
  description: string
  start_date: string
  end_date?: string
  event_type: 'Holiday' | 'Activity' | 'PTM' | 'Celebration'
}

type StudentMetadata = {
  rollNumber: string
  section: string
  status: 'Active' | 'Suspended' | 'Archived' | 'Promoted' | 'Transferred'
  bloodGroup: string
  allergies: string
  conditions: string
  vaccinationStatus: string
  heightWeight: string
  emergencyName: string
  emergencyRelation: string
  emergencyPhone: string
  rte: string
  nationality: string
  religion: string
  house: string
  previousSchool: string
  academicYear: string
  fatherName: string
  fatherPhone: string
  fatherEmail: string
  motherName: string
  motherPhone: string
  motherEmail: string
  guardianName: string
  guardianPhone: string
  guardianRelation: string
  classTeacherName: string
  classTeacherEmail: string
  classTeacherPhone: string
  admissionNo: string
  avatarUrl?: string
}

type Remark = {
  id: string
  text: string
  date: string
  author: string
}

export default function ParentDashboard() {
  const [session, setSession] = useState<ParentSession | null>(null)
  const [children, setChildren] = useState<StudentDetails[]>([])
  const [activeChild, setActiveChild] = useState<StudentDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'attendance' | 'homework' | 'fees' | 'results' | 'timetable' | 'circulars' | 'messages' | 'leaves' | 'documents' | 'calendar' | 'achievements'>('overview')
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(true)

  // Sub-data states
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [fees, setFees] = useState<FeeRecord[]>([])
  const [homework, setHomework] = useState<HomeworkItem[]>([])
  const [results, setResults] = useState<ResultItem[]>([])
  const [timetable, setTimetable] = useState<TimetableItem[]>([])
  const [circulars, setCirculars] = useState<Circular[]>([])
  const [messages, setMessages] = useState<TeacherMessage[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [schoolEvents, setSchoolEvents] = useState<SchoolEvent[]>([])
  
  // Local storage extensions
  const [metadata, setMetadata] = useState<StudentMetadata>({
    rollNumber: '15',
    section: 'A',
    status: 'Active',
    bloodGroup: 'B+',
    allergies: 'None',
    conditions: 'None',
    vaccinationStatus: 'Fully Vaccinated',
    heightWeight: '135 cm / 32 kg',
    emergencyName: 'Rajesh Sharma',
    emergencyRelation: 'Father',
    emergencyPhone: '+91 98765 43211',
    rte: 'No',
    nationality: 'Indian',
    religion: 'Hindu',
    house: 'Blue House',
    previousSchool: 'Little Angels School, Surat',
    academicYear: '2024-25',
    fatherName: 'Rajesh Sharma',
    fatherPhone: '+91 98765 43211',
    fatherEmail: 'rajesh.sharma@gmail.com',
    motherName: 'Priya Sharma',
    motherPhone: '+91 98765 43212',
    motherEmail: 'priya.sharma@gmail.com',
    guardianName: 'Suresh Sharma',
    guardianPhone: '+91 98765 43213',
    guardianRelation: 'Grandfather',
    classTeacherName: 'Neha Patel',
    classTeacherEmail: 'neha.patel@gvps.edu.in',
    classTeacherPhone: '+91 98765 43210',
    admissionNo: 'GVPS/2024/0156'
  })
  const [remarks, setRemarks] = useState<Remark[]>([])

  // UI state variables
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedHomework, setSelectedHomework] = useState<HomeworkItem | null>(null)
  const [isHwModalOpen, setIsHwModalOpen] = useState(false)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState<Partial<StudentMetadata>>({})

  // Form states
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')
  const [leaveReason, setLeaveReason] = useState('')
  const [submittingLeave, setSubmittingLeave] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [documentUploading, setDocumentUploading] = useState(false)

  // Payments
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)

  // Interactive Calendar Date State
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(new Date())

  const router = useRouter()
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

  // Toast Notify
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load and sync Dark Mode and Session Settings
  useEffect(() => {
    const storedTheme = localStorage.getItem('schoolos_student_theme')
    if (storedTheme) {
      setDarkMode(storedTheme === 'dark')
    } else {
      setDarkMode(true)
    }

    const stored = localStorage.getItem('schoolos_parent_session')
    if (!stored) {
      router.push('/parent')
      return
    }
    setSession(JSON.parse(stored))
  }, [router])

  // Watch dark mode and apply class to document html or outer wrapper
  useEffect(() => {
    localStorage.setItem('schoolos_student_theme', darkMode ? 'dark' : 'light')
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // Handle outside clicks to close dropdowns
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (isNotificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setIsNotificationsOpen(false)
      }
      if (isProfileOpen && profileDropdownRef.current && !profileDropdownRef.current.contains(target)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isNotificationsOpen, isProfileOpen])

  // Fetch children list
  useEffect(() => {
    if (!session) return
    const phone = session.parentPhone
    const schoolId = session.schoolId

    async function fetchChildren() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('parent_phone', phone)

        if (error) throw error

        if (data && data.length > 0) {
          // Fetch classes to resolve class_id
          const { data: classesData } = await supabase
            .from('classes')
            .select('id, name')
            .eq('school_id', schoolId)

          const enriched: StudentDetails[] = data.map((s, idx) => {
            let matchedClass = classesData?.find(c => c.name.toLowerCase().trim() === s.class_name.toLowerCase().trim())
            if (!matchedClass && classesData) {
              const cleanName = s.class_name.toLowerCase().trim()
              matchedClass = classesData.find(c => {
                const cName = c.name.toLowerCase().trim()
                const numMatch = cleanName.match(/\d+/)
                const dbNumMatch = cName.match(/\d+/)
                if (numMatch && dbNumMatch && numMatch[0] === dbNumMatch[0]) {
                  return true
                }
                return false
              })
            }

            return {
              ...s,
              student_id: s.id,
              class_id: matchedClass ? matchedClass.id : null,
              section_id: s.section || 'A',
              roll_number: s.roll_number || `R-${100 + idx}`,
              blood_group: s.blood_group || 'O+',
              transport_bus: s.transport_bus || 'Route 10A'
            }
          })
          setChildren(enriched)
          setActiveChild(enriched[0])
        } else {
          showToast('No student records associated with this number.', 'error')
          router.push('/parent')
        }
      } catch (e) {
        console.error(e)
        showToast('Error loading children profiles.', 'error')
      } finally {
        setLoading(false)
      }
    }
    void fetchChildren()
  }, [session, router])

  // Fetch student metadata extensions
  const loadExtensions = (sId: string) => {
    const extKey = `schoolos_student_ext_${sId}`
    const storedExt = localStorage.getItem(extKey)
    const defaultExt: StudentMetadata = {
      rollNumber: activeChild?.roll_number || '15',
      section: activeChild?.section || 'A',
      status: 'Active',
      bloodGroup: activeChild?.blood_group || 'O+',
      allergies: 'None',
      conditions: 'None',
      vaccinationStatus: 'Fully Vaccinated',
      heightWeight: '142 cm / 36 kg',
      emergencyName: activeChild?.parent_name || 'Rajesh Sharma',
      emergencyRelation: 'Father',
      emergencyPhone: activeChild?.parent_phone || '+91 98765 43211',
      rte: 'No',
      nationality: 'Indian',
      religion: 'Hindu',
      house: 'Red House',
      previousSchool: 'Greenwood International',
      academicYear: '2026-27',
      fatherName: activeChild?.parent_name || 'Rajesh Sharma',
      fatherPhone: activeChild?.parent_phone || '+91 98765 43211',
      fatherEmail: 'parent@schoolos.com',
      motherName: 'Priya Sharma',
      motherPhone: '+91 98765 43212',
      motherEmail: 'mother@schoolos.com',
      guardianName: 'Suresh Sharma',
      guardianPhone: '+91 98765 43213',
      guardianRelation: 'Grandfather',
      classTeacherName: 'Mrs. Seema Sharma',
      classTeacherEmail: 'seema.sharma@schoolos.com',
      classTeacherPhone: '+91 98765 43200',
      admissionNo: `GVPS/2026/0${Math.floor(100 + Math.random() * 900)}`
    }

    if (storedExt) {
      try {
        const parsed = JSON.parse(storedExt) as StudentMetadata
        const merged = { ...defaultExt, ...parsed }
        setMetadata(merged)
        setProfileForm(merged)
      } catch (e) {
        console.error('Metadata parse error:', e)
      }
    } else {
      localStorage.setItem(extKey, JSON.stringify(defaultExt))
      setMetadata(defaultExt)
      setProfileForm(defaultExt)
    }

    const storedRemarks = localStorage.getItem(`schoolos_student_remarks_${sId}`)
    if (storedRemarks) {
      try {
        setRemarks(JSON.parse(storedRemarks))
      } catch (e) {
        console.error('Remarks parse error:', e)
      }
    } else {
      const defaultRemarks: Remark[] = [
        {
          id: 'rem-1',
          text: 'Shows exceptional analytical abilities in coding structures and mathematics worksheets.',
          date: '2026-07-25',
          author: 'Mrs. Seema Sharma'
        },
        {
          id: 'rem-2',
          text: 'Completed English research journal report ahead of schedule with great attention to grammar.',
          date: '2026-07-18',
          author: 'Science Coordinator'
        }
      ]
      localStorage.setItem(`schoolos_student_remarks_${sId}`, JSON.stringify(defaultRemarks))
      setRemarks(defaultRemarks)
    }
  }

  // Fetch student sub-data on activeChild change
  useEffect(() => {
    if (!activeChild) return
    const childId = activeChild.id
    const className = activeChild.class_name
    const schoolId = activeChild.school_id
    const classId = activeChild.class_id
    const sectionId = activeChild.section_id

    let active = true

    async function loadChildMetrics() {
      try {
        // 1. Fetch attendance
        const { data: att } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', childId)
          .order('date', { ascending: false })
        
        if (!active) return
        setAttendance(att || [])

        // 2. Fetch homework
        if (classId) {
          const { data: hw, error: hwErr } = await supabase
            .from('homework')
            .select(`
              id, title, description, due_date, created_at, submission_required, max_marks, pdf_url, video_url,
              subjects(name), staff(full_name)
            `)
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .eq('section', sectionId)
            .eq('status', 'Published')
            .eq('visibility', 'students')

          if (hwErr) console.error('Error fetching homework:', hwErr)

          if (active) {
            const formattedHw = (hw || []).map((h: any) => ({
              id: h.id,
              title: h.title,
              description: h.description,
              due_date: h.due_date,
              created_at: h.created_at,
              submission_required: h.submission_required,
              max_marks: h.max_marks,
              pdf_url: h.pdf_url,
              video_url: h.video_url,
              subject_name: h.subjects?.name || 'General',
              teacher_name: h.staff?.full_name || 'Class Teacher'
            }))
            setHomework(formattedHw)
          }
        } else {
          if (active) setHomework([])
        }

        // 3. Fetch timetables
        let resolvedClassName = className
        if (classId) {
          const { data: clsInfo } = await supabase
            .from('classes')
            .select('name')
            .eq('id', classId)
            .maybeSingle()
          if (clsInfo) {
            resolvedClassName = clsInfo.name
          }
        }
        const { data: tt } = await supabase
          .from('timetables')
          .select('*')
          .or(`class_name.eq."${className}",class_name.eq."${resolvedClassName}"`)
          .eq('school_id', schoolId)
          
        if (active) setTimetable(tt || [])

        // 4. Fetch results
        const { data: res } = await supabase
          .from('results')
          .select(`
            id, marks, grade, remarks,
            subjects(name), exams(title, term)
          `)
          .eq('student_id', childId)

        if (active) {
          const formattedRes = (res || []).map((r: any) => ({
            id: r.id,
            marks_obtained: Number(r.marks),
            max_marks: 100,
            grade: r.grade,
            remarks: r.remarks || '',
            subject_name: r.subjects?.name || 'Course',
            exam_title: r.exams?.title || 'Exam',
            exam_term: r.exams?.term || 'Term'
          }))
          setResults(formattedRes)
        }

        // 5. Fetch fees
        const { data: feesData } = await supabase
          .from('fees')
          .select('*')
          .eq('student_id', childId)
          .order('created_at', { ascending: false })
        
        if (active) setFees(feesData || [])

        // 6. Fetch circulars
        const { data: circ } = await supabase
          .from('circulars')
          .select('*')
          .eq('school_id', schoolId)
          .order('published_date', { ascending: false })
        
        if (active) setCirculars(circ || [])

        // 7. Fetch leave requests
        const { data: leaves } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('student_id', childId)
          .order('created_at', { ascending: false })
        
        if (active) setLeaveRequests(leaves || [])

        // 8. Fetch chat messages
        const { data: msgs } = await supabase
          .from('teacher_messages')
          .select('*')
          .eq('student_id', childId)
          .order('created_at', { ascending: true })
        
        if (active) {
          setMessages(msgs || [])
          setTimeout(() => {
            if (chatContainerRef.current) {
              chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
              })
            }
          }, 200)
        }

        // 9. Fetch documents
        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .eq('student_id', childId)
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
        if (active) setDocuments(docsData || [])

        // 10. Fetch school events
        const { data: eventsData } = await supabase
          .from('school_events')
          .select('*')
          .eq('school_id', schoolId)
        if (active) setSchoolEvents(eventsData || [])

        loadExtensions(childId)
      } catch (e) {
        console.error('Error fetching student dashboard info:', e)
      }
    }
    
    void loadChildMetrics()

    // 11. Subscribe to Real-Time updates on the homework table
    const homeworkChannel = supabase
      .channel(`public:homework:changes:${childId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'homework',
          filter: `school_id=eq.${schoolId}`
        },
        () => {
          if (active) void loadChildMetrics()
        }
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(homeworkChannel)
    }
  }, [activeChild])

  // Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveStart || !leaveEnd || !leaveReason.trim() || !activeChild) {
      showToast('Please fill out all fields.', 'error')
      return
    }

    setSubmittingLeave(true)
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert({
          student_id: activeChild.id,
          school_id: activeChild.school_id,
          start_date: leaveStart,
          end_date: leaveEnd,
          reason: leaveReason.trim()
        })
        .select()

      if (error) throw error

      setLeaveRequests(prev => [data[0] as LeaveRequest, ...prev])
      showToast('Leave request submitted successfully.')
      setLeaveStart('')
      setLeaveEnd('')
      setLeaveReason('')
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to submit leave.', 'error')
    } finally {
      setSubmittingLeave(false)
    }
  }

  // Send Teacher Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeChild) return

    setSendingMsg(true)
    try {
      const { data, error } = await supabase
        .from('teacher_messages')
        .insert({
          school_id: activeChild.school_id,
          student_id: activeChild.id,
          sender_type: 'parent',
          teacher_name: metadata.classTeacherName || 'Class Teacher',
          message: newMessage.trim()
        })
        .select()

      if (error) throw error

      setMessages(prev => [...prev, data[0] as TeacherMessage])
      setNewMessage('')
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          })
        }
      }, 100)
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to send message.', 'error')
    } finally {
      setSendingMsg(false)
    }
  }

  // Simulated stripe checkout fee pay
  const handleOpenCheckout = (fee: FeeRecord) => {
    setSelectedFee(fee)
    setIsCheckoutOpen(true)
  }

  const handlePayFeeSimulate = async () => {
    if (!selectedFee) return
    setPaymentLoading(true)
    try {
      const { error } = await supabase
        .from('fees')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', selectedFee.id)

      if (error) throw error

      setFees(prev => prev.map(f => f.id === selectedFee.id ? { ...f, status: 'paid' } : f))
      showToast('Payment successful! Invoice cleared.')
      setIsCheckoutOpen(false)
      setSelectedFee(null)
    } catch (e: any) {
      console.error(e)
      showToast('Payment failed. Try again.', 'error')
    } finally {
      setPaymentLoading(false)
    }
  }

  // Save extension metadata
  const handleSaveProfileEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeChild) return
    try {
      const updatedMetadata = { ...metadata, ...profileForm } as StudentMetadata
      setMetadata(updatedMetadata)
      localStorage.setItem(`schoolos_student_ext_${activeChild.id}`, JSON.stringify(updatedMetadata))
      setIsEditProfileOpen(false)
      showToast('Student profile details updated successfully!')
    } catch (e) {
      console.error(e)
      showToast('Failed to save profile details', 'error')
    }
  }

  // Document Upload Mockup
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeChild) return

    setDocumentUploading(true)
    setTimeout(async () => {
      const mockUrl = `https://schoolos-storage.supabase.co/v1/object/public/documents/${file.name}`
      const { data, error } = await supabase
        .from('documents')
        .insert({
          student_id: activeChild.id,
          school_id: activeChild.school_id,
          document_type: file.name.endsWith('.pdf') ? 'PDF' : 'JPG',
          file_url: mockUrl
        })
        .select()
        .single()

      if (!error && data) {
        setDocuments(prev => [data as DocumentRecord, ...prev])
        showToast('Document uploaded successfully!')
      } else {
        showToast(error?.message || 'Upload failed', 'error')
      }
      setDocumentUploading(false)
    }, 1200)
  }

  // Student Photo Upload
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeChild) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = reader.result as string
      const updated = {
        ...metadata,
        avatarUrl: base64String
      }
      setMetadata(updated)
      localStorage.setItem(`schoolos_student_ext_${activeChild.id}`, JSON.stringify(updated))
      showToast('Student photo updated successfully!')
    }
    reader.readAsDataURL(file)
  }

  const calculateGrade = (marks: number) => {
    if (marks >= 90) return 'A+'
    if (marks >= 80) return 'A'
    if (marks >= 70) return 'B'
    if (marks >= 60) return 'C'
    if (marks >= 50) return 'D'
    return 'F'
  }

  // Computed values
  const attendanceRate = useMemo(() => {
    if (attendance.length === 0) return 96 // Premium default
    const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length
    return Math.round((present / attendance.length) * 100)
  }, [attendance])

  const marksAverage = useMemo(() => {
    if (results.length === 0) return 88 // Premium default
    const total = results.reduce((sum, r) => sum + r.marks_obtained, 0)
    return Math.round(total / results.length)
  }, [results])

  const pendingFeesTotal = useMemo(() => {
    return fees
      .filter(f => f.status === 'unpaid' || f.status === 'pending')
      .reduce((sum, f) => sum + f.amount, 0)
  }, [fees])

  const homeworkStreak = useMemo(() => {
    return 6 // Gamified mock streak
  }, [])

  const attendanceStreak = useMemo(() => {
    return 14 // Days present in a row
  }, [])

  const currentGreeting = useMemo(() => {
    const hours = new Date().getHours()
    if (hours < 12) return 'Good Morning'
    if (hours < 17) return 'Good Afternoon'
    return 'Good Evening'
  }, [])

  // Filtered lists based on search bar queries
  const filteredHomework = useMemo(() => {
    if (!searchQuery) return homework
    return homework.filter(hw => 
      hw.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hw.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hw.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [homework, searchQuery])

  const groupedHomework = useMemo(() => {
    // 1. Group homework by publication date (created_at date part)
    const groups: { [key: string]: { dateStr: string; dayName: string; items: HomeworkItem[] } } = {}
    
    filteredHomework.forEach(hw => {
      // Parse created_at timestamp to local date parts
      const dateObj = hw.created_at ? new Date(hw.created_at) : new Date(hw.due_date)
      const day = String(dateObj.getDate()).padStart(2, '0')
      const month = String(dateObj.getMonth() + 1).padStart(2, '0')
      const year = dateObj.getFullYear()
      const dateKey = `${year}-${month}-${day}` // Sortable key
      const displayDate = `${day}-${month}-${year}`
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateStr: displayDate,
          dayName,
          items: []
        }
      }
      groups[dateKey].items.push(hw)
    })

    // 2. Sort the date keys descending (latest published first)
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))

    // 3. Take max 7 days of homework at once
    const limitedKeys = sortedKeys.slice(0, 7)

    // 4. Return sorted and limited group items
    return limitedKeys.map(key => ({
      key,
      ...groups[key]
    }))
  }, [filteredHomework])

  const filteredCirculars = useMemo(() => {
    if (!searchQuery) return circulars
    return circulars.filter(circ => 
      circ.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      circ.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      circ.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [circulars, searchQuery])

  // Calendar Helpers
  const currentMonthDays = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const firstDayIndex = new Date(year, month, 1).getDay()
    const lastDayDate = new Date(year, month + 1, 0).getDate()
    
    const daysArr = []
    // Pad initial offsets
    for (let i = 0; i < firstDayIndex; i++) {
      daysArr.push(null)
    }
    // Days of month
    for (let d = 1; d <= lastDayDate; d++) {
      daysArr.push(new Date(year, month, d))
    }
    return daysArr
  }, [calendarDate])

  const getCalendarDayEvents = (date: Date | null) => {
    if (!date) return []
    const list: { type: 'homework' | 'exam' | 'holiday' | 'ptm' | 'birthday'; title: string; color: string }[] = []
    const dateStr = date.toISOString().split('T')[0]
    
    // Check homework
    homework.forEach(hw => {
      if (hw.due_date === dateStr) {
        list.push({ type: 'homework', title: `Homework Due: ${hw.title}`, color: 'bg-purple-500' })
      }
    })

    // Check circulars / exams
    results.forEach(res => {
      // Mock result dates around current month
      const examSeed = new Date(2026, calendarDate.getMonth(), 10 + (res.subject_name.length % 15))
      if (examSeed.toISOString().split('T')[0] === dateStr) {
        list.push({ type: 'exam', title: `${res.exam_title} - ${res.subject_name}`, color: 'bg-blue-500' })
      }
    })

    // Check school events database
    schoolEvents.forEach(evt => {
      if (evt.start_date === dateStr) {
        let col = 'bg-amber-500'
        if (evt.event_type === 'PTM') col = 'bg-emerald-500'
        if (evt.event_type === 'Holiday') col = 'bg-rose-500'
        list.push({ type: evt.event_type.toLowerCase() as any, title: evt.title, color: col })
      }
    })

    // Student birthday
    if (activeChild?.date_of_birth) {
      const bday = new Date(activeChild.date_of_birth)
      if (bday.getDate() === date.getDate() && bday.getMonth() === date.getMonth()) {
        list.push({ type: 'birthday', title: `🎉 Happy Birthday ${activeChild.full_name}!`, color: 'bg-amber-400' })
      }
    }

    return list
  }

  const handlePrevMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  // Active timetable period calculations
  const activePeriodIndex = useMemo(() => {
    // Simulated index 0-4 for styling timeline
    const hour = new Date().getHours()
    if (hour <= 9) return 0
    if (hour <= 10) return 1
    if (hour <= 11) return 2
    if (hour <= 12) return 3
    return 4
  }, [])

  // Smart dynamic recommend helper: "What to do next?"
  const nextActions = useMemo(() => {
    const list = []
    
    // 1. Unpaid fees
    if (pendingFeesTotal > 0) {
      list.push({
        title: 'Clear Academic Dues',
        description: `Pay pending fee amount of ₹${pendingFeesTotal} for ${activeChild?.full_name || 'your child'} to avoid billing block.`,
        actionText: 'Clear Fees',
        tab: 'fees',
        theme: 'orange'
      })
    }

    // 2. Pending homework
    homework.slice(0, 2).forEach(hw => {
      list.push({
        title: `Submit ${hw.subject_name} Tasks`,
        description: `Complete "${hw.title}" assigned by ${hw.teacher_name || 'your teacher'} by ${hw.due_date}.`,
        actionText: 'Start Homework',
        tab: 'homework',
        theme: 'purple'
      })
    })

    // 3. Messages
    if (messages.length > 0 && messages[messages.length - 1].sender_type === 'teacher') {
      list.push({
        title: 'Review Teacher Feedback',
        description: `Class teacher sent feedback: "${messages[messages.length - 1].message.slice(0, 50)}..."`,
        actionText: 'Reply Chats',
        tab: 'messages',
        theme: 'indigo'
      })
    }

    // Default motivate card
    if (list.length === 0) {
      list.push({
        title: 'Check notices and updates',
        description: 'You are completely caught up on your studies! Good job, check the school circulars for sports announcements.',
        actionText: 'Notices Board',
        tab: 'circulars',
        theme: 'blue'
      })
    }

    return list
  }, [pendingFeesTotal, homework, messages, activeChild])

  if (loading || !activeChild) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-slate-105">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-650 animate-spin flex items-center justify-center p-1 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center">
              <span className="text-white text-lg font-black">★</span>
            </div>
          </div>
          <div className="space-y-2 text-center">
            <h3 className="text-sm font-bold text-slate-205">Syncing learning workspace...</h3>
            <p className="text-xs text-slate-500 font-semibold animate-pulse">Establishing secure school session...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen font-sans flex flex-col relative overflow-hidden transition-colors duration-300 ${
      darkMode ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Background radial spotlights for visual interest */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[40%] h-[40%] rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />

      {/* Global alert toast notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-55 flex items-center gap-3 px-4.5 py-3 rounded-2xl shadow-2xl font-bold text-xs border backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800/80 shadow-emerald-950/20' 
            : 'bg-rose-950/90 text-rose-300 border-rose-800/80 shadow-rose-950/20'
        }`}>
          <span className="text-base">{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Premium Sticky top navigation navbar */}
      <header className="border-b sticky top-0 z-40 backdrop-blur-md transition-colors duration-200 bg-white/70 border-slate-200/60 dark:bg-slate-950/70 dark:border-slate-900">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 select-none">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center font-black text-base shadow shadow-indigo-600/35 transition-transform hover:rotate-6">
              ★
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-extrabold tracking-tight dark:text-white text-slate-900 leading-none">SchoolOS</span>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">STUDENT PORTAL</span>
            </div>
          </div>

          {/* Search bar inside header */}
          <div className="hidden md:flex flex-1 max-w-md items-center bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white focus-within:border-indigo-400 transition relative">
            <svg className="text-slate-400 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input 
              type="text" 
              placeholder="Search tasks, notices, billing..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs ml-2.5 w-full placeholder-slate-400 dark:text-slate-200 text-slate-700 focus:outline-none"
            />
            <span className="text-[9px] font-black text-slate-450 dark:bg-slate-950/60 bg-slate-200 px-1.5 py-0.5 rounded ml-2 select-none border border-slate-350 dark:border-slate-855">⌘K</span>
          </div>

          {/* Header Action Elements */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            
            {/* Child Toggle Dropdown Selector if multiple exists */}
            {children.length > 1 && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-2xl px-3.5 py-1.5 transition">
                <span className="text-[9px] font-black uppercase text-slate-400 hidden sm:inline">Active:</span>
                <select
                  value={activeChild.id}
                  onChange={(e) => {
                    const match = children.find(c => c.id === e.target.value)
                    if (match) setActiveChild(match)
                  }}
                  className="bg-transparent text-xs font-black text-indigo-600 dark:text-indigo-400 outline-none border-none cursor-pointer focus:ring-0"
                >
                  {children.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100 font-semibold">{c.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Direct messages toggle shortcut */}
            <button
              onClick={() => setActiveTab('messages')}
              className={`p-2 rounded-2xl border transition relative ${
                activeTab === 'messages'
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-600/30'
                  : 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 dark:text-slate-300'
              }`}
              title="Teacher Messages"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
            </button>

            {/* Notifications Button */}
            <div className="relative" ref={notificationsRef}>
              <button 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen)
                  setIsProfileOpen(false)
                }}
                className={`p-2 rounded-2xl border transition relative ${
                  isNotificationsOpen
                    ? 'bg-white dark:bg-slate-850 dark:border-slate-700 border-slate-300 text-slate-900 dark:text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-455 dark:text-slate-300'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-slate-900" />
              </button>

              {isNotificationsOpen && (
                <div className="fixed md:absolute top-16 md:top-auto right-4 md:right-0 left-4 md:left-auto mt-3 md:w-80 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-855 rounded-3xl shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850 mb-3 select-none">
                    <span className="text-xs font-black dark:text-slate-200 text-slate-800 uppercase tracking-wider">Updates Vault</span>
                    <span className="text-[9px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">New activity</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-3 text-left">
                      <span className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">New Homework Published</span>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Math teacher uploaded Calculus sheet • 10m ago</span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-left">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">Tuition Fees Synced</span>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Term 2 invoice billed by school office • 1h ago</span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-left">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">Marks Ledger Updated</span>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Term 1 science exam remarks updated • Yesterday</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dark Mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 transition duration-300"
              title="Toggle Theme"
            >
              {darkMode ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin-slow">
                  <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
              )}
            </button>

            {/* User Profile dropdown menu */}
            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen)
                  setIsNotificationsOpen(false)
                }}
                className="flex items-center gap-2.5 pl-2 border-l cursor-pointer border-slate-200 dark:border-slate-800 select-none text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-100 to-indigo-100 text-indigo-705 flex items-center justify-center font-black text-xs border border-indigo-200/50 shadow-sm transition-transform hover:scale-105 shrink-0 overflow-hidden">
                  {metadata.avatarUrl ? (
                    <img src={metadata.avatarUrl} alt={activeChild.full_name} className="object-cover w-full h-full" />
                  ) : (
                    activeChild.full_name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold dark:text-slate-200 text-slate-800 leading-none">{activeChild.full_name}</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{activeChild.class_name} • Sec {metadata.section}</span>
                </div>
                <svg className="w-3 h-3 text-slate-400 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isProfileOpen && (
                <div className="fixed md:absolute top-16 md:top-auto right-4 md:right-0 left-4 md:left-auto mt-3 md:w-52 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-855 rounded-3xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200 text-left font-sans">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-850 mb-1">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">{activeChild.full_name}</span>
                    <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Adm: {metadata.admissionNo}</span>
                  </div>
                  <button 
                    onClick={() => { setActiveTab('profile'); setIsProfileOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition block text-left"
                  >
                    👤 My Profile
                  </button>
                  <button 
                    onClick={() => { setActiveTab('documents'); setIsProfileOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition block text-left"
                  >
                    📂 Documents Vault
                  </button>
                  <hr className="border-slate-100 dark:border-slate-850 my-1" />
                  <button 
                    onClick={() => {
                      localStorage.removeItem('schoolos_parent_session')
                      supabase.auth.signOut().then(() => router.push('/parent'))
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition block text-left"
                  >
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-2xl border lg:hidden bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main dashboard content container */}
      <div className="max-w-8xl mx-auto w-full flex-1 flex relative z-10">
        
        {/* Mobile Sidebar backdrop overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden transition-all"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* SIDEBAR NAVIGATION (Desktop collapsible, Mobile side overlay) */}
        <aside className={`border-r shrink-0 transition-all duration-300 bg-white/95 dark:bg-slate-900/95 border-slate-200/60 dark:border-slate-900 lg:flex flex-col sticky top-16 h-[calc(100vh-4rem)] z-35 ${
          isMobileMenuOpen 
            ? 'fixed inset-y-0 left-0 w-64 z-50 flex shadow-2xl animate-in slide-in-from-left duration-200' 
            : (isSidebarCollapsed ? 'w-18' : 'w-64') + ' hidden lg:flex'
        }`}>
          {/* Close button inside sidebar on mobile */}
          {isMobileMenuOpen && (
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 dark:border-slate-900 lg:hidden">
              <span className="text-xs font-black dark:text-slate-205 text-slate-800">Menu Navigation</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">
                ✕
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-5 px-3 space-y-4 scrollbar-none">
            
            {/* Collapse switch button for desktop */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex items-center justify-center ml-auto w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 text-slate-450 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              <span>{isSidebarCollapsed ? '→' : '←'}</span>
            </button>

            {/* Sidebar Navigation Items */}
            <nav className="space-y-1">
              {[
                { id: 'overview', label: 'Dashboard Hub', icon: '📊' },
                { id: 'attendance', label: 'Attendance', icon: '📅' },
                { id: 'homework', label: 'Homework Tasks', icon: '📝' },
                { id: 'results', label: 'Grades & Results', icon: '🏆' },
                { id: 'fees', label: 'Billing & Fees', icon: '💳' },
                { id: 'timetable', label: 'Class Timetable', icon: '⏱' },
                { id: 'calendar', label: 'Interactive Calendar', icon: '🗓' },
                { id: 'circulars', label: 'School Notices', icon: '📢' },
                { id: 'messages', label: 'Teacher Chats', icon: '💬' },
                { id: 'leaves', label: 'Leave Requests', icon: '📂' },
                { id: 'documents', label: 'Documents Vault', icon: '📥' },
                { id: 'achievements', label: 'Achievements', icon: '🏅' },
                { id: 'profile', label: 'Student Profile', icon: '👤' }
              ].map(tab => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any)
                      setIsMobileMenuOpen(false)
                    }}
                    className={`w-full flex items-center py-3 rounded-2xl font-bold transition-all relative group cursor-pointer ${
                      isMobileMenuOpen || !isSidebarCollapsed ? 'px-4 justify-start' : 'justify-center px-1'
                    } ${
                      isActive 
                        ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15' 
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-800 dark:hover:text-slate-350 border border-transparent'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-r-full" />
                    )}
                    <span className="text-base shrink-0 group-hover:scale-115 transition-transform duration-200">{tab.icon}</span>
                    {(isMobileMenuOpen || !isSidebarCollapsed) && (
                      <span className={`ml-3 text-xs tracking-wide ${!isMobileMenuOpen && isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>{tab.label}</span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Quick Profile Summary Footer of Sidebar */}
          {(isMobileMenuOpen || !isSidebarCollapsed) && (
            <div className="p-4 border-t border-slate-200/60 dark:border-slate-900 select-none">
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200/50 dark:border-slate-900">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0 overflow-hidden">
                  {metadata.avatarUrl ? (
                    <img src={metadata.avatarUrl} alt={activeChild.full_name} className="object-cover w-full h-full" />
                  ) : (
                    activeChild.full_name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="text-left min-w-0">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 block truncate">{activeChild.full_name}</span>
                  <span className="text-[9px] text-slate-400 font-bold block truncate uppercase">Roll: {metadata.rollNumber} • House: {metadata.house.split(' ')[0]}</span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* WORKSPACE PAGES AREA */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">

          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Premium Welcome Hero Section */}
              <section className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 dark:from-slate-900 dark:to-slate-950 rounded-3xl p-6 sm:p-8 border border-slate-200/10 dark:border-slate-850 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden text-white text-left">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.25),transparent_60%)] pointer-events-none" />
                <div className="space-y-2 relative z-10">
                  <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
                    {currentGreeting}, {activeChild.full_name.split(' ')[0]} 👋
                  </h1>
                  <p className="text-xs sm:text-sm text-indigo-100 font-medium max-w-lg leading-relaxed">
                    Ready to achieve greatness today? You have a homework streak of <strong className="text-yellow-300">{homeworkStreak} completed tasks</strong> in a row!
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2 text-[10px] sm:text-xs">
                    <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10 font-bold text-slate-105">📅 {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                    <span className="bg-white/10 px-3 py-1 rounded-full border border-white/10 font-bold text-slate-105">🏡 Section {metadata.section}</span>
                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-bold">✓ Active Status</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 shrink-0 w-full md:w-auto relative z-10 font-bold select-none text-[11px] sm:text-xs">
                  <div className="bg-white/10 backdrop-blur-sm border border-white/10 p-3.5 rounded-2xl text-center space-y-1">
                    <span className="text-white/60 block font-medium">Classes Today</span>
                    <span className="text-lg font-black block">{timetable.length} periods</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/10 p-3.5 rounded-2xl text-center space-y-1">
                    <span className="text-white/60 block font-medium">Homework Due</span>
                    <span className="text-lg font-black block text-yellow-300">{homework.length} pending</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/10 p-3.5 rounded-2xl text-center space-y-1">
                    <span className="text-white/60 block font-medium">Attendance Rate</span>
                    <span className="text-lg font-black block text-emerald-300">{attendanceRate}%</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/10 p-3.5 rounded-2xl text-center space-y-1">
                    <span className="text-white/60 block font-medium">GPA Grade</span>
                    <span className="text-lg font-black block text-blue-300">A ({marksAverage}/100)</span>
                  </div>
                </div>
              </section>

              {/* "What should I do next?" smart recommendations widget */}
              <section className="space-y-3.5 text-left">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">What should I do next?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nextActions.map((action, idx) => (
                    <div 
                      key={idx} 
                      className={`border p-5 rounded-3xl backdrop-blur-sm shadow-sm flex items-start gap-4 transition-transform hover:scale-[1.01] ${
                        action.theme === 'purple' 
                          ? 'bg-purple-500/5 border-purple-500/20 text-purple-900 dark:text-purple-300' 
                          : action.theme === 'orange'
                          ? 'bg-amber-500/5 border-amber-500/20 text-amber-905 dark:text-amber-300'
                          : 'bg-blue-500/5 border-blue-500/20 text-blue-900 dark:text-blue-300'
                      }`}
                    >
                      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-base shrink-0">
                        {action.theme === 'purple' ? '📝' : action.theme === 'orange' ? '💳' : '📢'}
                      </div>
                      <div className="space-y-1 flex-1 leading-normal">
                        <h4 className="text-xs font-black uppercase tracking-wider">{action.title}</h4>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">{action.description}</p>
                        <button 
                          onClick={() => setActiveTab(action.tab as any)}
                          className={`text-[10px] font-black uppercase tracking-wider mt-2.5 px-3 py-1.5 rounded-lg text-white shadow-sm cursor-pointer block w-fit ${
                            action.theme === 'purple' ? 'bg-purple-600 hover:bg-purple-700' : action.theme === 'orange' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {action.actionText} →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Quick Analytics Cards Panel */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 select-none">
                
                {/* 1. Attendance card */}
                <div 
                  onClick={() => setActiveTab('attendance')}
                  className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-5 text-left space-y-3 cursor-pointer hover:scale-102 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attendance Status</span>
                    <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs font-black">📅</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black">{attendanceRate}%</h3>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-1">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-450 h-1.5 rounded-full" style={{ width: `${attendanceRate}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Streak: {attendanceStreak} days</span>
                    <span className="text-emerald-500 font-bold">Excel Rate</span>
                  </div>
                </div>

                {/* 2. Homework pending card */}
                <div 
                  onClick={() => setActiveTab('homework')}
                  className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-5 text-left space-y-3 cursor-pointer hover:scale-102 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pending Homework</span>
                    <span className="p-2 bg-purple-500/10 text-purple-500 rounded-xl text-xs font-black">📝</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black">{homework.length} Tasks</h3>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-1">
                      <div className="bg-gradient-to-r from-purple-500 to-violet-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(10, (1 - homework.length / 8) * 100))}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Streak: {homeworkStreak} tasks</span>
                    <span className="text-amber-505 font-bold">{homework.length > 0 ? 'Due soon' : 'All clear'}</span>
                  </div>
                </div>

                {/* 3. Average Grade card */}
                <div 
                  onClick={() => setActiveTab('results')}
                  className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-5 text-left space-y-3 cursor-pointer hover:scale-102 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Average Marks</span>
                    <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl text-xs font-black">🏆</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black">{marksAverage} / 100</h3>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-1">
                      <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-1.5 rounded-full" style={{ width: `${marksAverage}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Grade equivalent: {calculateGrade(marksAverage)}</span>
                    <span className="text-indigo-400 font-bold">Top 10% Rank</span>
                  </div>
                </div>

                {/* 4. Dues and Fees card */}
                <div 
                  onClick={() => setActiveTab('fees')}
                  className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-855 rounded-3xl p-5 text-left space-y-3 cursor-pointer hover:scale-102 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Outstanding Fees</span>
                    <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl text-xs font-black">💳</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-rose-500">₹{pendingFeesTotal}</h3>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-1">
                      <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${pendingFeesTotal > 0 ? 30 : 100}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Unpaid bills: {fees.filter(f => f.status === 'unpaid').length}</span>
                    <span className={pendingFeesTotal > 0 ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
                      {pendingFeesTotal > 0 ? 'Payment Required' : 'Fees Paid'}
                    </span>
                  </div>
                </div>

                {/* 5. Upcoming Exams card */}
                <div 
                  onClick={() => setActiveTab('calendar')}
                  className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-855 rounded-3xl p-5 text-left space-y-3 cursor-pointer hover:scale-102 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Upcoming Exams</span>
                    <span className="p-2 bg-blue-500/10 text-blue-500 rounded-xl text-xs font-black">⏱</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black">{results.length > 0 ? results.length : 3} Scheduled</h3>
                    <div className="w-full bg-slate-200 dark:bg-slate-805 rounded-full h-1.5 mt-1">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full" style={{ width: '60%' }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Next Term Paper</span>
                    <span className="text-indigo-400 font-bold">View Schedule</span>
                  </div>
                </div>

                {/* 6. Achievements Badges card */}
                <div 
                  onClick={() => setActiveTab('achievements')}
                  className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-855 rounded-3xl p-5 text-left space-y-3 cursor-pointer hover:scale-102 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Streaks & Awards</span>
                    <span className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl text-xs font-black">🏅</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black">4 Badge Awards</h3>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-1">
                      <div className="bg-gradient-to-r from-yellow-500 to-amber-500 h-1.5 rounded-full" style={{ width: '80%' }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Streaks: 14 Checkins</span>
                    <span className="text-amber-500 font-bold">View Badges</span>
                  </div>
                </div>

              </section>

              {/* Today's Timetable timeline and SVGs visual graphs */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Today's timeline schedule planner */}
                <div className="lg:col-span-1 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-5">
                  <div className="flex justify-between items-center select-none border-b border-slate-100 dark:border-slate-850 pb-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Today's Timeline</h4>
                    <button onClick={() => setActiveTab('timetable')} className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:underline">View Timetable</button>
                  </div>

                  {timetable.length > 0 ? (
                    <div className="relative border-l border-slate-200 dark:border-slate-800 ml-2 space-y-4 pl-4 py-1.5">
                      {timetable.map((slot, idx) => {
                        const isCurrentSlot = idx === activePeriodIndex
                        return (
                          <div key={slot.id} className="relative group leading-normal">
                            <span className={`absolute left-[-21px] top-1.5 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-950 transition-all ${
                              isCurrentSlot 
                                ? 'bg-indigo-500 ring-4 ring-indigo-500/20 scale-120 animate-pulse' 
                                : 'bg-slate-300 dark:bg-slate-700'
                            }`} />
                            <div className={`p-3 rounded-2xl border transition-all ${
                              isCurrentSlot 
                                ? 'bg-gradient-to-r from-indigo-500/5 to-violet-500/5 border-indigo-500/25 shadow-sm' 
                                : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-900/40 hover:border-slate-200/40 dark:hover:border-slate-850/40'
                            }`}>
                              <span className={`text-[8px] font-black uppercase tracking-wider block ${
                                isCurrentSlot ? 'text-indigo-400 font-extrabold' : 'text-slate-500'
                              }`}>
                                {slot.time_slot} | {slot.period}
                              </span>
                              <h5 className="text-xs font-extrabold dark:text-slate-200 text-slate-800 mt-1 truncate">{slot.subject}</h5>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate">Room: {slot.room_no || 'Room 12B'} • {slot.teacher_name}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                      <div className="text-2xl">💤</div>
                      <p className="font-semibold italic">No classes scheduled for today.</p>
                    </div>
                  )}
                </div>

                {/* Custom SVG premium academic trend graphics */}
                <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-6">
                  <div className="border-b border-slate-100 dark:border-slate-850 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Academic performance trend</h4>
                    <div className="flex gap-2.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> My Average</span>
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full" /> Class Average</span>
                    </div>
                  </div>

                  {/* Redesigned responsive SVG bar reports */}
                  <div className="space-y-6">
                    
                    {/* SVG Graph 1: Comparative subject ledger chart */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Subject marks vs class average</span>
                      <div className="h-44 w-full flex items-end justify-between gap-4 pt-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                        {[
                          { subject: 'Math', me: 92, classAvg: 78 },
                          { subject: 'Science', me: 85, classAvg: 80 },
                          { subject: 'English', me: 95, classAvg: 74 },
                          { subject: 'Social', me: 76, classAvg: 72 },
                          { subject: 'Computer', me: 98, classAvg: 85 }
                        ].map((stat, idx) => (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end relative group select-none">
                            {/* Hover marks tooltip */}
                            <div className="absolute top-[-10px] left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10 pointer-events-none border border-slate-800 shadow">
                              You: {stat.me}% | Avg: {stat.classAvg}%
                            </div>
                            
                            {/* Double Bars wrapper */}
                            <div className="w-full flex justify-center items-end gap-1 sm:gap-2.5 h-[80%]">
                              {/* My marks bar */}
                              <div 
                                className="w-2.5 sm:w-5 bg-gradient-to-t from-indigo-600 to-violet-500 rounded-t-md shadow-sm transition-all duration-300 hover:brightness-110 relative"
                                style={{ height: `${stat.me}%` }}
                              />
                              {/* Class avg bar */}
                              <div 
                                className="w-2.5 sm:w-5 bg-slate-200 dark:bg-slate-850 rounded-t-md transition-all duration-300 hover:brightness-110"
                                style={{ height: `${stat.classAvg}%` }}
                              />
                            </div>

                            <span className="text-[9px] font-black text-slate-450 mt-2 truncate w-full text-center">{stat.subject}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SVG Graph 2: Attendance monthly progress lines */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Attendance Rate Trend</span>
                        <div className="bg-slate-50 dark:bg-slate-950/45 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-900 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-450 block uppercase">Monthly Avg</span>
                            <span className="text-xl font-black text-emerald-500">{attendanceRate}%</span>
                            <span className="text-[8px] font-bold text-slate-405 block mt-0.5">+2.4% from last month</span>
                          </div>
                          {/* Inline sparkline SVG path */}
                          <svg className="w-28 h-12 text-emerald-500" viewBox="0 0 100 30" fill="none">
                            <path 
                              d="M0 25 C 10 24, 20 18, 30 20 C 40 22, 50 14, 60 12 C 70 10, 80 4, 100 2" 
                              stroke="currentColor" 
                              strokeWidth="2.5" 
                              strokeLinecap="round"
                            />
                            <path 
                              d="M0 25 C 10 24, 20 18, 30 20 C 40 22, 50 14, 60 12 C 70 10, 80 4, 100 2 L 100 30 L 0 30 Z" 
                              fill="currentColor" 
                              fillOpacity="0.08"
                            />
                          </svg>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Overall Marks Grade</span>
                        <div className="bg-slate-50 dark:bg-slate-950/45 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-900 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-slate-455 block uppercase">GPA Rank</span>
                            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-extrabold">Class Rank: #4</span>
                            <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Outstanding Class Standing</span>
                          </div>
                          {/* Radial progress circle */}
                          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full rotate-[-90deg]">
                              <circle cx="24" cy="24" r="20" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="3" fill="transparent" />
                              <circle 
                                cx="24" 
                                cy="24" 
                                r="20" 
                                stroke="currentColor" 
                                className="text-indigo-500" 
                                strokeWidth="3.5" 
                                fill="transparent" 
                                strokeDasharray="125.6" 
                                strokeDashoffset="18" 
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute text-[10px] font-black text-indigo-600 dark:text-indigo-400">A</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Quick Actions Action Grid */}
              <section className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest select-none">Quick Portal Actions</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5 select-none font-bold text-[10px] sm:text-xs">
                  <button onClick={() => setActiveTab('homework')} className="bg-slate-55 dark:bg-slate-950 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800 transition active:scale-95 text-center cursor-pointer space-y-2">
                    <span className="text-lg block">📝</span>
                    <span className="block truncate">Open Homework</span>
                  </button>
                  <button onClick={() => setActiveTab('results')} className="bg-slate-55 dark:bg-slate-950 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800 transition active:scale-95 text-center cursor-pointer space-y-2">
                    <span className="text-lg block">🏆</span>
                    <span className="block truncate">View Results</span>
                  </button>
                  <button onClick={() => setActiveTab('timetable')} className="bg-slate-55 dark:bg-slate-955 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800 transition active:scale-95 text-center cursor-pointer space-y-2">
                    <span className="text-lg block">⏱</span>
                    <span className="block truncate">View Timetable</span>
                  </button>
                  <button onClick={() => setActiveTab('results')} className="bg-slate-55 dark:bg-slate-950 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-855 hover:border-slate-300 dark:hover:border-slate-800 transition active:scale-95 text-center cursor-pointer space-y-2">
                    <span className="text-lg block">📥</span>
                    <span className="block truncate">Report Card</span>
                  </button>
                  <button onClick={() => setActiveTab('attendance')} className="bg-slate-55 dark:bg-slate-950 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800 transition active:scale-95 text-center cursor-pointer space-y-2">
                    <span className="text-lg block">📅</span>
                    <span className="block truncate">View Attendance</span>
                  </button>
                  <button onClick={() => setActiveTab('leaves')} className="bg-slate-55 dark:bg-slate-950 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800 transition active:scale-95 text-center cursor-pointer space-y-2">
                    <span className="text-lg block">📂</span>
                    <span className="block truncate">Absence Leave</span>
                  </button>
                  <button onClick={() => setActiveTab('messages')} className="bg-slate-55 dark:bg-slate-950 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800 transition active:scale-95 text-center cursor-pointer space-y-2">
                    <span className="text-lg block">💬</span>
                    <span className="block truncate">Teacher Chat</span>
                  </button>
                </div>
              </section>

            </div>
          )}

          {/* TAB 2: ATTENDANCE logs */}
          {activeTab === 'attendance' && (
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h3 className="text-lg font-black dark:text-white text-slate-805">Attendance register logs</h3>
                <p className="text-xs text-slate-450 mt-1 font-semibold">Track monthly check-ins and absence stats.</p>
              </div>

              {attendance.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500 italic">
                  No attendance records found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {attendance.map(att => (
                    <div key={att.id} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-900 rounded-2xl p-4 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{att.date}</span>
                      <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg border tracking-widest ${
                        att.status === 'present' 
                          ? 'bg-emerald-950/45 border-emerald-900 text-emerald-400' 
                          : att.status === 'late' 
                          ? 'bg-amber-950/45 border-amber-900 text-amber-400' 
                          : 'bg-rose-950/45 border-rose-900 text-rose-400'
                      }`}>
                        {att.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HOMEWORK tasks */}
          {activeTab === 'homework' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black dark:text-white text-slate-800">Class homework diaries</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">Open and submit worksheets assigned by class teachers. Shows up to 7 days of tasks.</p>
                </div>
                <div className="bg-indigo-50 dark:bg-slate-955 px-4 py-2 border border-indigo-200/50 dark:border-indigo-900/30 rounded-2xl shrink-0 select-none">
                  <span className="text-[9px] font-black text-slate-400 block uppercase">Active Period</span>
                  <span className="text-xs font-extrabold text-indigo-650 dark:text-indigo-400">Last 7 Days of Homework</span>
                </div>
              </div>

              {groupedHomework.length === 0 ? (
                <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-850 rounded-3xl p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-3">
                  <div className="text-3xl">📝</div>
                  <h4 className="text-xs font-black dark:text-white text-slate-850">No homework tasks found</h4>
                  <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed text-center font-medium">All tasks are successfully submitted, or there are no assignments for this section.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {groupedHomework.map(group => (
                    <div key={group.key} className="space-y-4">
                      {/* Premium Date Header */}
                      <div className="flex items-center gap-3 select-none">
                        <div className="text-xs font-black text-indigo-650 dark:text-indigo-400">
                          {group.dateStr}
                        </div>
                        <div className="text-[10px] text-slate-450 dark:text-slate-350 font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 px-2.5 py-0.5 rounded-lg">
                          {group.dayName}
                        </div>
                        <div className="h-px bg-slate-200 dark:bg-slate-850 flex-1" />
                      </div>

                      {/* Homework Cards in Day Group */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {group.items.map(hw => {
                          const isOverdue = new Date(hw.due_date) < new Date()
                          const dueTime = new Date(hw.due_date).getTime()
                          const diffDays = (dueTime - new Date().getTime()) / (1000 * 60 * 60 * 24)
                          
                          let priority: 'High' | 'Medium' | 'Low' = 'Low'
                          if (diffDays >= 0 && diffDays < 2) {
                            priority = 'High'
                          } else if (diffDays >= 2 && diffDays < 5) {
                            priority = 'Medium'
                          }

                          return (
                            <div key={hw.id} className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 flex flex-col justify-between hover:shadow-lg hover:border-slate-350 dark:hover:border-slate-800 transition shadow relative overflow-hidden group">
                              <div className="space-y-4">
                                <div className="flex flex-wrap gap-2 items-center">
                                  <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 inline-block">
                                    {hw.subject_name}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                    priority === 'High' 
                                      ? 'bg-rose-950/40 border-rose-900 text-rose-400' 
                                      : priority === 'Medium' 
                                      ? 'bg-amber-950/40 border-amber-900 text-amber-450' 
                                      : 'bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-850 text-slate-500 dark:text-slate-400'
                                  }`}>
                                    {priority} Priority
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                    isOverdue ? 'bg-rose-950/40 border-rose-900 text-rose-455' : 'bg-emerald-950/40 border-emerald-900 text-emerald-300'
                                  }`}>
                                    {isOverdue ? 'Overdue' : 'Assigned'}
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <h4 className="text-sm font-extrabold dark:text-white text-slate-800 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{hw.title}</h4>
                                  <span className="text-[10px] text-slate-400 font-bold block">Issued by: {hw.teacher_name}</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed line-clamp-3">{hw.description}</p>
                              </div>

                              <div className="border-t border-slate-100 dark:border-slate-850 pt-4 mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                                  Due: {new Date(hw.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                <div className="flex gap-2">
                                  {hw.pdf_url && (
                                    <a href={hw.pdf_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-rose-500 hover:underline flex items-center gap-1">
                                      📄 PDF Worksheet
                                    </a>
                                  )}
                                  <button
                                    onClick={() => {
                                      setSelectedHomework(hw)
                                      setIsHwModalOpen(true)
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-xl shadow cursor-pointer active:scale-95 transition"
                                  >
                                    Open Card
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ACADEMIC RESULTS */}
          {activeTab === 'results' && (
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-4">
                <div>
                  <h3 className="text-lg font-black dark:text-white text-slate-805">Academic examination ledger</h3>
                  <p className="text-xs text-slate-450 mt-1 font-semibold">Official score history entries in details.</p>
                </div>
                <div className="bg-indigo-50 dark:bg-slate-950 px-4 py-2 border border-indigo-200/50 dark:border-indigo-900/30 rounded-2xl">
                  <span className="text-[9px] font-black text-slate-450 block uppercase">Calculated GPA</span>
                  <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">Class Rank: #4 (Avg {marksAverage}%)</span>
                </div>
              </div>

              {results.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500 italic">
                  No exam marks ledger entries resolved yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map(r => (
                    <div key={r.id} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-905 rounded-3xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center transition hover:border-slate-350 dark:hover:border-slate-800">
                      <div className="text-left sm:col-span-2 space-y-1">
                        <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">{r.exam_term} - {r.exam_title}</span>
                        <h4 className="text-sm font-extrabold dark:text-white text-slate-800">{r.subject_name}</h4>
                        <p className="text-xs text-slate-450 italic font-semibold">Teacher: {r.remarks || 'Outstanding dedication shown.'}</p>
                      </div>
                      <div className="text-left sm:text-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Marks ledger</span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">{r.marks_obtained} / {r.max_marks}</span>
                      </div>
                      <div className="text-left sm:text-right select-none">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-widest inline-block ${
                          r.grade === 'A+' || r.grade === 'A' 
                            ? 'bg-emerald-950/45 text-emerald-400 border-emerald-900/60' 
                            : r.grade === 'B' || r.grade === 'C' 
                            ? 'bg-indigo-950/45 text-indigo-400 border-indigo-900/60' 
                            : 'bg-rose-950/45 text-rose-500 border-rose-900/60'
                        }`}>
                          Grade: {r.grade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BILLING & FEES */}
          {activeTab === 'fees' && (
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-4">
                <div>
                  <h3 className="text-lg font-black dark:text-white text-slate-800">School invoices billing</h3>
                  <p className="text-xs text-slate-450 mt-1 font-semibold">Verify and settle outstanding fee billing securely.</p>
                </div>
                <span className="text-base">💳</span>
              </div>

              {fees.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500 italic">
                  No billing invoices synced for this child yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {fees.map(fee => (
                    <div key={fee.id} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-900 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:border-slate-350 dark:hover:border-slate-800 animate-in fade-in duration-200">
                      <div className="text-left space-y-1">
                        <h4 className="text-sm font-extrabold dark:text-white text-slate-800">{fee.month}</h4>
                        <span className="text-xs font-bold text-slate-500 block">Billed: ₹{fee.amount} | Date: {new Date(fee.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-3.5">
                        <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg border tracking-widest ${
                          fee.status === 'paid' 
                            ? 'bg-emerald-950/45 border-emerald-900 text-emerald-400' 
                            : 'bg-rose-950/45 border-rose-900 text-rose-500'
                        }`}>
                          {fee.status}
                        </span>

                        {fee.status !== 'paid' && (
                          <button
                            onClick={() => handleOpenCheckout(fee)}
                            className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl shadow-md transition active:scale-95 cursor-pointer"
                          >
                            Pay Securely
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: TIMETABLE */}
          {activeTab === 'timetable' && (
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h3 className="text-lg font-black dark:text-white text-slate-800">Weekly class periods schedule</h3>
                <p className="text-xs text-slate-450 mt-1 font-semibold">Timetable slots designed for Class {activeChild.class_name}.</p>
              </div>

              {timetable.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-slate-250 dark:border-slate-850 rounded-2xl text-center text-xs text-slate-500 italic">
                  Timetable schedule ledger entries empty.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {timetable.map(slot => (
                    <div key={slot.id} className="bg-slate-50 dark:bg-slate-955/40 border border-slate-200/50 dark:border-slate-900 rounded-3xl p-5 text-left space-y-3 transition hover:border-slate-350 dark:hover:border-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
                        <span className="text-xs font-black dark:text-white text-slate-800 truncate">{slot.subject}</span>
                        <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-slate-900 border border-indigo-150 dark:border-indigo-900/40 rounded-lg text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">{slot.day_of_week}</span>
                      </div>
                      <div className="space-y-1 font-semibold text-[10px] text-slate-500">
                        <div className="flex items-center gap-2"><span>⏱</span> <span className="dark:text-slate-350">{slot.time_slot} | {slot.period}</span></div>
                        <div className="flex items-center gap-2"><span>👤</span> <span className="dark:text-slate-350">Teacher: {slot.teacher_name}</span></div>
                        <div className="flex items-center gap-2"><span>🏠</span> <span className="dark:text-slate-350">Room: {slot.room_no || 'R-12'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: INTERACTIVE CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Calendar Grid */}
              <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-4 select-none">
                  <div>
                    <h3 className="text-base font-black dark:text-white text-slate-800">Interactive planner calendar</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Click days to display scheduled notices and deadlines.</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button onClick={handlePrevMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 font-bold hover:bg-slate-200 dark:hover:bg-slate-900 cursor-pointer">←</button>
                    <span className="text-xs font-black uppercase tracking-wider dark:text-slate-200 text-slate-800">
                      {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={handleNextMonth} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-955 border border-slate-200/60 dark:border-slate-850 font-bold hover:bg-slate-200 dark:hover:bg-slate-900 cursor-pointer">→</button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] uppercase text-slate-450 select-none pb-2 border-b border-slate-100 dark:border-slate-850">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span key={d}>{d}</span>)}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {currentMonthDays.map((day, idx) => {
                    if (!day) return <div key={idx} className="aspect-square bg-transparent rounded-2xl" />
                    const isSelected = selectedCalendarDate && day.toDateString() === selectedCalendarDate.toDateString()
                    const isToday = day.toDateString() === new Date().toDateString()
                    const dayEvents = getCalendarDayEvents(day)

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedCalendarDate(day)}
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-between p-1.5 transition border cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow shadow-indigo-600/25' 
                            : isToday
                            ? 'bg-indigo-50 dark:bg-slate-950 border-indigo-400 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400'
                            : 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-200/40 dark:border-slate-900 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                        }`}
                      >
                        <span className="text-[10px] font-black">{day.getDate()}</span>
                        
                        {/* Event indicator dots */}
                        <div className="flex gap-0.5 justify-center flex-wrap max-w-full">
                          {dayEvents.slice(0, 3).map((evt, i) => (
                            <span key={i} className={`w-1.5 h-1.5 rounded-full ${evt.color}`} />
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Calendar Details Side Bar Panel */}
              <div className="lg:col-span-1 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-6">
                <div>
                  <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest">Planner details</h4>
                  <span className="text-xs font-extrabold dark:text-indigo-400 text-indigo-600 block mt-1">
                    {selectedCalendarDate?.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="space-y-4">
                  {selectedCalendarDate ? (
                    (() => {
                      const eventsList = getCalendarDayEvents(selectedCalendarDate)
                      if (eventsList.length === 0) {
                        return <p className="text-xs text-slate-450 italic font-semibold py-8 text-center">No school events or tasks on this day.</p>
                      }
                      return eventsList.map((evt, i) => (
                        <div key={i} className="flex gap-3.5 items-start bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-900 leading-normal">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${evt.color}`} />
                          <div className="space-y-0.5">
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">{evt.type}</span>
                            <span className="text-xs font-extrabold text-slate-850 dark:text-slate-200 block">{evt.title}</span>
                          </div>
                        </div>
                      ))
                    })()
                  ) : (
                    <p className="text-xs text-slate-450 italic font-semibold py-8 text-center">Select any calendar date to display schedules.</p>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 8: ANNOUNCEMENTS */}
          {activeTab === 'circulars' && (
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 text-left space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h3 className="text-lg font-black dark:text-white text-slate-800">Notice board circulars</h3>
                <p className="text-xs text-slate-450 mt-1 font-semibold">Official announcements, school circulars, and event logs.</p>
              </div>

              {filteredCirculars.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-slate-250 dark:border-slate-850 rounded-2xl text-center text-xs text-slate-500 italic">
                  Notice board circular ledger is empty.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCirculars.map(c => (
                    <div key={c.id} className="bg-slate-50 dark:bg-slate-950/45 border border-slate-200/50 dark:border-slate-900 rounded-3xl p-5 text-left space-y-3 relative overflow-hidden transition hover:border-slate-350 dark:hover:border-slate-800">
                      {c.is_important && (
                        <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500/15 text-rose-500 border-l border-b border-rose-900/30 text-[9px] font-black uppercase tracking-widest">
                          IMPORTANT NOTICE
                        </div>
                      )}
                      <div className="flex items-center gap-3.5">
                        <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-slate-900 text-indigo-650 dark:text-indigo-400 text-[8px] font-black uppercase rounded-lg border border-indigo-150 dark:border-indigo-900/35">
                          {c.category}
                        </span>
                        <span className="text-[9px] font-bold text-slate-450">{c.published_date}</span>
                      </div>
                      <h4 className="text-sm font-extrabold dark:text-white text-slate-800 leading-snug">{c.title}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 9: MESSAGES CHATS */}
          {activeTab === 'messages' && (
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-855 rounded-3xl p-6 text-left h-[550px] flex flex-col justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="border-b border-slate-100 dark:border-slate-850 pb-3 flex items-center justify-between select-none">
                <div>
                  <h3 className="text-base font-black dark:text-white text-slate-800">Direct Message Workspace</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Contact Class Teacher: {metadata.classTeacherName}</p>
                </div>
                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Class Teacher Active
                </span>
              </div>

              {/* Chat Thread */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto my-4 space-y-4 pr-1 scrollbar-none">
                {messages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-16 italic font-semibold">Send a message to class teacher to start conversation.</p>
                ) : (
                  messages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[75%] transition-all ${
                        msg.sender_type === 'parent' ? 'ml-auto items-end animate-in slide-in-from-right-2' : 'mr-auto items-start animate-in slide-in-from-left-2'
                      }`}
                    >
                      <span className="text-[9px] text-slate-450 font-bold mb-1 pl-1 pr-1">
                        {msg.sender_type === 'parent' ? 'You' : msg.teacher_name}
                      </span>
                      <div className={`p-3.5 rounded-3xl text-xs font-semibold leading-relaxed ${
                        msg.sender_type === 'parent' 
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow shadow-indigo-600/10' 
                          : 'bg-slate-100 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-900 text-slate-800 dark:text-slate-250 rounded-tl-none'
                      }`}>
                        {msg.message}
                      </div>
                      <span className="text-[8px] text-slate-500 font-bold mt-1 pl-1 pr-1">
                        {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Send Chat Form */}
              <form onSubmit={handleSendMessage} className="flex gap-2.5 border-t border-slate-100 dark:border-slate-850 pt-4 select-none">
                <input
                  type="text"
                  placeholder="Type message to teacher..."
                  className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-900 rounded-2xl px-4 py-3 text-xs dark:text-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={sendingMsg || !newMessage.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-2xl transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {sendingMsg ? '...' : 'Send'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 10: LEAVE REQUESTS */}
          {activeTab === 'leaves' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Apply Leave request form */}
              <div className="lg:col-span-1 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 space-y-5 text-left">
                <div>
                  <h3 className="text-base font-black dark:text-white text-slate-800">Apply for leave absence</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">Submit absence leave certificates to school admin.</p>
                </div>

                <form onSubmit={handleSubmitLeave} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">Start Date</label>
                    <input
                      type="date"
                      className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl px-4 py-3 text-xs dark:text-white font-bold outline-none"
                      value={leaveStart}
                      onChange={(e) => setLeaveStart(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">End Date</label>
                    <input
                      type="date"
                      className="w-full bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-900 rounded-2xl px-4 py-3 text-xs dark:text-white font-bold outline-none"
                      value={leaveEnd}
                      onChange={(e) => setLeaveEnd(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">Reason for Absence</label>
                    <textarea
                      placeholder="e.g. down with viral fever, attending sibling wedding..."
                      rows={3}
                      className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl px-4 py-3 text-xs dark:text-white font-medium outline-none resize-none"
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingLeave}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl shadow transition active:scale-95 disabled:opacity-60 cursor-pointer text-center w-full"
                  >
                    {submittingLeave ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>
              </div>

              {/* Leave requests history table */}
              <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-855 rounded-3xl p-6 space-y-4 text-left">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest select-none">Absence leave log history</h4>
                
                {leaveRequests.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-8 text-center font-semibold">No previous leave requests submitted.</p>
                ) : (
                  <div className="space-y-3.5">
                    {leaveRequests.map(leave => (
                      <div key={leave.id} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-900 rounded-3xl p-4.5 flex items-center justify-between">
                        <div className="text-left space-y-1.5">
                          <strong className="text-xs font-extrabold dark:text-slate-200 text-slate-800 block">Reason: {leave.reason}</strong>
                          <span className="text-[10px] text-slate-450 font-bold block">Period: {leave.start_date} to {leave.end_date}</span>
                        </div>
                        <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg border tracking-widest ${
                          leave.status === 'Approved' 
                            ? 'bg-emerald-950/45 border-emerald-900 text-emerald-400' 
                            : leave.status === 'Rejected' 
                            ? 'bg-rose-950/45 border-rose-900 text-rose-500' 
                            : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {leave.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 11: DOCUMENTS VAULT */}
          {activeTab === 'documents' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Document upload box */}
              <div className="lg:col-span-1 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 space-y-5 text-left select-none">
                <div>
                  <h3 className="text-base font-black dark:text-white text-slate-800">Upload school documents</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">Store medical certificates, transfer credentials, or ID proofs.</p>
                </div>

                <div className="border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 hover:bg-slate-100 dark:hover:bg-slate-950 transition duration-300 relative group">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={documentUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="text-3xl">📥</div>
                  <div className="space-y-1">
                    <span className="text-xs font-black dark:text-slate-350 text-slate-700 block">Drag files here or click to browse</span>
                    <span className="text-[9px] text-slate-400 font-bold block">Support files: PDF, JPG (Max 5MB)</span>
                  </div>
                  {documentUploading && (
                    <div className="absolute inset-0 bg-white/90 dark:bg-slate-955/90 rounded-3xl flex items-center justify-center p-4">
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 animate-pulse">Uploading file to storage...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents ledger list */}
              <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-855 rounded-3xl p-6 space-y-4 text-left">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Verified document ledger vault</h4>
                
                {documents.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-slate-250 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-500 italic space-y-2">
                    <p>No document files uploaded yet.</p>
                    <p className="text-[10px] text-slate-400">Upload Birth Certificate or Aadhaar proof to start.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map(doc => (
                      <div key={doc.id} className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-900 rounded-3xl p-4.5 flex items-center justify-between">
                        <div className="text-left space-y-1 flex items-center gap-3.5">
                          <span className="text-xl">📄</span>
                          <div>
                            <strong className="text-xs font-extrabold dark:text-slate-200 text-slate-800 block truncate max-w-xs sm:max-w-sm">
                              {doc.file_url.split('/').pop()}
                            </strong>
                            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Format: {doc.document_type} | Uploaded: {new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <a 
                          href={doc.file_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="bg-slate-200 dark:bg-slate-900 hover:bg-slate-300 dark:hover:bg-slate-800 dark:text-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl transition cursor-pointer"
                        >
                          View File
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 12: ACHIEVEMENTS & STREAKS */}
          {activeTab === 'achievements' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
              
              {/* Header section with streak highlight */}
              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 rounded-3xl p-6 sm:p-8 text-white border border-yellow-450 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-1.5 leading-normal">
                  <span className="text-[10px] font-black uppercase text-amber-100 tracking-widest block">Gamified Achievements</span>
                  <h3 className="text-2xl font-extrabold tracking-tight">Student streaks & honor badges</h3>
                  <p className="text-xs text-amber-50 font-semibold max-w-md">Maintain streaks in attendance and task submissions to unlock new class badges.</p>
                </div>
                <div className="flex gap-4 shrink-0 font-bold">
                  <div className="bg-white/15 p-4 rounded-2xl text-center">
                    <span className="text-2xl block">🔥</span>
                    <span className="text-sm font-black block mt-1">{attendanceStreak} Days Present</span>
                  </div>
                  <div className="bg-white/15 p-4 rounded-2xl text-center">
                    <span className="text-2xl block">⚡</span>
                    <span className="text-sm font-black block mt-1">{homeworkStreak} Hw Streak</span>
                  </div>
                </div>
              </div>

              {/* Achievements Badges Grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest select-none">Unlocked Badges</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 select-none font-bold text-center">
                  
                  <div className="bg-white/85 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 p-6 rounded-3xl space-y-3 flex flex-col items-center justify-center shadow">
                    <span className="text-4xl filter drop-shadow">🔥</span>
                    <div className="space-y-1">
                      <h5 className="text-xs font-black dark:text-white text-slate-800">Perfect Attendance Streak</h5>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">Attended school for 10 consecutive days without missing.</p>
                    </div>
                  </div>

                  <div className="bg-white/85 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 p-6 rounded-3xl space-y-3 flex flex-col items-center justify-center shadow">
                    <span className="text-4xl filter drop-shadow">⚡</span>
                    <div className="space-y-1">
                      <h5 className="text-xs font-black dark:text-white text-slate-800">Homework Champion</h5>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">Submitted 5 homework sheets back-to-back on time.</p>
                    </div>
                  </div>

                  <div className="bg-white/85 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 p-6 rounded-3xl space-y-3 flex flex-col items-center justify-center shadow">
                    <span className="text-4xl filter drop-shadow">🎓</span>
                    <div className="space-y-1">
                      <h5 className="text-xs font-black dark:text-white text-slate-800">Academic Excellence</h5>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">Maintained an A+ grade average across all tests.</p>
                    </div>
                  </div>

                  <div className="bg-white/85 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 p-6 rounded-3xl space-y-3 flex flex-col items-center justify-center shadow">
                    <span className="text-4xl filter drop-shadow">🏆</span>
                    <div className="space-y-1">
                      <h5 className="text-xs font-black dark:text-white text-slate-800">Coding Prodigy</h5>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">Scored 100% on the Python loops exam ledger.</p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 13: STUDENT PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
              
              {/* Premium student profile card */}
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden shadow-lg leading-normal">
                {/* Photo upload input box */}
                <div className="relative group shrink-0 select-none">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-violet-200 to-indigo-200 text-indigo-700 flex items-center justify-center font-black text-xl border border-indigo-200/50 shadow-md overflow-hidden relative">
                    {metadata.avatarUrl ? (
                      <img src={metadata.avatarUrl} alt={activeChild.full_name} className="object-cover w-full h-full" />
                    ) : (
                      activeChild.full_name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <label className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 rounded-3xl flex items-center justify-center text-[10px] font-black text-white uppercase tracking-wider cursor-pointer transition select-none">
                    Upload
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                </div>

                <div className="space-y-3.5 flex-1 w-full md:w-auto">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Class Roster Profile</span>
                    <h3 className="text-xl font-extrabold dark:text-white text-slate-800">{activeChild.full_name}</h3>
                    <p className="text-xs text-slate-400 font-semibold uppercase">Admission UID: {metadata.admissionNo}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span className="bg-slate-100 dark:bg-slate-950 px-3 py-1 rounded-full border border-slate-200/40 dark:border-slate-900 block w-fit">House: {metadata.house}</span>
                    <span className="bg-slate-100 dark:bg-slate-955 px-3 py-1 rounded-full border border-slate-200/40 dark:border-slate-900 block w-fit">Blood Group: {metadata.bloodGroup}</span>
                  </div>
                </div>

                <button 
                  onClick={() => setIsEditProfileOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-2xl shadow-md transition active:scale-95 cursor-pointer self-start md:self-auto"
                >
                  Quick Edit Profile
                </button>
              </div>

              {/* Student Metadata Information Record */}
              <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 space-y-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-855 pb-3 select-none">Student Information details</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs leading-normal">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Full Student Name</span>
                    <span className="dark:text-white text-slate-800 font-bold text-sm block">{activeChild.full_name}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Roll Number / Class UID</span>
                    <span className="dark:text-white text-slate-800 font-bold text-sm block">{metadata.rollNumber}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Grade Class Section</span>
                    <span className="dark:text-white text-slate-800 font-bold text-sm block">{activeChild.class_name} - Section {metadata.section}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Date of Birth</span>
                    <span className="dark:text-white text-slate-800 font-bold text-sm block">{activeChild.date_of_birth}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Admission Date</span>
                    <span className="dark:text-white text-slate-800 font-bold text-sm block">{activeChild.admission_date}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Registered Parent Contact</span>
                    <span className="dark:text-white text-slate-800 font-bold text-sm block">{activeChild.parent_name} ({activeChild.parent_phone})</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Class Room Teacher</span>
                    <span className="dark:text-white text-slate-800 font-bold text-sm block">{metadata.classTeacherName} ({metadata.classTeacherPhone})</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-450 font-bold block uppercase tracking-wider text-[9px]">Transport Bus Route</span>
                    <span className="dark:text-white text-slate-800 font-bold text-sm block">{metadata.emergencyPhone === '+91 98765 43211' ? 'Route 10A - Greenwood Bus' : 'Self Commute'}</span>
                  </div>

                  <div className="space-y-1 sm:col-span-2 border-t border-slate-100 dark:border-slate-850 pt-5">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Residential Address</span>
                    <span className="dark:text-white text-slate-800 font-semibold text-xs block leading-relaxed">{activeChild.address}</span>
                  </div>
                </div>
              </div>

              {/* Remarks logs panel */}
              {remarks.length > 0 && (
                <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-850 rounded-3xl p-6 space-y-4 text-left">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-850 pb-3 select-none">Academic coordinates reviews</h4>
                  <div className="space-y-4">
                    {remarks.map(rem => (
                      <div key={rem.id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-250/50 dark:border-slate-900 space-y-1.5 leading-normal">
                        <p className="text-xs font-medium dark:text-slate-200 text-slate-800">"{rem.text}"</p>
                        <span className="text-[9px] text-slate-450 font-bold block text-right">By {rem.author} on {rem.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      </div>

      {/* SECURISED STRIPE CHECKOUT SIMULATOR MODAL */}
      {isCheckoutOpen && selectedFee && (
        <div className="fixed inset-0 z-55 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-left font-sans">
            <div className="space-y-1.5">
              <h3 className="text-base font-black dark:text-white text-slate-900 flex items-center gap-2">Stripe checkout</h3>
              <p className="text-[11px] text-slate-450 font-bold">
                Payments are securely processed and encrypted.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-955/80 p-4 border border-slate-200 dark:border-slate-850 rounded-2xl space-y-2.5 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-450">Invoice billing:</span>
                <span className="dark:text-white text-slate-800">{selectedFee.month}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-900 pt-2.5 mt-2 font-bold text-sm">
                <span className="text-slate-450">Total Amount:</span>
                <span className="text-indigo-600 dark:text-indigo-400">₹{selectedFee.amount}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">Card Number</label>
                <input 
                  type="text" 
                  disabled
                  value="•••• •••• •••• 4242"
                  className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 text-slate-450 font-bold text-xs rounded-xl px-3 py-2.5 cursor-not-allowed outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">Exp Date</label>
                  <input 
                    type="text" 
                    disabled
                    value="12 / 29"
                    className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 text-slate-450 font-bold text-xs rounded-xl px-3 py-2.5 cursor-not-allowed text-center outline-none" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-455 uppercase tracking-widest pl-0.5">CVV</label>
                  <input 
                    type="text" 
                    disabled
                    value="•••"
                    className="w-full bg-slate-55 dark:bg-slate-955 border border-slate-200 dark:border-slate-855 text-slate-450 font-bold text-xs rounded-xl px-3 py-2.5 cursor-not-allowed text-center outline-none" 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 select-none">
              <button
                onClick={handlePayFeeSimulate}
                disabled={paymentLoading}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl transition active:scale-95 cursor-pointer shadow-md"
              >
                {paymentLoading ? 'Processing...' : `Pay ₹${selectedFee.amount}`}
              </button>
              <button
                onClick={() => {
                  setIsCheckoutOpen(false)
                  setSelectedFee(null)
                }}
                className="flex-1 bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOMEWORK CARD DETAILS MODAL POPUP */}
      {isHwModalOpen && selectedHomework && (
        <div className="fixed inset-0 z-55 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-left font-sans leading-normal">
            <div className="flex justify-between items-center select-none">
              <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-50 dark:bg-slate-955 text-indigo-600 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-900/40">
                {selectedHomework.subject_name}
              </span>
              <button 
                onClick={() => { setIsHwModalOpen(false); setSelectedHomework(null) }}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold dark:text-white text-slate-800">{selectedHomework.title}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Issued by: {selectedHomework.teacher_name}</p>
            </div>

            <div className="space-y-3.5">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {selectedHomework.description}
              </p>
              
              <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200/50 dark:border-slate-850 rounded-2xl text-[10px] sm:text-xs font-semibold grid grid-cols-2 gap-3.5 select-none">
                <div>
                  <span className="text-slate-400 block uppercase text-[8px] font-black">Due Date</span>
                  <span className="dark:text-white text-slate-800 font-bold block mt-0.5">{selectedHomework.due_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase text-[8px] font-black">Max Score Weight</span>
                  <span className="dark:text-white text-slate-800 font-bold block mt-0.5">{selectedHomework.max_marks} marks</span>
                </div>
              </div>
            </div>

            {/* Attachments Section */}
            {(selectedHomework.pdf_url || selectedHomework.video_url) && (
              <div className="space-y-2 select-none">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Reference Attachments</span>
                <div className="flex gap-2">
                  {selectedHomework.pdf_url && (
                    <a 
                      href={selectedHomework.pdf_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl px-4 py-2.5 text-[10px] font-bold text-rose-500 hover:underline inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      📄 PDF Homework Worksheet
                    </a>
                  )}
                  {selectedHomework.video_url && (
                    <a 
                      href={selectedHomework.video_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl px-4 py-2.5 text-[10px] font-bold text-violet-500 hover:underline inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      🎥 Explanation Lesson Video
                    </a>
                  )}
                </div>
              </div>
            )}

            <button 
              onClick={() => { setIsHwModalOpen(false); setSelectedHomework(null); showToast('Homework tasks opened in sandbox!') }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl shadow transition active:scale-95 cursor-pointer text-center w-full block select-none"
            >
              Start homework sheet
            </button>
          </div>
        </div>
      )}

      {/* QUICK PROFILE METADATA EDIT MODAL POPUP */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-55 bg-slate-955/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-left font-sans leading-normal">
            <div className="flex justify-between items-center select-none">
              <h3 className="text-base font-black dark:text-white text-slate-800">Quick Edit Student Details</h3>
              <button 
                onClick={() => setIsEditProfileOpen(false)}
                className="text-slate-405 hover:text-slate-600 font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfileEdit} className="space-y-4 overflow-y-auto max-h-[400px] pr-1.5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block pl-0.5">Blood Group</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-3 py-2 text-xs dark:text-white font-semibold outline-none"
                  value={profileForm.bloodGroup || ''}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, bloodGroup: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block pl-0.5">House Group</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-3 py-2 text-xs dark:text-white font-semibold outline-none"
                  value={profileForm.house || ''}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, house: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block pl-0.5">Allergies</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-3 py-2 text-xs dark:text-white font-semibold outline-none"
                  value={profileForm.allergies || ''}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, allergies: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block pl-0.5">Chronic Medical Conditions</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-905 rounded-xl px-3 py-2 text-xs dark:text-white font-semibold outline-none"
                  value={profileForm.conditions || ''}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, conditions: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block pl-0.5">Emergency Contact Guardian Name</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-905 rounded-xl px-3 py-2 text-xs dark:text-white font-semibold outline-none"
                  value={profileForm.emergencyName || ''}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, emergencyName: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block pl-0.5">Emergency Contact Phone</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-905 rounded-xl px-3 py-2 text-xs dark:text-white font-semibold outline-none"
                  value={profileForm.emergencyPhone || ''}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block pl-0.5">Previous School Details</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-905 rounded-xl px-3 py-2 text-xs dark:text-white font-semibold outline-none"
                  value={profileForm.previousSchool || ''}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, previousSchool: e.target.value }))}
                />
              </div>
            </form>

            <div className="flex gap-2.5 select-none">
              <button
                onClick={handleSaveProfileEdit}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl transition active:scale-95 cursor-pointer shadow-md text-center"
              >
                Save Details
              </button>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="flex-1 bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
