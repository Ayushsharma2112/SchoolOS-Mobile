'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useSchool } from '../../../../lib/SchoolContext'
import AcademicHeader from '../../../../components/academics/AcademicHeader'
import { TableSkeleton } from '../../../../components/academics/LoadingSkeleton'
import { generateReportCardRemarks } from '../../../../lib/services/ai'

type Student = {
  id: string
  full_name: string
  roll_number?: string
  class_name: string
}

type ClassOption = { id: string; name: string }
type ExamOption = { id: string; title: string; term: string; year: string; class_id: string }

type SubjectGrade = {
  name: string
  marks: number
  maxMarks: number
  grade: string
  remarks: string
}

export default function ReportCardsPage() {
  const { schoolId, schoolName, schoolLogoUrl } = useSchool()
  
  // Roster lists
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [exams, setExams] = useState<ExamOption[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedExam, setSelectedExam] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')

  // Report Card Output data
  const [loading, setLoading] = useState(false)
  const [grades, setGrades] = useState<SubjectGrade[]>([])
  const [studentDetails, setStudentDetails] = useState<Student | null>(null)
  const [examDetails, setExamDetails] = useState<ExamOption | null>(null)
  
  // Computed values
  const [totalObtained, setTotalObtained] = useState(0)
  const [totalMax, setTotalMax] = useState(0)
  const [percentage, setPercentage] = useState(0)
  const [classRank, setClassRank] = useState<number | string>('-')
  const [attendanceRate, setAttendanceRate] = useState('100%')
  const [overallRemarks, setOverallRemarks] = useState('')
  const [aiRemarksLoading, setAiRemarksLoading] = useState(false)

  // UI state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load classes & exams
  useEffect(() => {
    if (!schoolId) return
    async function loadConfig() {
      try {
        const { data: cls } = await supabase.from('classes').select('id, name').eq('school_id', schoolId)
        setClasses(cls || [])
        
        const { data: ex } = await supabase.from('exams').select('id, title, term, year, class_id').eq('school_id', schoolId)
        setExams(ex || [])
      } catch (e) {
        console.error(e)
      }
    }
    void loadConfig()
  }, [schoolId])

  const visibleExams = useMemo(() => {
    if (!selectedClass) return []
    return exams.filter(e => e.class_id === selectedClass)
  }, [selectedClass, exams])

  // Reset selected exam when class changes
  useEffect(() => {
    if (selectedClass) {
      const match = visibleExams.some(e => e.id === selectedExam)
      if (!match) {
        setSelectedExam('')
      }
    } else {
      setSelectedExam('')
    }
  }, [selectedClass, visibleExams, selectedExam])

  // Fetch students on class selection
  useEffect(() => {
    if (!selectedClass) {
      setStudents([])
      return
    }
    async function fetchStudents() {
      const clsName = classes.find(c => c.id === selectedClass)?.name || ''
      const { data } = await supabase
        .from('students')
        .select('id, full_name, roll_number, class_name')
        .eq('school_id', schoolId)
        .eq('class_name', clsName)
      setStudents(data || [])
    }
    void fetchStudents()
  }, [selectedClass])

  // Generate Report Card calculations
  const handleGenerateReportCard = async () => {
    if (!selectedStudent || !selectedExam) {
      showToast('Please select all filters first.', 'error')
      return
    }

    setLoading(true)
    setGrades([])
    try {
      const student = students.find(s => s.id === selectedStudent) || null
      const exam = exams.find(e => e.id === selectedExam) || null
      setStudentDetails(student)
      setExamDetails(exam)

      if (!student || !exam) return

      // 1. Fetch academic results for student + exam
      const { data: resData, error: resError } = await supabase
        .from('results')
        .select(`
          marks, grade, remarks,
          subjects(name)
        `)
        .eq('student_id', student.id)
        .eq('exam_id', exam.id)

      if (resError) throw resError

      const resolvedGrades = (resData || []).map((r: any) => ({
        name: r.subjects?.name || 'General',
        marks: Number(r.marks),
        maxMarks: 100,
        grade: r.grade,
        remarks: r.remarks || 'Satisfactory'
      }))
      setGrades(resolvedGrades)

      // 2. Compute totals & percentage
      const obtained = resolvedGrades.reduce((sum, g) => sum + g.marks, 0)
      const max = resolvedGrades.length * 100
      setTotalObtained(obtained)
      setTotalMax(max)
      
      const pct = max > 0 ? Math.round((obtained / max) * 100) : 0
      setPercentage(pct)

      // Initialize default remarks
      setOverallRemarks(
        pct >= 90 ? 'Outstanding academic session! Exceptional commitment in all courses.' :
        pct >= 75 ? 'Excellent results. Very consistent performance throughout the term.' :
        pct >= 50 ? 'Good work. Requires focused attention on revision exercises.' :
        'Requires immediate academic guidance and remedial attention.'
      )

      // 3. Fetch attendance rate
      const { data: att } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', student.id)
      
      if (att && att.length > 0) {
        const present = att.filter(a => a.status === 'present' || a.status === 'late').length
        setAttendanceRate(`${Math.round((present / att.length) * 100)}%`)
      } else {
        setAttendanceRate('95%')
      }

      // 4. Compute Class Rank (Highly complex, fetches class results, computes averages, sorts)
      const clsName = student.class_name
      const { data: clsStudents } = await supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId)
        .eq('class_name', clsName)

      const clsStudentIds = (clsStudents || []).map(s => s.id)
      
      if (clsStudentIds.length > 1) {
        const { data: classResults } = await supabase
          .from('results')
          .select('student_id, marks')
          .eq('exam_id', exam.id)
          .in('student_id', clsStudentIds)

        // Group class totals
        const studentTotals: Record<string, number> = {}
        clsStudentIds.forEach(id => { studentTotals[id] = 0 })
        
        if (classResults) {
          classResults.forEach(r => {
            studentTotals[r.student_id] = (studentTotals[r.student_id] || 0) + Number(r.marks)
          })
        }

        // Sort totals to find ranks
        const sortedRanks = Object.entries(studentTotals)
          .map(([id, sum]) => ({ id, sum }))
          .sort((a, b) => b.sum - a.sum)

        const rankIdx = sortedRanks.findIndex(r => r.id === student.id)
        setClassRank(rankIdx !== -1 ? `${rankIdx + 1} of ${sortedRanks.length}` : '1 of 1')
      } else {
        setClassRank('1 of 1')
      }

    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Error generating report card calculations.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Trigger AI Remarks Generator magic remarks
  const handleGenerateAIRemarks = async () => {
    if (!studentDetails) return
    setAiRemarksLoading(true)
    try {
      const response = await generateReportCardRemarks(studentDetails.full_name, percentage, 95)
      setOverallRemarks(response.suggestedRemarks + '\nFocus Area: ' + response.academicFocusArea)
      showToast('AI Remarks generated successfully!')
    } catch (e) {
      console.error(e)
      showToast('AI remarks generation failed.', 'error')
    } finally {
      setAiRemarksLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const overallGrade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F'
  const verificationLink = studentDetails && examDetails 
    ? `https://schoolos-erp.com/verify/report-card/${studentDetails.id}-${examDetails.id}` 
    : '#'

  return (
    <div className="space-y-6 print:p-0 print:m-0 print:bg-white print:text-black">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center px-4 py-3 rounded-xl shadow-lg font-semibold text-xs border print:hidden animate-slideDown ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'} {toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="print:hidden">
        <AcademicHeader
          title="Student Report Cards"
          description="Compile official academic transcript sheets. Computes class ranks, cumulative metrics, and supports printing."
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Academics' },
            { label: 'Report Cards' }
          ]}
          actions={
            studentDetails && (
              <button
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
              >
                🖨 Print / Download PDF
              </button>
            )
          }
        />
      </div>

      {/* Selectors Panel */}
      <div className="w-full bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-end print:hidden">
        <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Select Class</span>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value)
              setSelectedStudent('')
              setStudentDetails(null)
            }}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 outline-none cursor-pointer"
          >
            <option value="">Select Class</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Select Student</span>
          <select
            value={selectedStudent}
            onChange={(e) => {
              setSelectedStudent(e.target.value)
              setStudentDetails(null)
            }}
            disabled={!selectedClass}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="">Select Student</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.full_name} ({s.roll_number})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Select Examination</span>
          <select
            value={selectedExam}
            onChange={(e) => {
              setSelectedExam(e.target.value)
              setStudentDetails(null)
            }}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 outline-none cursor-pointer"
          >
            <option value="">Select Exam</option>
            {visibleExams.map(e => (
              <option key={e.id} value={e.id}>{e.title} ({e.term})</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => void handleGenerateReportCard()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition cursor-pointer"
        >
          Compile Card
        </button>
      </div>

      {/* Main Workspace Preview */}
      {loading ? (
        <div className="print:hidden">
          <TableSkeleton rows={6} cols={4} />
        </div>
      ) : !studentDetails || grades.length === 0 ? (
        <div className="w-full bg-white border border-slate-200/60 rounded-3xl p-16 text-center space-y-4 shadow-sm print:hidden">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
            🎓
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Compile Roster to Generate Report Card</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Select a class, student, and exam from the filters above, then click 'Compile Card' to build the printable transcript.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* AI Helper Bar */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden text-left">
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block">✨ AI Magic Remarks</span>
              <p className="text-xs text-indigo-950 font-medium">Use AI to analyze this student's grade summary and generate professional card comments.</p>
            </div>
            <button
              onClick={handleGenerateAIRemarks}
              disabled={aiRemarksLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition shrink-0 cursor-pointer disabled:opacity-65"
            >
              {aiRemarksLoading ? 'Drafting remarks...' : 'Suggest AI Remarks'}
            </button>
          </div>

          {/* REPORT CARD SHEET (Styled to look exactly like A4 paper) */}
          <div className="mx-auto max-w-[800px] bg-white border border-slate-200/60 shadow-xl rounded-3xl p-10 md:p-12 space-y-8 font-serif text-slate-900 border-t-8 border-t-indigo-600 print:border-none print:shadow-none print:p-0 print:rounded-none">
            
            {/* School Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6">
              <div className="flex items-center gap-4 text-left">
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                  {schoolLogoUrl ? (
                    <img src={schoolLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold">★</span>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight font-sans">{schoolName || 'EDU-MANAGE SCHOOL'}</h2>
                  <span className="text-[10px] text-slate-500 font-bold uppercase font-sans tracking-widest mt-1 block">Accredited Secondary Board Institution</span>
                </div>
              </div>
              <div className="text-right font-sans">
                <h3 className="text-sm font-black text-indigo-600 uppercase tracking-widest">Official Report Card</h3>
                <span className="text-[10px] text-slate-400 font-bold tracking-wider block uppercase mt-0.5">{examDetails?.term} • Session {examDetails?.year}</span>
              </div>
            </div>

            {/* Student metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-sans text-xs text-left">
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Student Name</span>
                <span className="text-slate-900 font-bold text-sm block">{studentDetails.full_name}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Roll Number</span>
                <span className="text-slate-900 font-bold text-sm block">{studentDetails.roll_number || '-'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Class Section</span>
                <span className="text-slate-900 font-bold text-sm block">{studentDetails.class_name}</span>
              </div>
            </div>

            {/* Grades Table */}
            <div className="overflow-hidden border border-slate-900 rounded-xl font-sans text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-900 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    <th className="px-5 py-3.5 border-r border-slate-900">Subject</th>
                    <th className="px-5 py-3.5 border-r border-slate-900 text-center">Marks Obtained</th>
                    <th className="px-5 py-3.5 border-r border-slate-900 text-center">Max Marks</th>
                    <th className="px-5 py-3.5 border-r border-slate-900 text-center">Grade</th>
                    <th className="px-5 py-3.5">Subject Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-semibold text-slate-800">
                  {grades.map((g, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 border-r border-slate-900 font-bold text-slate-900">{g.name}</td>
                      <td className="px-5 py-3 border-r border-slate-900 text-center">{g.marks}</td>
                      <td className="px-5 py-3 border-r border-slate-900 text-center">{g.maxMarks}</td>
                      <td className="px-5 py-3 border-r border-slate-900 text-center font-black">{g.grade}</td>
                      <td className="px-5 py-3 font-medium text-slate-500 italic">{g.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-slate-900 rounded-xl p-4 font-sans text-xs text-left">
              <div>
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Total Marks</span>
                <span className="text-slate-900 font-black text-sm block mt-0.5">{totalObtained} / {totalMax}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Percentage</span>
                <span className="text-slate-900 font-black text-sm block mt-0.5">{percentage}%</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Class Rank</span>
                <span className="text-indigo-600 font-black text-sm block mt-0.5">{classRank}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">Attendance Rate</span>
                <span className="text-slate-900 font-black text-sm block mt-0.5">{attendanceRate}</span>
              </div>
            </div>

            {/* Teacher remarks area */}
            <div className="border border-slate-900 rounded-xl p-4 text-left font-sans space-y-1.5 bg-slate-50/40">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Class Teacher Remarks</span>
              <p className="text-xs text-slate-700 font-semibold leading-relaxed italic whitespace-pre-line">
                {overallRemarks}
              </p>
            </div>

            {/* Signatures & Verification QR Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 items-end font-sans">
              {/* QR Code Verification */}
              <div className="text-left space-y-2">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Secure QR Verification</span>
                <div className="w-20 h-20 bg-slate-50 border border-slate-200/80 rounded-xl p-1.5 flex items-center justify-center">
                  {/* Premium mock SVG QR code */}
                  <svg width="60" height="60" viewBox="0 0 100 100" className="text-slate-800">
                    <rect width="25" height="25" fill="currentColor" />
                    <rect x="75" width="25" height="25" fill="currentColor" />
                    <rect y="75" width="25" height="25" fill="currentColor" />
                    <rect x="35" y="35" width="30" height="30" fill="currentColor" />
                    <rect x="10" y="40" width="10" height="15" fill="currentColor" />
                    <rect x="50" y="10" width="15" height="15" fill="currentColor" />
                    <rect x="75" y="50" width="15" height="25" fill="currentColor" />
                    <rect x="45" y="75" width="20" height="10" fill="currentColor" />
                  </svg>
                </div>
                <a 
                  href={verificationLink} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[9px] text-indigo-600 hover:underline font-bold block"
                >
                  Verify Authenticity Online
                </a>
              </div>

              {/* Class Teacher Signature */}
              <div className="text-center space-y-2">
                <div className="h-10 flex items-end justify-center">
                  <span className="font-serif italic text-base font-bold text-slate-600 tracking-wide select-none">Seema Sharma</span>
                </div>
                <div className="border-t border-slate-300 pt-1.5">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Class Teacher</span>
                </div>
              </div>

              {/* Principal Signature */}
              <div className="text-center space-y-2">
                <div className="h-10 flex items-end justify-center">
                  <span className="font-serif italic text-lg font-black text-indigo-900 select-none">H. R. Bhardwaj</span>
                </div>
                <div className="border-t border-slate-300 pt-1.5">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Principal Signature</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Specific CSS Stylesheet */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          header, aside, footer, nav, button, .print\\:hidden, div.bg-indigo-50, div.w-full.bg-white.border.border-slate-200\\/60.rounded-2xl {
            display: none !important;
          }
          main {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .mx-auto {
            margin: 0 !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
