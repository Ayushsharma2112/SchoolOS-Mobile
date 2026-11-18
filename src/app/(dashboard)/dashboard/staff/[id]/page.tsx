'use client'

import { useEffect, useState, useMemo, use } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabase'
import ClientAuth from '../../../ClientAuth'
import { useSchool } from '../../../../../lib/SchoolContext'

type StaffMember = {
  id: string
  school_id: string
  user_id: string | null
  full_name: string
  email: string
  phone: string | null
  role: 'Teacher' | 'Admin' | 'Accountant' | 'Receptionist'
  status: 'Active' | 'Inactive'
  created_at: string
  assigned_classes?: string[]
}

type Params = { id?: string }

type SubjectTeaching = {
  name: string
  details: string
  periods: string
}

type TeacherExt = {
  dob: string
  gender: string
  qualification: string
  experience: string
  joiningDate: string
  department: string
  jobType: string
  employeeId: string
  address: string
  aadhaar: string
  pan: string
  bankAccount: string
  emergencyContactName: string
  emergencyContactRelation: string
  emergencyContactPhone: string
  salary: string
  bankAccountDetails: string
  basicSalary: string
  hra: string
  allowance: string
  paymentMode: string
  lastSalaryPaid: string
  leaves: {
    sickTotal: number
    sickTaken: number
    casualTotal: number
    casualTaken: number
    earnedTotal: number
    earnedTaken: number
    maternityTotal: number
    maternityTaken: number
  }
  leaveLogs: Array<{ id: string; date: string; type: string; days: number; reason: string }>
  salaryLog: Array<{ id: string; month: string; date: string; amount: number; status: string }>
  documents: Array<{ id: string; name: string; type: string; date: string }>
  performance: Array<{ id: string; date: string; evaluator: string; rating: number; note: string }>
  attendance: Record<string, 'present' | 'absent'>
  subjectsTeaching: SubjectTeaching[]
}

function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value)
}

export default function StaffProfilePage({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params)
  const staffId = resolvedParams.id
  const { schoolId, schoolName } = useSchool()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [member, setMember] = useState<StaffMember | null>(null)
  const [classesList, setClassesList] = useState<Array<{ id: string; name: string }>>([])
  
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Tab Selection
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'subjects' | 'timetable' | 'attendance' | 'leaves' | 'documents' | 'salary' | 'performance' | 'activity'>('overview')

  // Metadata extension states
  const [ext, setExt] = useState<TeacherExt>({
    dob: '12 Mar 1990',
    gender: 'Female',
    qualification: 'M.Sc, B.Ed',
    experience: '6 Years',
    joiningDate: '15 Jun 2022',
    department: 'Science',
    jobType: 'Full Time',
    employeeId: '',
    address: '45, Green Park Society, Surat, Gujarat - 395005',
    aadhaar: 'XXXX-XXXX-1234',
    pan: 'ABCDE1234F',
    bankAccount: 'HDFC Bank - 5012 3456 7890',
    emergencyContactName: 'Rajesh Patel',
    emergencyContactRelation: 'Father',
    emergencyContactPhone: '+91 98765 43211',
    salary: '45000',
    bankAccountDetails: 'HDFC Bank - 5012 3456 7890',
    basicSalary: '35000',
    hra: '7000',
    allowance: '3000',
    paymentMode: 'Bank Transfer',
    lastSalaryPaid: '01 May 2025',
    leaves: {
      sickTotal: 10,
      sickTaken: 4,
      casualTotal: 12,
      casualTaken: 4,
      earnedTotal: 15,
      earnedTaken: 3,
      maternityTotal: 90,
      maternityTaken: 0
    },
    leaveLogs: [],
    salaryLog: [],
    documents: [],
    performance: [],
    attendance: {},
    subjectsTeaching: []
  })

  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false)
  const [isAddPerformanceOpen, setIsAddPerformanceOpen] = useState(false)
  const [isAddSalaryOpen, setIsAddSalaryOpen] = useState(false)

  // Form Fields State
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    status: 'Active' as 'Active' | 'Inactive',
    dob: '',
    gender: '',
    qualification: '',
    experience: '',
    department: '',
    jobType: '',
    address: '',
    aadhaar: '',
    pan: '',
    bankAccount: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    basicSalary: '',
    hra: '',
    allowance: ''
  })

  const [leaveForm, setLeaveForm] = useState({
    type: 'Sick',
    days: 1,
    reason: '',
    date: new Date().toISOString().split('T')[0]
  })

  const [perfForm, setPerfForm] = useState({
    evaluator: 'Principal V.K. Bhardwaj',
    rating: 5,
    note: '',
    date: new Date().toISOString().split('T')[0]
  })

  const [salaryForm, setSalaryForm] = useState({
    month: 'July 2026',
    amount: 45000,
    status: 'Paid',
    date: new Date().toISOString().split('T')[0]
  })

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null)
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load staff profile & local extension metadata
  async function loadProfile() {
    if (!staffId || !schoolId) return
    try {
      setLoading(true)
      setErrorMsg(null)

      // 1. Fetch staff member
      const { data: staffData, error: staffErr } = await supabase
        .from('staff')
        .select('*')
        .eq('id', staffId)
        .eq('school_id', schoolId)
        .single()

      if (staffErr) {
        setErrorMsg(staffErr.message)
        setMember(null)
        return
      }

      if (staffData) {
        // 2. Fetch assigned classes
        const { data: assignments } = await supabase
          .from('teacher_classes')
          .select('classes(name)')
          .eq('teacher_id', staffId)

        const assignedClasses = assignments?.map((a: any) => a.classes?.name).filter(Boolean) || []

        setMember({
          ...staffData,
          assigned_classes: assignedClasses
        })

        const defaultEmployeeId = `GVPS/TE/2022/${staffId.slice(0, 3).toUpperCase()}`

        // 3. Load Qualifications / leaves from Local Storage
        const extKey = `schoolos_teacher_ext_${staffId}`
        const storedExt = localStorage.getItem(extKey)
        if (storedExt) {
          try {
            const parsed = JSON.parse(storedExt) as TeacherExt
            const defaultExt: TeacherExt = {
              dob: '12 Mar 1990',
              gender: 'Female',
              qualification: 'M.Sc, B.Ed',
              experience: '6 Years',
              joiningDate: new Date(staffData.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              department: 'Science',
              jobType: 'Full Time',
              employeeId: defaultEmployeeId,
              address: '45, Green Park Society, Surat, Gujarat - 395505',
              aadhaar: 'XXXX-XXXX-5678',
              pan: 'ABCDE1234F',
              bankAccount: 'HDFC Bank - 5012 3456 7890',
              emergencyContactName: 'Rajesh Patel',
              emergencyContactRelation: 'Father',
              emergencyContactPhone: '+91 98765 43211',
              salary: '45000',
              bankAccountDetails: 'HDFC Bank - 5012 3456 7890',
              basicSalary: '35000',
              hra: '7000',
              allowance: '3000',
              paymentMode: 'Bank Transfer',
              lastSalaryPaid: '01 May 2025',
              leaves: {
                sickTotal: 10,
                sickTaken: 4,
                casualTotal: 12,
                casualTaken: 4,
                earnedTotal: 15,
                earnedTaken: 3,
                maternityTotal: 90,
                maternityTaken: 0
              },
              leaveLogs: [
                { id: 'l1', date: '2026-06-15', type: 'Sick', days: 1, reason: 'Regular health check' },
                { id: 'l2', date: '2026-05-10', type: 'Casual', days: 2, reason: 'Family engagement' }
              ],
              salaryLog: [
                { id: 's1', month: 'June 2026', date: '2026-07-01', amount: 45000, status: 'Paid' },
                { id: 's2', month: 'May 2026', date: '2026-06-01', amount: 45000, status: 'Paid' }
              ],
              documents: [
                { id: 'd1', name: 'Aadhaar Card.pdf', type: 'PDF', date: '15 Jun 2022' },
                { id: 'd2', name: 'Qualification Certificate.pdf', type: 'PDF', date: '15 Jun 2022' },
                { id: 'd3', name: 'Experience Certificate.pdf', type: 'PDF', date: '15 Jun 2022' },
                { id: 'd4', name: 'Profile Photo.jpg', type: 'JPG', date: '15 Jun 2022' }
              ],
              performance: [
                { id: 'p1', date: '2026-06-20', evaluator: 'Principal V.K. Bhardwaj', rating: 5, note: 'Neha shows extreme dedication, especially in organizing Science Exhibitions.' }
              ],
              attendance: {},
              subjectsTeaching: [
                { name: 'Science', details: 'Grade 5, 6, 7', periods: '12 Periods' },
                { name: 'Physics', details: 'Grade 6, 7', periods: '8 Periods' },
                { name: 'Chemistry', details: 'Grade 7', periods: '6 Periods' }
              ]
            }
            const merged: TeacherExt = {
              ...defaultExt,
              ...parsed,
              leaves: {
                ...defaultExt.leaves,
                ...(parsed?.leaves || {})
              }
            }
            setExt(merged)
            setEditForm({
              fullName: staffData.full_name,
              email: staffData.email,
              phone: staffData.phone || '',
              status: staffData.status,
              dob: parsed.dob || '12 Mar 1990',
              gender: parsed.gender || 'Female',
              qualification: parsed.qualification || 'M.Sc, B.Ed',
              experience: parsed.experience || '6 Years',
              department: parsed.department || 'Science',
              jobType: parsed.jobType || 'Full Time',
              address: parsed.address || '45, Green Park Society, Surat, Gujarat - 395005',
              aadhaar: parsed.aadhaar || 'XXXX-XXXX-1234',
              pan: parsed.pan || 'ABCDE1234F',
              bankAccount: parsed.bankAccount || 'HDFC Bank - 5012 3456 7890',
              emergencyContactName: parsed.emergencyContactName || 'Rajesh Patel',
              emergencyContactRelation: parsed.emergencyContactRelation || 'Father',
              emergencyContactPhone: parsed.emergencyContactPhone || '+91 98765 43211',
              basicSalary: parsed.basicSalary || '35000',
              hra: parsed.hra || '7000',
              allowance: parsed.allowance || '3000'
            })
          } catch (e) {
            console.error('Failed to parse teacher metadata extension:', e)
          }
        } else {
          // Seed initial default mock teacher extension values matching the mock exactly
          const defaultExt: TeacherExt = {
            dob: '12 Mar 1990',
            gender: 'Female',
            qualification: 'M.Sc, B.Ed',
            experience: '6 Years',
            joiningDate: new Date(staffData.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            department: 'Science',
            jobType: 'Full Time',
            employeeId: defaultEmployeeId,
            address: '45, Green Park Society, Surat, Gujarat - 395505',
            aadhaar: 'XXXX-XXXX-5678',
            pan: 'ABCDE1234F',
            bankAccount: 'HDFC Bank - 5012 3456 7890',
            emergencyContactName: 'Rajesh Patel',
            emergencyContactRelation: 'Father',
            emergencyContactPhone: '+91 98765 43211',
            salary: '45000',
            bankAccountDetails: 'HDFC Bank - 5012 3456 7890',
            basicSalary: '35000',
            hra: '7000',
            allowance: '3000',
            paymentMode: 'Bank Transfer',
            lastSalaryPaid: '01 May 2025',
            leaves: {
              sickTotal: 10,
              sickTaken: 4,
              casualTotal: 12,
              casualTaken: 4,
              earnedTotal: 15,
              earnedTaken: 3,
              maternityTotal: 90,
              maternityTaken: 0
            },
            leaveLogs: [
              { id: 'l1', date: '2026-06-15', type: 'Sick', days: 1, reason: 'Regular health check' },
              { id: 'l2', date: '2026-05-10', type: 'Casual', days: 2, reason: 'Family engagement' }
            ],
            salaryLog: [
              { id: 's1', month: 'June 2026', date: '2026-07-01', amount: 45000, status: 'Paid' },
              { id: 's2', month: 'May 2026', date: '2026-06-01', amount: 45000, status: 'Paid' }
            ],
            documents: [
              { id: 'd1', name: 'Aadhaar Card.pdf', type: 'PDF', date: '15 Jun 2022' },
              { id: 'd2', name: 'Qualification Certificate.pdf', type: 'PDF', date: '15 Jun 2022' },
              { id: 'd3', name: 'Experience Certificate.pdf', type: 'PDF', date: '15 Jun 2022' },
              { id: 'd4', name: 'Profile Photo.jpg', type: 'JPG', date: '15 Jun 2022' }
            ],
            performance: [
              { id: 'p1', date: '2026-06-20', evaluator: 'Principal V.K. Bhardwaj', rating: 5, note: 'Neha shows extreme dedication, especially in organizing Science Exhibitions.' }
            ],
            attendance: (() => {
              const dates: Record<string, 'present' | 'absent'> = {}
              for (let d = 0; d < 30; d++) {
                const date = new Date()
                date.setDate(date.getDate() - d)
                if (date.getDay() === 0 || date.getDay() === 6) continue
                const dateStr = date.toISOString().split('T')[0]
                dates[dateStr] = Math.random() > 0.05 ? 'present' : 'absent'
              }
              return dates
            })(),
            subjectsTeaching: [
              { name: 'Science', details: 'Grade 5, 6, 7', periods: '12 Periods' },
              { name: 'Physics', details: 'Grade 6, 7', periods: '8 Periods' },
              { name: 'Chemistry', details: 'Grade 7', periods: '6 Periods' }
            ]
          }
          setExt(defaultExt)
          localStorage.setItem(extKey, JSON.stringify(defaultExt))
          setEditForm({
            fullName: staffData.full_name,
            email: staffData.email,
            phone: staffData.phone || '',
            status: staffData.status,
            dob: defaultExt.dob,
            gender: defaultExt.gender,
            qualification: defaultExt.qualification,
            experience: defaultExt.experience,
            department: defaultExt.department,
            jobType: defaultExt.jobType,
            address: defaultExt.address,
            aadhaar: defaultExt.aadhaar,
            pan: defaultExt.pan,
            bankAccount: defaultExt.bankAccount,
            emergencyContactName: defaultExt.emergencyContactName,
            emergencyContactRelation: defaultExt.emergencyContactRelation,
            emergencyContactPhone: defaultExt.emergencyContactPhone,
            basicSalary: defaultExt.basicSalary,
            hra: defaultExt.hra,
            allowance: defaultExt.allowance
          })
        }
      }

      // Fetch classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name', { ascending: true })
      setClassesList(classesData || [])

    } catch (e: any) {
      console.error(e)
      setErrorMsg(e.message || 'Error loading profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!schoolId) return
    void loadProfile()
  }, [staffId, schoolId])

  const handleSaveProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!member || !staffId) return

    setSaving(true)
    try {
      const { error: dbErr } = await supabase
        .from('staff')
        .update({
          full_name: editForm.fullName,
          email: editForm.email,
          phone: editForm.phone || null,
          status: editForm.status
        })
        .eq('id', staffId)

      if (dbErr) throw dbErr

      const totalCalculated = Number(editForm.basicSalary || 0) + Number(editForm.hra || 0) + Number(editForm.allowance || 0)

      const updatedExt: TeacherExt = {
        ...ext,
        dob: editForm.dob,
        gender: editForm.gender,
        qualification: editForm.qualification,
        experience: editForm.experience,
        department: editForm.department,
        jobType: editForm.jobType,
        address: editForm.address,
        aadhaar: editForm.aadhaar,
        pan: editForm.pan,
        bankAccount: editForm.bankAccount,
        emergencyContactName: editForm.emergencyContactName,
        emergencyContactRelation: editForm.emergencyContactRelation,
        emergencyContactPhone: editForm.emergencyContactPhone,
        basicSalary: editForm.basicSalary,
        hra: editForm.hra,
        allowance: editForm.allowance,
        salary: String(totalCalculated),
        bankAccountDetails: editForm.bankAccount
      }
      setExt(updatedExt)
      localStorage.setItem(`schoolos_teacher_ext_${staffId}`, JSON.stringify(updatedExt))

      setMember(prev => prev ? { ...prev, full_name: editForm.fullName, email: editForm.email, phone: editForm.phone || null, status: editForm.status } : null)
      setIsEditProfileOpen(false)
      showToast('Teacher profile details saved successfully!', 'success')
    } catch (err: any) {
      alert(err.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Log Leave
  const handleAddLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffId) return

    const { type, days, reason, date } = leaveForm
    const isSick = type === 'Sick'
    const isCasual = type === 'Casual'
    const isEarned = type === 'Earned'
    const isMaternity = type === 'Maternity'

    const updatedLeaves = { ...ext.leaves }
    if (isSick) updatedLeaves.sickTaken += Number(days)
    if (isCasual) updatedLeaves.casualTaken += Number(days)
    if (isEarned) updatedLeaves.earnedTaken += Number(days)
    if (isMaternity) updatedLeaves.maternityTaken += Number(days)

    const newLog = {
      id: `l_${Date.now()}`,
      date,
      type,
      days: Number(days),
      reason
    }

    const updatedExt = {
      ...ext,
      leaves: updatedLeaves,
      leaveLogs: [newLog, ...ext.leaveLogs]
    }

    setExt(updatedExt)
    localStorage.setItem(`schoolos_teacher_ext_${staffId}`, JSON.stringify(updatedExt))
    
    setIsAddLeaveOpen(false)
    setLeaveForm({ type: 'Sick', days: 1, reason: '', date: new Date().toISOString().split('T')[0] })
    showToast('Leave entry logged successfully!', 'success')
  }

  // Log Salary payout
  const handleAddSalarySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffId) return

    const newSlip = {
      id: `s_${Date.now()}`,
      month: salaryForm.month,
      date: salaryForm.date,
      amount: Number(salaryForm.amount),
      status: salaryForm.status
    }

    const updatedExt = {
      ...ext,
      salaryLog: [newSlip, ...ext.salaryLog]
    }

    setExt(updatedExt)
    localStorage.setItem(`schoolos_teacher_ext_${staffId}`, JSON.stringify(updatedExt))

    setIsAddSalaryOpen(false)
    setSalaryForm({ month: 'July 2026', amount: 45000, status: 'Paid', date: new Date().toISOString().split('T')[0] })
    showToast('Salary payout slip logged!', 'success')
  }

  // Toggle Attendance
  const handleCheckInAttendance = (dateStr: string, status: 'present' | 'absent') => {
    if (!staffId) return
    const updatedAttendance = { ...ext.attendance }
    if (updatedAttendance[dateStr] === status) {
      delete updatedAttendance[dateStr]
    } else {
      updatedAttendance[dateStr] = status
    }

    const updatedExt = {
      ...ext,
      attendance: updatedAttendance
    }
    setExt(updatedExt)
    localStorage.setItem(`schoolos_teacher_ext_${staffId}`, JSON.stringify(updatedExt))
    showToast(`Attendance marked as ${status} for ${dateStr}!`)
  }

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !staffId) return

    const newDoc = {
      id: `doc_${Date.now()}`,
      name: file.name,
      type: file.name.endsWith('.pdf') ? 'PDF' : 'JPG',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const updatedExt = {
      ...ext,
      documents: [newDoc, ...ext.documents]
    }
    setExt(updatedExt)
    localStorage.setItem(`schoolos_teacher_ext_${staffId}`, JSON.stringify(updatedExt))
    showToast(`${file.name} uploaded successfully!`, 'success')
  }

  const handleDocDelete = (id: string) => {
    if (!confirm('Erase this document from teacher vault?') || !staffId) return
    const updatedExt = {
      ...ext,
      documents: ext.documents.filter(d => d.id !== id)
    }
    setExt(updatedExt)
    localStorage.setItem(`schoolos_teacher_ext_${staffId}`, JSON.stringify(updatedExt))
    showToast('Document deleted.', 'info')
  }

  const getInitials = (name: string) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Calculated attendance rate
  const attendanceRate = useMemo(() => {
    const vals = Object.values(ext.attendance)
    if (vals.length === 0) return 96 // Default placeholder rate matching mock Neha Patel page
    const presents = vals.filter(v => v === 'present').length
    return Math.round((presents / vals.length) * 100)
  }, [ext.attendance])

  return (
    <>
      <ClientAuth />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-300">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
          </svg>
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Media Print wrapper */}
      <style>{`
        @media print {
          body > :not(#print-section) {
            display: none !important;
          }
          #print-section, #print-section * {
            display: block !important;
            visibility: visible !important;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 24px;
          }
        }
      `}</style>

      {/* Printable template */}
      {mounted && createPortal(
        <div id="print-section" className="hidden">
          <div className="border-b-2 border-slate-900 pb-4">
            <h1 className="text-2xl font-black">{member?.full_name}</h1>
            <p className="text-sm font-bold text-slate-500">Teacher Dossier Summary • School: {schoolName}</p>
          </div>
          <div className="grid grid-cols-2 gap-6 text-xs pt-4">
            <div>
              <h3 className="font-bold border-b border-slate-200 pb-1 mb-1.5 uppercase">Professional Qualifications</h3>
              <div><strong>Qualification:</strong> {ext.qualification}</div>
              <div><strong>Years of Experience:</strong> {ext.experience}</div>
              <div><strong>Core Subjects:</strong> {ext.department}</div>
            </div>
            <div>
              <h3 className="font-bold border-b border-slate-200 pb-1 mb-1.5 uppercase">Assigned Classes</h3>
              <div>{member?.assigned_classes && member.assigned_classes.length > 0 ? member.assigned_classes.map(c => `Class ${c}`).join(', ') : 'No classes assigned'}</div>
              <div className="mt-2"><strong>Base Compensation:</strong> {formatINR(Number(ext.basicSalary) + Number(ext.hra) + Number(ext.allowance))}/mo</div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Main dashboard Screen layout */}
      <div className="max-w-[1400px] mx-auto space-y-5 text-slate-800 font-sans pb-16 no-print text-left">
        
        {/* Breadcrumb Trail & Back Actions */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 select-none">
            <Link href="/dashboard/staff" className="hover:text-indigo-600 transition">Teachers</Link>
            <span>&gt;</span>
            <span className="text-slate-500">Teacher Profile</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/staff"
                className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-xl transition cursor-pointer shadow-sm"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              </Link>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Teacher Profile</h1>
                <p className="text-[10px] text-slate-400 font-bold mt-1">View and manage teacher information</p>
              </div>
            </div>

            {/* Header buttons */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button 
                onClick={() => window.print()}
                className="px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-xl shadow-sm cursor-pointer transition flex items-center gap-1.5"
              >
                🖨️ Print ID Card
              </button>
              <button 
                onClick={() => window.print()}
                className="px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-xl shadow-sm cursor-pointer transition flex items-center gap-1.5"
              >
                📥 Download PDF
              </button>
              <button 
                onClick={() => setIsEditProfileOpen(true)}
                className="px-4 py-2 bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl shadow cursor-pointer transition flex items-center gap-1.5"
              >
                ✏️ Edit Teacher
              </button>
              <button className="p-2 border border-slate-200 bg-white text-slate-400 hover:text-slate-600 rounded-xl shadow-sm transition">
                •••
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200/50 rounded-3xl p-8 space-y-6 animate-pulse">
            <div className="h-24 bg-slate-100 rounded-2xl w-full" />
            <div className="h-64 bg-slate-100 rounded-2xl w-full" />
          </div>
        ) : errorMsg ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-6 text-rose-800 font-semibold shadow-sm">
            Failed to load teacher profile: {errorMsg}
          </div>
        ) : !member ? (
          <div className="rounded-3xl border border-slate-200/60 bg-white p-8 text-center text-slate-500 font-bold shadow-sm">
            Staff profile not found in database.
          </div>
        ) : (
          <div className="space-y-6">

            {/* Profile Hero Header Card */}
            <div className="bg-white border border-slate-200/40 rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col lg:flex-row justify-between items-stretch gap-6">
              
              {/* Profile Bio Details */}
              <div className="flex-1 flex flex-col md:flex-row gap-6 items-start">
                {/* Photo container */}
                <div className="h-32 w-32 md:h-36 md:w-36 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-605 text-white flex items-center justify-center text-4xl font-black border border-indigo-200/10 shadow-md shrink-0 select-none">
                  {getInitials(member.full_name)}
                </div>

                {/* Details grid list */}
                <div className="space-y-4 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-slate-800 leading-tight">{member.full_name}</h2>
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100/40">Active</span>
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100/40">{ext.employeeId || 'GVPS/TE/2022/012'}</span>
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-100/40">Senior Teacher</span>
                  </div>

                  {/* Info Attributes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                    {/* DOB */}
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold shrink-0">📅</div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Date of Birth</span>
                        <strong className="text-xs font-bold text-slate-700">{ext.dob}</strong>
                      </div>
                    </div>

                    {/* Gender */}
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold shrink-0">👤</div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Gender</span>
                        <strong className="text-xs font-bold text-slate-700">{ext.gender}</strong>
                      </div>
                    </div>

                    {/* Qualifications */}
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold shrink-0">🎓</div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Qualification</span>
                        <strong className="text-xs font-bold text-slate-700">{ext.qualification}</strong>
                      </div>
                    </div>

                    {/* Experience */}
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold shrink-0">💼</div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Experience</span>
                        <strong className="text-xs font-bold text-slate-700">{ext.experience}</strong>
                      </div>
                    </div>

                    {/* Joining Date */}
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold shrink-0">📅</div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Date of Joining</span>
                        <strong className="text-xs font-bold text-slate-700">{ext.joiningDate}</strong>
                      </div>
                    </div>

                    {/* Department */}
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold shrink-0">🛡️</div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Department</span>
                        <strong className="text-xs font-bold text-slate-700">{ext.department}</strong>
                      </div>
                    </div>

                    {/* Job Type */}
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold shrink-0">📱</div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Job Type</span>
                        <strong className="text-xs font-bold text-slate-700">{ext.jobType}</strong>
                      </div>
                    </div>

                    {/* Email address */}
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold shrink-0">✉️</div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Email Address</span>
                        <strong className="text-xs font-bold text-slate-750 block truncate max-w-[130px]" title={member.email}>{member.email}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ID Card preview widget */}
              <div className="border border-slate-200/50 bg-slate-50/30 rounded-2xl p-4 flex flex-col shrink-0 lg:w-[280px] text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2.5">Teacher ID Card</span>
                
                {/* ID badge render */}
                <div className="bg-white border border-slate-200/70 rounded-xl p-3 shadow-sm space-y-3.5 relative overflow-hidden">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                    <span className="text-[8px] font-black text-indigo-600 block shrink-0">🏫</span>
                    <div className="text-left leading-none">
                      <strong className="text-[8px] font-black text-slate-800 uppercase tracking-wide block truncate max-w-[150px]">{schoolName || 'Green Valley Public School'}</strong>
                      <span className="text-[6px] font-bold text-slate-400 block mt-0.5">Session 2024-25</span>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <div className="h-10 w-10 bg-indigo-50 text-indigo-700 font-black rounded-lg flex items-center justify-center text-[10px] shrink-0 select-none">
                      {getInitials(member.full_name)}
                    </div>
                    <div className="text-left leading-tight">
                      <strong className="text-xs font-black text-slate-800 block truncate max-w-[110px]">{member.full_name}</strong>
                      <span className="text-[8px] text-slate-400 font-bold block mt-0.5">Senior Teacher</span>
                      <span className="text-[7px] text-slate-400 block font-semibold mt-0.5">Science Department</span>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 flex flex-col items-center justify-center">
                    {/* Simulated barcode */}
                    <div className="flex gap-[1px] items-center h-4 select-none">
                      {[1,3,2,1,4,2,3,1,2,3,2,1,4,1,3,2,1,2,3,1,4].map((w, idx) => (
                        <span key={idx} className="bg-slate-800" style={{ width: `${w}px`, height: '100%' }} />
                      ))}
                    </div>
                    <span className="text-[7px] font-bold text-slate-450 tracking-widest block mt-1">{ext.employeeId || 'GVPS/TE/22/012'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Navigation Tabs bar */}
            <div className="bg-white border border-slate-200/50 rounded-3xl p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex flex-wrap gap-1 scrollbar-none overflow-x-auto select-none font-semibold">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'classes', label: 'Classes' },
                { id: 'subjects', label: 'Subjects' },
                { id: 'timetable', label: 'Timetable' },
                { id: 'attendance', label: 'Attendance' },
                { id: 'leaves', label: 'Leaves' },
                { id: 'documents', label: 'Documents' },
                { id: 'salary', label: 'Salary' },
                { id: 'performance', label: 'Performance' },
                { id: 'activity', label: 'Activity Log' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
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

            {/* OVERVIEW TAB PANELS LAYOUT */}
            {activeTab === 'overview' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Columns 1 & 2 layout */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Classes & Subjects Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Card A: Classes Assigned */}
                    <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4 text-left">
                      <div className="flex items-center justify-between pb-1">
                        <strong className="text-xs font-black text-slate-800 uppercase tracking-wider block">Classes Assigned</strong>
                        <span className="text-[10px] font-bold text-slate-400">Class Teacher</span>
                      </div>
                      
                      <div className="space-y-2">
                        {member.assigned_classes && member.assigned_classes.length > 0 ? (
                          member.assigned_classes.map((cls, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-50/50 border border-slate-100 rounded-2xl p-3">
                              <div className="flex items-center gap-3">
                                <span className="p-2 bg-indigo-50 text-[#4f46e5] rounded-xl text-xs">🏫</span>
                                <div>
                                  <strong className="text-xs font-black text-slate-700 block">Grade {cls}</strong>
                                  <span className="text-[9px] text-slate-450 font-bold block mt-0.5">{idx === 0 ? 'Class Teacher' : 'Subject Teacher'}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">{32 - idx * 4} Students</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 bg-slate-50 text-center text-xs text-slate-400 font-bold rounded-xl border border-slate-100">No classes assigned yet.</div>
                        )}
                      </div>

                      <button 
                        onClick={() => setActiveTab('classes')}
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition block text-left"
                      >
                        View All Classes →
                      </button>
                    </div>

                    {/* Card B: Subjects Teaching */}
                    <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4 text-left">
                      <div className="flex items-center justify-between pb-1">
                        <strong className="text-xs font-black text-slate-800 uppercase tracking-wider block">Subjects Teaching</strong>
                        <span className="text-[10px] font-bold text-slate-400">Core Areas</span>
                      </div>

                      <div className="space-y-2">
                        {ext.subjectsTeaching && ext.subjectsTeaching.length > 0 ? (
                          ext.subjectsTeaching.map((sub, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-50/50 border border-slate-100 rounded-2xl p-3">
                              <div className="flex items-center gap-3">
                                <span className="p-2 bg-purple-555 text-[#4f46e5] rounded-xl text-xs">🧪</span>
                                <div>
                                  <strong className="text-xs font-black text-slate-750 block">{sub.name}</strong>
                                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{sub.details}</span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider">{sub.periods}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 bg-slate-50 text-center text-xs text-slate-400 font-bold rounded-xl border border-slate-100">No subjects catalogued.</div>
                        )}
                      </div>

                      <button 
                        onClick={() => setActiveTab('timetable')}
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition block text-left"
                      >
                        View Timetable →
                      </button>
                    </div>
                  </div>

                  {/* Attendance ring summary */}
                  <div className="bg-white border border-slate-200/40 rounded-3xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.01)] text-left flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3.5 flex-1">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-50">
                        <strong className="text-xs font-black text-slate-800 uppercase tracking-wider">Attendance Summary</strong>
                        <select className="border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 cursor-pointer outline-none bg-white">
                          <option>This Month</option>
                          <option>Last Month</option>
                        </select>
                      </div>

                      <div className="bg-emerald-50/30 text-emerald-700 border border-emerald-100/50 rounded-2xl p-3 text-xs font-bold">
                        Excellent! Your attendance is excellent this month.
                      </div>
                    </div>

                    {/* Donut chart */}
                    <div className="flex items-center gap-6 shrink-0 self-center md:self-auto">
                      <div className="relative h-20 w-20 flex items-center justify-center shrink-0">
                        <svg className="absolute inset-0 transform -rotate-90" width="80" height="80">
                          <circle cx="40" cy="40" r="30" fill="transparent" stroke="#f1f5f9" strokeWidth="6.5" />
                          <circle cx="40" cy="40" r="30" fill="transparent" stroke="#10b981" strokeWidth="6.5" strokeDasharray="188.4" strokeDashoffset={188.4 - (188.4 * attendanceRate) / 100} strokeLinecap="round" />
                        </svg>
                        <div className="text-center font-sans">
                          <span className="text-base font-black text-slate-805 block">{attendanceRate}%</span>
                          <span className="text-[8px] text-slate-400 block font-bold uppercase">Present</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-slate-400 font-semibold w-16">Present</span>
                          <strong className="text-slate-700 font-black">{24} Days</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="text-slate-400 font-semibold w-16">Absent</span>
                          <strong className="text-slate-700 font-black">{1} Day</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-slate-400 font-semibold w-16">Leave</span>
                          <strong className="text-slate-700 font-black">{1} Day</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Personal and Salary cards side by side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Personal Information */}
                    <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4 text-left">
                      <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block border-b border-slate-50 pb-2">Personal Information</strong>
                      
                      <div className="space-y-3.5">
                        <div className="flex items-start gap-2.5">
                          <span className="text-indigo-600 shrink-0">📍</span>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 block uppercase">Address</span>
                            <strong className="text-[11px] font-bold text-slate-700">{ext.address}</strong>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="text-indigo-600 shrink-0">💳</span>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 block uppercase">Aadhaar Number</span>
                            <strong className="text-[11px] font-bold text-slate-700">{ext.aadhaar}</strong>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="text-indigo-600 shrink-0">💼</span>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 block uppercase">PAN Number</span>
                            <strong className="text-[11px] font-bold text-slate-700">{ext.pan}</strong>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="text-indigo-600 shrink-0">🏦</span>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 block uppercase">Bank Account</span>
                            <strong className="text-[11px] font-bold text-slate-700">{ext.bankAccount}</strong>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="text-indigo-600 shrink-0">📞</span>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 block uppercase">Emergency Contact</span>
                            <strong className="text-[11px] font-bold text-slate-700">{ext.emergencyContactName} ({ext.emergencyContactRelation}) | {ext.emergencyContactPhone}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Salary Information */}
                    <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4 text-left">
                      <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block border-b border-slate-50 pb-2">Salary Information</strong>

                      <div className="space-y-3.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">Basic Salary</span>
                          <strong className="text-slate-700 font-bold">{formatINR(Number(ext.basicSalary))}</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">HRA</span>
                          <strong className="text-slate-700 font-bold">{formatINR(Number(ext.hra))}</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">Allowance</span>
                          <strong className="text-slate-700 font-bold">{formatINR(Number(ext.allowance))}</strong>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-100 pt-2 bg-slate-50 p-2 rounded-xl">
                          <span className="text-indigo-700 font-black">Total Salary</span>
                          <strong className="text-indigo-700 font-black">{formatINR(Number(ext.basicSalary) + Number(ext.hra) + Number(ext.allowance))} / month</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">Payment Mode</span>
                          <strong className="text-slate-700 font-bold">{ext.paymentMode}</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">Last Salary Paid</span>
                          <strong className="text-slate-700 font-bold">{ext.lastSalaryPaid}</strong>
                        </div>
                      </div>

                      <button 
                        onClick={() => setActiveTab('salary')}
                        className="text-[10px] font-black text-indigo-600 hover:underline block text-left"
                      >
                        View Salary Slip →
                      </button>
                    </div>
                  </div>

                  {/* Recent Documents Card */}
                  <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block">Recent Documents</strong>
                      <button 
                        onClick={() => setActiveTab('documents')}
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        View All
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {ext.documents.map(doc => (
                        <div key={doc.id} className="bg-slate-50/50 border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <span className="p-2.5 bg-indigo-50 text-[#4f46e5] rounded-xl font-bold text-xs shrink-0 select-none">📄</span>
                            <div className="text-left">
                              <strong className="text-xs font-bold text-slate-800 block truncate max-w-[180px]">{doc.name}</strong>
                              <span className="text-[9px] text-slate-400 block font-semibold mt-0.5">Uploaded on {doc.date}</span>
                            </div>
                          </div>
                          
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[8px] font-black uppercase shrink-0 border border-rose-100/50 select-none">{doc.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Right Column sidebar */}
                <div className="space-y-6">
                  
                  {/* Quick Actions widget */}
                  <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4 text-left">
                    <strong className="text-xs font-black text-slate-800 uppercase tracking-wider block border-b border-slate-50 pb-2">Quick Actions</strong>
                    
                    <div className="space-y-2 text-xs font-bold">
                      <button onClick={() => setIsEditProfileOpen(true)} className="w-full text-left py-2.5 px-3 border border-slate-150 rounded-xl hover:bg-slate-50 transition flex items-center justify-between cursor-pointer text-slate-700 select-none">
                        <span className="flex items-center gap-2">✏️ Edit Teacher</span>
                        <span className="text-slate-400">&gt;</span>
                      </button>

                      <button onClick={() => setActiveTab('classes')} className="w-full text-left py-2.5 px-3 border border-slate-150 rounded-xl hover:bg-slate-50 transition flex items-center justify-between cursor-pointer text-slate-700 select-none">
                        <span className="flex items-center gap-2">🏫 Assign Classes</span>
                        <span className="text-slate-400">&gt;</span>
                      </button>

                      <button onClick={() => setActiveTab('subjects')} className="w-full text-left py-2.5 px-3 border border-slate-150 rounded-xl hover:bg-slate-50 transition flex items-center justify-between cursor-pointer text-slate-700 select-none">
                        <span className="flex items-center gap-2">🧪 Assign Subjects</span>
                        <span className="text-slate-400">&gt;</span>
                      </button>

                      <button onClick={() => setActiveTab('attendance')} className="w-full text-left py-2.5 px-3 border border-slate-150 rounded-xl hover:bg-slate-50 transition flex items-center justify-between cursor-pointer text-slate-700 select-none">
                        <span className="flex items-center gap-2">✅ Mark Attendance</span>
                        <span className="text-slate-400">&gt;</span>
                      </button>

                      <button onClick={() => setIsAddLeaveOpen(true)} className="w-full text-left py-2.5 px-3 border border-slate-150 rounded-xl hover:bg-slate-50 transition flex items-center justify-between cursor-pointer text-slate-700 select-none">
                        <span className="flex items-center gap-2">✈️ Apply Leave</span>
                        <span className="text-slate-400">&gt;</span>
                      </button>

                      <button onClick={() => setIsAddPerformanceOpen(true)} className="w-full text-left py-2.5 px-3 border border-slate-150 rounded-xl hover:bg-slate-50 transition flex items-center justify-between cursor-pointer text-slate-700 select-none">
                        <span className="flex items-center gap-2">⭐ Performance Review</span>
                        <span className="text-slate-400">&gt;</span>
                      </button>

                      <button onClick={() => window.print()} className="w-full text-left py-2.5 px-3 border border-slate-150 rounded-xl hover:bg-slate-50 transition flex items-center justify-between cursor-pointer text-slate-750 select-none bg-indigo-50/20">
                        <span className="flex items-center gap-2">🖨️ Generate ID Card</span>
                        <span className="text-slate-400">&gt;</span>
                      </button>
                    </div>
                  </div>

                  {/* Leave Balance widget */}
                  <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4 text-left">
                    <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block border-b border-slate-50 pb-2">Leave Balance</strong>
                    
                    <div className="space-y-3.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Casual Leave</span>
                        <strong className="text-slate-700 font-bold">{ext.leaves.casualTotal - ext.leaves.casualTaken} Days</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Sick Leave</span>
                        <strong className="text-slate-700 font-bold">{ext.leaves.sickTotal - ext.leaves.sickTaken} Days</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Earned Leave</span>
                        <strong className="text-slate-700 font-bold">{ext.leaves.earnedTotal - ext.leaves.earnedTaken} Days</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-semibold">Maternity Leave</span>
                        <strong className="text-slate-700 font-bold">{ext.leaves.maternityTotal - ext.leaves.maternityTaken > 0 ? `${ext.leaves.maternityTotal - ext.leaves.maternityTaken} Days` : '—'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Next Leave widget */}
                  <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4 text-left">
                    <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block border-b border-slate-50 pb-2">Next Leave</strong>

                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <strong className="text-xs font-bold text-slate-800 block">Sick Leave</strong>
                          <span className="text-[10px] text-slate-400 block font-semibold">20 May 2026 - 21 May 2026</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100/50 text-[9px] font-black uppercase tracking-wider">Pending</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab('leaves')}
                      className="text-[10px] font-black text-indigo-600 hover:underline block text-left"
                    >
                      View All Leaves →
                    </button>
                  </div>

                  {/* Performance widget */}
                  <div className="bg-white border border-slate-200/40 rounded-3xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4 text-left">
                    <strong className="text-xs font-black text-slate-805 uppercase tracking-wider block border-b border-slate-50 pb-2">Performance (This Year)</strong>

                    <div className="flex items-center justify-around gap-4 py-2">
                      <div className="relative h-16 w-16 flex items-center justify-center shrink-0">
                        <svg className="absolute inset-0 transform -rotate-90" width="64" height="64">
                          <circle cx="32" cy="32" r="26" fill="transparent" stroke="#f1f5f9" strokeWidth="5.5" />
                          <circle cx="32" cy="32" r="26" fill="transparent" stroke="#4f46e5" strokeWidth="5.5" strokeDasharray="163.3" strokeDashoffset={163.3 - (163.3 * 4.7) / 5} strokeLinecap="round" />
                        </svg>
                        <div className="text-center font-sans">
                          <span className="text-sm font-black text-slate-800 block">4.7</span>
                          <span className="text-[6px] text-slate-400 block font-bold uppercase">Out of 5</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <div className="text-amber-500 text-sm font-bold tracking-tight">⭐⭐⭐⭐⭐</div>
                        <span className="text-[10px] text-slate-400 font-semibold block leading-tight">Excellent feedback on curriculum delivery</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab('performance')}
                      className="text-[10px] font-black text-indigo-600 hover:underline block text-left"
                    >
                      View Performance Reviews →
                    </button>
                  </div>

                </div>

              </div>
            ) : (
              <div className="bg-white border border-slate-200/50 rounded-3xl p-6 shadow-sm min-h-[300px]">
                {/* Classes Tab */}
                {activeTab === 'classes' && (
                  <div className="space-y-4 text-left">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Classes Assigned</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {member.assigned_classes && member.assigned_classes.length > 0 ? (
                        member.assigned_classes.map((cls, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 text-[#4f46e5] rounded-xl font-bold">🏫</div>
                            <div>
                              <strong className="text-sm font-black text-slate-800 block">Class {cls}</strong>
                              <span className="text-[10px] text-slate-400 font-semibold">Assigned Room</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-450 italic font-semibold">No active classes assigned yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Subjects Tab */}
                {activeTab === 'subjects' && (
                  <div className="space-y-4 text-left">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Subjects Teaching</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {ext.subjectsTeaching.map((sub, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 space-y-2">
                          <strong className="text-xs font-bold text-slate-800 block">{sub.name}</strong>
                          <span className="text-[10px] text-slate-400 block font-semibold">Details: {sub.details}</span>
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase inline-block">{sub.periods}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timetable Tab */}
                {activeTab === 'timetable' && (
                  <div className="space-y-4 text-left">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Weekly Timetable Schedule</h3>
                    <div className="overflow-hidden border border-slate-100 rounded-xl text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                            <th className="py-2.5 px-4">Period</th>
                            <th className="py-2.5 px-4">Time</th>
                            <th className="py-2.5 px-4">Class</th>
                            <th className="py-2.5 px-4">Subject</th>
                            <th className="py-2.5 px-4">Room</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                          {member.assigned_classes?.map((cls, idx) => (
                            <tr key={idx}>
                              <td className="py-2.5 px-4 font-bold">Period {idx + 1}</td>
                              <td className="py-2.5 px-4">{idx === 0 ? '09:00 AM - 09:45 AM' : idx === 1 ? '10:00 AM - 10:45 AM' : '11:30 AM - 12:15 PM'}</td>
                              <td className="py-2.5 px-4">Grade {cls}</td>
                              <td className="py-2.5 px-4">{idx % 2 === 0 ? 'Science' : 'Physics'}</td>
                              <td className="py-2.5 px-4">Room {104 + idx * 10}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Attendance Tab */}
                {activeTab === 'attendance' && (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Attendance Registry Logs</h3>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCheckInAttendance(new Date().toISOString().split('T')[0], 'present')}
                          className="px-2.5 py-1 border border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider rounded-lg transition active:scale-95"
                        >
                          Check-in Present
                        </button>
                        <button 
                          onClick={() => handleCheckInAttendance(new Date().toISOString().split('T')[0], 'absent')}
                          className="px-2.5 py-1 border border-rose-250 bg-rose-50 text-rose-700 text-[9px] font-black uppercase tracking-wider rounded-lg transition active:scale-95"
                        >
                          Check-in Absent
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                      {(() => {
                        const list = []
                        for (let i = 0; i < 24; i++) {
                          const d = new Date()
                          d.setDate(d.getDate() - i)
                          if (d.getDay() === 0 || d.getDay() === 6) continue
                          const dateStr = d.toISOString().split('T')[0]
                          const status = ext.attendance[dateStr]
                          const formattedD = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                          list.push(
                            <div 
                              key={i} 
                              onClick={() => handleCheckInAttendance(dateStr, 'present')}
                              className={`border rounded-xl p-3 text-center cursor-pointer transition select-none ${
                                status === 'present' 
                                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800' 
                                  : status === 'absent' 
                                    ? 'bg-rose-50/50 border-rose-200 text-rose-800' 
                                    : 'bg-slate-50/50 border-slate-200 text-slate-400'
                              }`}
                            >
                              <span className="text-[10px] font-black uppercase tracking-wider block">{formattedD}</span>
                              <span className="text-xs font-bold block mt-1">{status ? status.toUpperCase() : 'NO LOG'}</span>
                            </div>
                          )
                        }
                        return list
                      })()}
                    </div>
                  </div>
                )}

                {/* Leaves Tab */}
                {activeTab === 'leaves' && (
                  <div className="space-y-6 text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Leave Balance & Logs</h3>
                      <button 
                        onClick={() => setIsAddLeaveOpen(true)}
                        className="px-2.5 py-1.5 bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition"
                      >
                        ✈️ Log Leave Taken
                      </button>
                    </div>

                    <div className="space-y-3">
                      {ext.leaveLogs && ext.leaveLogs.length > 0 ? (
                        <div className="overflow-hidden border border-slate-100 rounded-xl">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                <th className="py-2.5 px-4">Date</th>
                                <th className="py-2.5 px-4">Leave Type</th>
                                <th className="py-2.5 px-4">Duration</th>
                                <th className="py-2.5 px-4">Reason description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                              {ext.leaveLogs.map(log => (
                                <tr key={log.id}>
                                  <td className="py-2.5 px-4">{log.date}</td>
                                  <td className="py-2.5 px-4">
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700">{log.type}</span>
                                  </td>
                                  <td className="py-2.5 px-4 font-bold">{log.days} days</td>
                                  <td className="py-2.5 px-4 text-slate-500">{log.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-450 italic font-semibold">No leaves logged in this profile.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents Tab */}
                {activeTab === 'documents' && (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Document Vault</h3>
                      <label className="px-2.5 py-1.5 bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition cursor-pointer select-none">
                        📤 Upload PDF
                        <input type="file" accept="application/pdf" className="hidden" onChange={handleDocUpload} />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {ext.documents.map(doc => (
                        <div key={doc.id} className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <span className="p-2.5 bg-indigo-50 text-[#4f46e5] rounded-xl font-bold text-xs select-none">📄</span>
                            <div className="text-left">
                              <strong className="text-xs font-bold text-slate-800 block truncate max-w-[200px]">{doc.name}</strong>
                              <span className="text-[9px] text-slate-400 block font-semibold mt-0.5">Uploaded on {doc.date}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDocDelete(doc.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            ❌
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Salary Tab */}
                {activeTab === 'salary' && (
                  <div className="space-y-6 text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Salary Ledger Slips</h3>
                      <button 
                        onClick={() => setIsAddSalaryOpen(true)}
                        className="px-2.5 py-1.5 bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition"
                      >
                        💰 Payout Salary
                      </button>
                    </div>

                    <div className="space-y-3">
                      {ext.salaryLog && ext.salaryLog.length > 0 ? (
                        <div className="overflow-hidden border border-slate-100 rounded-xl">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                <th className="py-2.5 px-4">Pay Period</th>
                                <th className="py-2.5 px-4">Settlement Date</th>
                                <th className="py-2.5 px-4">Amount Paid</th>
                                <th className="py-2.5 px-4">Payment status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                              {ext.salaryLog.map(slip => (
                                <tr key={slip.id}>
                                  <td className="py-2.5 px-4 font-bold">{slip.month}</td>
                                  <td className="py-2.5 px-4">{slip.date}</td>
                                  <td className="py-2.5 px-4 font-black">{formatINR(slip.amount)}</td>
                                  <td className="py-2.5 px-4">
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700">{slip.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-455 italic font-semibold">No payouts logged.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Performance Tab */}
                {activeTab === 'performance' && (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Performance Notes</h3>
                      <button 
                        onClick={() => setIsAddPerformanceOpen(true)}
                        className="px-2.5 py-1.5 bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition"
                      >
                        ✏️ Add Review Note
                      </button>
                    </div>

                    <div className="space-y-4">
                      {ext.performance.map(perf => (
                        <div key={perf.id} className="border border-slate-205 rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <strong className="text-slate-800 font-black">{perf.evaluator}</strong>
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-500 font-bold">{'★'.repeat(perf.rating)}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">{perf.date}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 leading-normal font-semibold mt-1">{perf.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity Log Tab */}
                {activeTab === 'activity' && (
                  <div className="space-y-4 text-left">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">System Audit Logs</h3>
                    <div className="space-y-4 text-xs font-bold">
                      <div className="flex gap-3 text-left">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                          <span className="text-slate-700 block">Directory Profile created</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{ext.joiningDate}</span>
                        </div>
                      </div>
                      <div className="flex gap-3 text-left">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <div>
                          <span className="text-slate-700 block">Login account registered</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Auto-configured</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ================= EDIT DETAILS MODAL ================= */}
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsEditProfileOpen(false)} />
            
            <div className="relative w-full max-w-lg bg-white shadow-2xl rounded-3xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden transition-all transform animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
                <h3 className="text-base font-black text-slate-900">Edit Teacher Details</h3>
                <button onClick={() => setIsEditProfileOpen(false)} className="text-slate-400 hover:text-slate-655 p-1">
                  ❌
                </button>
              </div>

              <form onSubmit={handleSaveProfileSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.fullName}
                      onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Contact Phone</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 cursor-pointer outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <h4 className="text-xs font-black text-indigo-605 border-b border-indigo-50 pb-1 mt-4">Professional Extensions</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Qualifications */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Qualifications</label>
                    <input
                      type="text"
                      value={editForm.qualification}
                      onChange={e => setEditForm({ ...editForm, qualification: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  {/* Experience */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Years of Experience</label>
                    <input
                      type="text"
                      value={editForm.experience}
                      onChange={e => setEditForm({ ...editForm, experience: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-850 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Department */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Department</label>
                    <input
                      type="text"
                      value={editForm.department}
                      onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  {/* Job Type */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Job Type</label>
                    <input
                      type="text"
                      value={editForm.jobType}
                      onChange={e => setEditForm({ ...editForm, jobType: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Gender */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Gender</label>
                    <input
                      type="text"
                      value={editForm.gender}
                      onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  {/* DOB */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Date of Birth</label>
                    <input
                      type="text"
                      value={editForm.dob}
                      onChange={e => setEditForm({ ...editForm, dob: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Aadhaar */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Aadhaar</label>
                    <input
                      type="text"
                      value={editForm.aadhaar}
                      onChange={e => setEditForm({ ...editForm, aadhaar: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  {/* PAN */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">PAN</label>
                    <input
                      type="text"
                      value={editForm.pan}
                      onChange={e => setEditForm({ ...editForm, pan: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  {/* Bank Account info */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Bank disbursement account</label>
                    <input
                      type="text"
                      value={editForm.bankAccount}
                      onChange={e => setEditForm({ ...editForm, bankAccount: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Basic Salary */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Basic Salary (₹)</label>
                    <input
                      type="number"
                      value={editForm.basicSalary}
                      onChange={e => setEditForm({ ...editForm, basicSalary: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-805 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  {/* HRA */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">HRA (₹)</label>
                    <input
                      type="number"
                      value={editForm.hra}
                      onChange={e => setEditForm({ ...editForm, hra: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-855 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>

                  {/* Allowance */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Allowance (₹)</label>
                    <input
                      type="number"
                      value={editForm.allowance}
                      onChange={e => setEditForm({ ...editForm, allowance: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-205 text-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsEditProfileOpen(false)}
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="px-4 py-2.5 bg-[#4f46e5] text-white font-bold text-xs rounded-xl shadow active:scale-[0.98] transition cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Profile details'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= LOG LEAVE ENTRY MODAL ================= */}
        {isAddLeaveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddLeaveOpen(false)} />
            
            <div className="relative w-full max-w-sm bg-white shadow-2xl rounded-3xl border border-slate-100 p-6 space-y-4 animate-in zoom-in-95 duration-200 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-800">Log Leave Entry</h3>
                <button onClick={() => setIsAddLeaveOpen(false)} className="text-slate-405 hover:text-slate-600 p-1">
                  ❌
                </button>
              </div>

              <form onSubmit={handleAddLeaveSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Leave Type *</label>
                  <select
                    value={leaveForm.type}
                    onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer outline-none"
                  >
                    <option value="Sick">Sick Leave</option>
                    <option value="Casual">Casual Leave</option>
                    <option value="Earned">Earned Leave</option>
                    <option value="Maternity">Maternity Leave</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Duration Days *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={leaveForm.days}
                      onChange={e => setLeaveForm({ ...leaveForm, days: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.date}
                      onChange={e => setLeaveForm({ ...leaveForm, date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Leave Reason Description</label>
                  <input
                    type="text"
                    placeholder="e.g. High fever checkup"
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAddLeaveOpen(false)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-[#4f46e5] text-white font-bold text-xs rounded-xl shadow"
                  >
                    Save Entry
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
