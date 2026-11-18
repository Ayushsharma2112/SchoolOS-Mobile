'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { useSchool } from '../../../lib/SchoolContext'

type StudentRow = {
  id: string
  full_name: string
  parent_name: string
  parent_phone: string
  class_name: string
  gender: string
  date_of_birth: string
  admission_date: string
  address: string
  created_at: string
}

type StudentMetadata = {
  rollNumber?: string
  section?: string
  status?: 'Active' | 'Suspended' | 'Archived' | 'Promoted' | 'Transferred'
  bloodGroup?: string
  allergies?: string
  conditions?: string
  vaccinationStatus?: string
  heightWeight?: string
  emergencyName?: string
  emergencyRelation?: string
  emergencyPhone?: string
}

export default function StudentsPage() {
  const { schoolId, subscription } = useSchool()

  // Form input states
  const [fullName, setFullName] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [className, setClassName] = useState('')
  const [gender, setGender] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [admissionDate, setAdmissionDate] = useState('')
  const [address, setAddress] = useState('')
  
  // Extra fields in add form
  const [section, setSection] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [status, setStatus] = useState<'Active' | 'Suspended' | 'Archived'>('Active')

  // Financial fields in add form
  const [admissionFeeAmount, setAdmissionFeeAmount] = useState('')
  const [admissionFeeStatus, setAdmissionFeeStatus] = useState('unpaid')

  // State lists
  const [students, setStudents] = useState<StudentRow[]>([])
  const [studentsExt, setStudentsExt] = useState<Record<string, StudentMetadata>>({})
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [teacherClasses, setTeacherClasses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Interactive controls
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBulkPromoteOpen, setIsBulkPromoteOpen] = useState(false)
  const [isBulkTransferOpen, setIsBulkTransferOpen] = useState(false)
  
  // Selection states (Bulk Actions)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Bulk target options
  const [bulkTargetClass, setBulkTargetClass] = useState('')
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Search & Filter controls
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [selectedGender, setSelectedGender] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  
  // Sorting controls
  const [sortBy, setSortBy] = useState<string>('name-asc')
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Export & Action indicators
  const [isExporting, setIsExporting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load student extension metadata from localStorage
  const loadExtensions = (studentList: StudentRow[]) => {
    const extMap: Record<string, StudentMetadata> = {}
    studentList.forEach(s => {
      const stored = localStorage.getItem(`schoolos_student_ext_${s.id}`)
      if (stored) {
        try {
          extMap[s.id] = JSON.parse(stored)
        } catch (e) {
          console.error('Failed to parse metadata for student:', s.id, e)
        }
      } else {
        // Build a mock default extension for demo completeness
        const demoExt: StudentMetadata = {
          rollNumber: String(Math.floor(Math.random() * 40) + 1).padStart(2, '0'),
          section: Math.random() > 0.5 ? 'A' : 'B',
          status: 'Active'
        }
        localStorage.setItem(`schoolos_student_ext_${s.id}`, JSON.stringify(demoExt))
        extMap[s.id] = demoExt
      }
    })
    setStudentsExt(extMap)
  }

  // Fetch Directory Students
  async function fetchStudents(isTeacherRole = userRole === 'Teacher', classes = teacherClasses) {
    if (!schoolId) return
    try {
      setLoading(true)
      let query = supabase.from('students').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
      if (isTeacherRole) {
        if (classes.length > 0) {
          query = query.in('class_name', classes)
        } else {
          setStudents([])
          setLoading(false)
          return
        }
      }
      const { data, error } = await query

      if (error) {
        console.error('Error fetching students:', error)
      } else {
        const studentList = data || []
        setStudents(studentList)
        loadExtensions(studentList)
      }
    } catch (err) {
      console.error('Students fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch configured Classes list
  async function fetchClasses(isTeacherRole = userRole === 'Teacher', classes = teacherClasses) {
    if (!schoolId) return
    try {
      let query = supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name', { ascending: true })
      if (isTeacherRole && classes.length > 0) {
        query = query.in('name', classes)
      }
      const { data, error } = await query
      if (!error && data) {
        setClassesList(data)
      }
    } catch (e) {
      console.error('Failed to fetch classes:', e)
    }
  }

  // Seeding initialization
  useEffect(() => {
    if (!schoolId) return

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let isTeacher = false
        let classes: string[] = []

        if (session?.user) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('id, role')
            .eq('user_id', session.user.id)
            .eq('school_id', schoolId)
            .maybeSingle()

          if (staffData) {
            setUserRole(staffData.role)
            if (staffData.role === 'Teacher') {
              isTeacher = true
              const { data: classData } = await supabase
                .from('teacher_classes')
                .select('classes(name)')
                .eq('teacher_id', staffData.id)

              if (classData) {
                classes = classData.map((c: any) => c.classes?.name).filter(Boolean)
                setTeacherClasses(classes)
              }
            }
          }
        }

        await fetchStudents(isTeacher, classes)
        await fetchClasses(isTeacher, classes)
      } catch (err) {
        console.error('Initialization directory error:', err)
        await fetchStudents(false, [])
        await fetchClasses(false, [])
      }
    }
    void init()
  }, [schoolId])

  // Single Add student execution
  async function handleAddStudent() {
    if (!fullName || !className) {
      alert('Student name and class are required.')
      return
    }
    if (!schoolId) {
      alert('No active school space selected.')
      return
    }

    // Validate active SaaS subscription and limits
    if (subscription) {
      if (subscription.status === 'expired' || subscription.status === 'suspended') {
        alert('Your active school subscription has expired or is suspended. Please renew to continue.')
        return
      }
      if (subscription.status === 'grace_period') {
        alert('New student registrations are locked during the subscription grace period. Please renew to proceed.')
        return
      }
      if (students.length >= subscription.max_students) {
        alert(`Plan Limit Exceeded: Your current plan '${subscription.plan_name}' only permits up to ${subscription.max_students} students. Please upgrade your subscription plan to admit more students.`)
        return
      }
    }

    try {
      const { data: newStudent, error } = await supabase
        .from('students')
        .insert([
          {
            school_id: schoolId,
            full_name: fullName,
            parent_name: parentName || null,
            parent_phone: parentPhone || null,
            class_name: className,
            gender: gender || null,
            date_of_birth: dateOfBirth || null,
            admission_date: admissionDate || null,
            address: address || null
          }
        ])
        .select()
        .single()

      if (error) {
        alert(error.message)
        return
      }

      if (newStudent) {
        // Save additional fields into localStorage extension map
        const ext: StudentMetadata = {
          rollNumber: rollNumber || String(Math.floor(Math.random() * 40) + 1).padStart(2, '0'),
          section: section || 'A',
          status: status || 'Active'
        }
        localStorage.setItem(`schoolos_student_ext_${newStudent.id}`, JSON.stringify(ext))

        // Create initial fee if specified
        if (admissionFeeAmount) {
          const amt = Number(admissionFeeAmount)
          if (!isNaN(amt) && amt > 0) {
            await supabase
              .from('fees')
              .insert({
                student_id: newStudent.id,
                school_id: schoolId,
                amount: amt,
                status: admissionFeeStatus === 'paid' ? 'paid' : 'unpaid',
                month: 'Admission Fee'
              })
          }
        }

        showToast(`${fullName} successfully registered!`, 'success')
        fetchStudents()
        
        // Reset state
        setFullName('')
        setParentName('')
        setParentPhone('')
        setClassName('')
        setGender('')
        setDateOfBirth('')
        setAdmissionDate('')
        setAddress('')
        setSection('')
        setRollNumber('')
        setStatus('Active')
        setAdmissionFeeAmount('')
        setAdmissionFeeStatus('unpaid')
        setIsModalOpen(false)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // CSV Directory Export
  async function exportDirectoryReport() {
    if (!schoolId) return
    setIsExporting(true)
    try {
      let query = supabase.from('students').select('*').eq('school_id', schoolId).order('class_name', { ascending: true })
      if (userRole === 'Teacher') {
        if (teacherClasses.length > 0) {
          query = query.in('class_name', teacherClasses)
        } else {
          setIsExporting(false)
          return
        }
      }
      const { data: allStudents } = await query
      if (!allStudents) return

      const csvRows = []
      csvRows.push('Student ID,Roll Number,Section,Full Name,Class,Gender,Date of Birth,Admission Date,Parent Name,Parent Phone,Address,Status')

      allStudents.forEach(st => {
        const ext = JSON.parse(localStorage.getItem(`schoolos_student_ext_${st.id}`) || '{}')
        const esc = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`

        csvRows.push([
          esc(st.id),
          esc(ext.rollNumber || '-'),
          esc(ext.section || '-'),
          esc(st.full_name),
          esc(st.class_name),
          esc(st.gender),
          esc(st.date_of_birth),
          esc(st.admission_date),
          esc(st.parent_name),
          esc(st.parent_phone),
          esc(st.address),
          esc(ext.status || 'Active')
        ].join(','))
      })

      const csvContent = csvRows.join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `schoolos_students_directory_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('Directory report exported successfully!', 'success')
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  // Bulk Actions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const visibleIds = paginatedStudents.map(s => s.id)
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])))
    } else {
      const visibleIds = paginatedStudents.map(s => s.id)
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)))
    }
  }

  const handleSelectStudent = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id))
    }
  }

  // Bulk Promote Executions (Increments class grade by 1)
  const handleBulkPromote = async () => {
    if (selectedIds.length === 0) return
    setBulkActionLoading(true)
    try {
      let succeeded = 0
      for (const id of selectedIds) {
        const student = students.find(s => s.id === id)
        if (!student) continue
        const numVal = parseInt(student.class_name)
        const nextClass = isNaN(numVal) ? student.class_name : String(numVal + 1)

        const { error } = await supabase
          .from('students')
          .update({ class_name: nextClass })
          .eq('id', id)

        if (!error) {
          succeeded++
          // Update status in metadata
          const ext = JSON.parse(localStorage.getItem(`schoolos_student_ext_${id}`) || '{}')
          localStorage.setItem(`schoolos_student_ext_${id}`, JSON.stringify({ ...ext, status: 'Promoted' }))
        }
      }
      showToast(`Successfully promoted ${succeeded} students!`, 'success')
      setSelectedIds([])
      setIsBulkPromoteOpen(false)
      fetchStudents()
    } catch (e) {
      console.error(e)
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Bulk Transfer Executions (Transfers selected to chosen class/section)
  const handleBulkTransfer = async () => {
    if (selectedIds.length === 0 || !bulkTargetClass) return
    setBulkActionLoading(true)
    try {
      const { error } = await supabase
        .from('students')
        .update({ class_name: bulkTargetClass })
        .in('id', selectedIds)

      if (!error) {
        selectedIds.forEach(id => {
          const ext = JSON.parse(localStorage.getItem(`schoolos_student_ext_${id}`) || '{}')
          localStorage.setItem(`schoolos_student_ext_${id}`, JSON.stringify({ ...ext, status: 'Transferred' }))
        })
        showToast(`Successfully transferred ${selectedIds.length} students to Class ${bulkTargetClass}!`, 'success')
        setSelectedIds([])
        setBulkTargetClass('')
        setIsBulkTransferOpen(false)
        fetchStudents()
      } else {
        alert(error.message)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Bulk Archive execution
  const handleBulkArchive = () => {
    if (selectedIds.length === 0) return
    selectedIds.forEach(id => {
      const ext = JSON.parse(localStorage.getItem(`schoolos_student_ext_${id}`) || '{}')
      localStorage.setItem(`schoolos_student_ext_${id}`, JSON.stringify({ ...ext, status: 'Archived' }))
    })
    showToast(`Archived ${selectedIds.length} students locally!`, 'info')
    setSelectedIds([])
    fetchStudents()
  }

  // Bulk Delete execution
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Are you absolutely sure you want to delete ${selectedIds.length} selected students? All attendance, fees and document logs will be permanently erased.`)) return
    
    setBulkActionLoading(true)
    try {
      // 1. Delete dependent logs
      await supabase.from('attendance').delete().in('student_id', selectedIds)
      await supabase.from('fees').delete().in('student_id', selectedIds)
      await supabase.from('documents').delete().in('student_id', selectedIds)

      // 2. Delete student profiles
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', selectedIds)

      if (!error) {
        selectedIds.forEach(id => {
          localStorage.removeItem(`schoolos_student_ext_${id}`)
          localStorage.removeItem(`edumanage_fees_${id}`)
        })
        showToast(`Successfully deleted ${selectedIds.length} students.`, 'success')
        setSelectedIds([])
        fetchStudents()
      } else {
        alert(error.message)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Classes list values
  const availableClasses = useMemo(() => {
    const dbNames = classesList.map(c => c.name)
    const studentNames = students.map(s => s.class_name).filter(Boolean)
    return Array.from(new Set([...dbNames, ...studentNames])).sort()
  }, [classesList, students])

  // Search & Filter students list
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => {
        const ext = studentsExt[s.id] || {}
        const matchesSearch = 
          s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.parent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.parent_phone?.includes(searchTerm)
        
        const matchesClass = selectedClass === 'all' || s.class_name === selectedClass
        const matchesGender = selectedGender === 'all' || s.gender === selectedGender
        const matchesStatus = selectedStatus === 'all' || (ext.status || 'Active') === selectedStatus

        return matchesSearch && matchesClass && matchesGender && matchesStatus
      })
      .sort((a, b) => {
        const extA = studentsExt[a.id] || {}
        const extB = studentsExt[b.id] || {}
        
        if (sortBy === 'name-asc') return a.full_name.localeCompare(b.full_name)
        if (sortBy === 'name-desc') return b.full_name.localeCompare(a.full_name)
        if (sortBy === 'roll-asc') return (extA.rollNumber || '').localeCompare(extB.rollNumber || '')
        if (sortBy === 'roll-desc') return (extB.rollNumber || '').localeCompare(extA.rollNumber || '')
        if (sortBy === 'date-latest') return (b.admission_date || b.created_at).localeCompare(a.admission_date || a.created_at)
        if (sortBy === 'date-oldest') return (a.admission_date || a.created_at).localeCompare(b.admission_date || b.created_at)
        return 0
      })
  }, [students, studentsExt, searchTerm, selectedClass, selectedGender, selectedStatus, sortBy])

  // Pagination calculation
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const paginatedStudents = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage
    return filteredStudents.slice(startIdx, startIdx + itemsPerPage)
  }, [filteredStudents, currentPage])

  // Checkbox select all status
  const isAllSelected = useMemo(() => {
    if (paginatedStudents.length === 0) return false
    return paginatedStudents.every(s => selectedIds.includes(s.id))
  }, [paginatedStudents, selectedIds])

  // Human student index key
  const studentIdMap = useMemo(() => {
    const sorted = [...students].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
      if (timeA !== timeB) return timeA - timeB
      return a.id.localeCompare(b.id)
    })
    const map = new Map<string, string>()
    sorted.forEach((s, idx) => {
      map.set(s.id, `Stu-${idx + 1}`)
    })
    return map
  }, [students])

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-slate-800">
      
      {/* Header and Quick Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Student Directory</h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold">Manage student academic status, roll call sheets, and details.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportDirectoryReport}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-2xl font-bold text-xs shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition active:scale-95 disabled:opacity-50 cursor-pointer select-none"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isExporting ? 'Exporting...' : 'Export Directory'}
          </button>

          <Link
            href="/students/smart-register"
            className="flex items-center justify-center gap-2 bg-gradient-to-tr from-violet-600 to-indigo-650 hover:from-violet-700 hover:to-indigo-700 text-white px-4.5 py-2.5 rounded-2xl font-bold text-xs shadow-md shadow-indigo-500/10 hover:shadow-lg active:scale-95 transition cursor-pointer select-none"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            ✨ AI Import Center
          </Link>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2.5 rounded-2xl font-bold text-xs shadow-md shadow-indigo-500/10 hover:shadow-lg active:scale-95 transition cursor-pointer select-none"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            Add Student
          </button>
        </div>
      </div>

      {/* Directory filters bar */}
      <div className="bg-white border border-slate-200/50 rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Search bar */}
          <div className="relative flex-1 lg:col-span-2">
            <input
              type="text"
              placeholder="Search by name, ID, parent name..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-2xl bg-white placeholder-slate-400 text-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-[#4f46e5] transition-all"
            />
            <svg className="absolute left-3.5 top-3.5 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-600 cursor-pointer outline-none"
            >
              <option value="all">All Classes</option>
              {availableClasses.map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>

          {/* Gender Filter */}
          <div>
            <select
              value={selectedGender}
              onChange={(e) => { setSelectedGender(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-600 cursor-pointer outline-none"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-600 cursor-pointer outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Archived">Archived</option>
              <option value="Promoted">Promoted</option>
              <option value="Transferred">Transferred</option>
            </select>
          </div>

        </div>

        {/* Sort & Quick indicators */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-400">
          <div>
            <span>Found {filteredStudents.length} student records</span>
          </div>

          <div className="flex items-center gap-2">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-indigo-600 font-bold border-none outline-none cursor-pointer"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="roll-asc">Roll Number (Asc)</option>
              <option value="roll-desc">Roll Number (Desc)</option>
              <option value="date-latest">Admission Date (Latest)</option>
              <option value="date-oldest">Admission Date (Oldest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Main List (Table with Select Checkboxes) */}
      {loading ? (
        <div className="bg-white border border-slate-200/50 rounded-3xl p-6 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-2xl w-full" />
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white border border-slate-200/50 rounded-3xl p-16 text-center shadow-sm max-w-xl mx-auto border-dashed">
          <div className="mx-auto h-12 w-12 text-indigo-500 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No students match filters</h3>
          <p className="text-slate-400 text-xs font-semibold max-w-xs mx-auto">Try adjusting search term, gender tags, or grade level select filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/50 rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider select-none">
                  <th className="py-4 px-5 w-12">
                    <input 
                      type="checkbox" 
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded text-[#4f46e5] focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-4 px-4">Student ID</th>
                  <th className="py-4 px-4">Roll No</th>
                  <th className="py-4 px-4">Full Name</th>
                  <th className="py-4 px-4">Class</th>
                  <th className="py-4 px-4">Parent Name</th>
                  <th className="py-4 px-4">Parent Phone</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {paginatedStudents.map((student) => {
                  const isChecked = selectedIds.includes(student.id)
                  const ext = studentsExt[student.id] || {}
                  
                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${isChecked ? 'bg-indigo-50/10' : ''}`}
                    >
                      <td className="py-4 px-5">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => handleSelectStudent(student.id, e.target.checked)}
                          className="w-4 h-4 rounded text-[#4f46e5] focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-4 font-black text-slate-400">{studentIdMap.get(student.id) || 'Stu-?'}</td>
                      <td className="py-4 px-4 font-black text-slate-700">{ext.rollNumber || '-'}</td>
                      <td className="py-4 px-4">
                        <Link 
                          href={`/students/${student.id}`}
                          className="font-bold text-slate-800 hover:text-[#4f46e5] transition-colors"
                        >
                          {student.full_name}
                        </Link>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex px-2 py-0.8 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-100/30">
                          Class {student.class_name} {ext.section ? `-${ext.section}` : ''}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-500 font-semibold">{student.parent_name || '-'}</td>
                      <td className="py-4 px-4 text-slate-700 font-bold">{student.parent_phone || '-'}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          (ext.status || 'Active') === 'Active'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/30'
                            : (ext.status || 'Active') === 'Suspended'
                            ? 'bg-rose-50 text-rose-600 border border-rose-100/30'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {ext.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right pr-6">
                        <Link 
                          href={`/students/${student.id}`}
                          className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                        >
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Table pagination footer */}
          {totalPages > 1 && (
            <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-4 flex items-center justify-between font-sans shrink-0">
              <span className="text-xs font-semibold text-slate-400 select-none">
                Showing {Math.min(filteredStudents.length, (currentPage - 1) * itemsPerPage + 1)} to{' '}
                {Math.min(filteredStudents.length, currentPage * itemsPerPage)} of {filteredStudents.length} students
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-600 font-bold text-[10px] transition active:scale-95 disabled:opacity-50 cursor-pointer select-none"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={`h-7 w-7 text-xs font-black rounded-lg transition-all cursor-pointer ${
                        currentPage === pNum
                          ? 'bg-[#4f46e5] text-white shadow-sm'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {pNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-600 font-bold text-[10px] transition active:scale-95 disabled:opacity-50 cursor-pointer select-none"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Actions Bar (Vercel Style) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 inset-x-6 z-40 flex items-center justify-between max-w-4xl mx-auto bg-slate-900 text-white rounded-3xl p-4.5 shadow-2xl border border-slate-800 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-4">
            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center font-black text-[10px]">
              {selectedIds.length}
            </div>
            <span className="text-xs font-bold tracking-tight">Students selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setIsBulkPromoteOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition cursor-pointer select-none"
            >
              Promote
            </button>
            <button 
              onClick={() => setIsBulkTransferOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition cursor-pointer select-none"
            >
              Transfer
            </button>
            <button 
              onClick={handleBulkArchive}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl transition cursor-pointer select-none"
            >
              Archive
            </button>
            <button 
              onClick={handleBulkDelete}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-bold rounded-xl transition cursor-pointer select-none"
            >
              Delete Profiles
            </button>
            <button 
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-slate-200 text-xs font-bold px-2 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: Add Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl bg-white shadow-2xl rounded-3xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Add New Student</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Student Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-[#4f46e5]"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Class / Grade *</label>
                  <select
                    className="w-full px-3 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer bg-white outline-none"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    required
                  >
                    <option value="">Select class...</option>
                    {availableClasses.map((name) => (
                      <option key={name} value={name}>Class {name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-50">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Section</label>
                  <input
                    type="text"
                    placeholder="e.g. A"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Roll Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 05"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
                  <select
                    className="w-full px-3 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer bg-white outline-none"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Parent/Guardian Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-2"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Parent Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-2"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold bg-white outline-none cursor-pointer"
                  >
                    <option value="">Choose gender...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold outline-none cursor-pointer"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Admission Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold outline-none cursor-pointer"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Home Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Vasant Kunj, New Delhi"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-2"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Admission Fee Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-2"
                    value={admissionFeeAmount}
                    onChange={(e) => setAdmissionFeeAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Admission Fee Billing Status</label>
                  <select
                    value={admissionFeeStatus}
                    onChange={(e) => setAdmissionFeeStatus(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold bg-white outline-none cursor-pointer"
                  >
                    <option value="unpaid">Unpaid / Invoice pending</option>
                    <option value="paid">Paid upfront</option>
                  </select>
                </div>
              </div>

            </div>

            {/* Sticky Footer */}
            <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 justify-end shrink-0 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddStudent}
                className="px-4 py-2.5 text-xs font-bold text-white bg-[#4f46e5] hover:bg-[#4338ca] rounded-xl shadow-md shadow-indigo-500/10 hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                Save Profile
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: Bulk Promote Modal */}
      {isBulkPromoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-white shadow-2xl rounded-3xl border border-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">Promote Selected Students</h3>
              <button 
                onClick={() => setIsBulkPromoteOpen(false)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-xl"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-semibold leading-relaxed">
              This action will promote the <strong>{selectedIds.length}</strong> selected students. Their grade will be incremented by 1 automatically (e.g. Class 1 to Class 2) and their status set to 'Promoted'.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setIsBulkPromoteOpen(false)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkPromote}
                disabled={bulkActionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {bulkActionLoading ? 'Promoting...' : 'Promote Students'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Bulk Transfer Modal */}
      {isBulkTransferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-white shadow-2xl rounded-3xl border border-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">Transfer Selected Students</h3>
              <button 
                onClick={() => setIsBulkTransferOpen(false)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-xl"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Choose Target Class / Section</label>
              <select
                value={bulkTargetClass}
                onChange={(e) => setBulkTargetClass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="">-- Select Class --</option>
                {availableClasses.map(name => (
                  <option key={name} value={name}>Class {name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setIsBulkTransferOpen(false)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkTransfer}
                disabled={bulkActionLoading || !bulkTargetClass}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {bulkActionLoading ? 'Transferring...' : 'Transfer Students'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}