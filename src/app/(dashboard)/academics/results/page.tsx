'use client'

import { useState, useEffect, useRef, useTransition, useMemo } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useSchool } from '../../../../lib/SchoolContext'
import AcademicHeader from '../../../../components/academics/AcademicHeader'
import FilterBar from '../../../../components/academics/FilterBar'
import { TableSkeleton } from '../../../../components/academics/LoadingSkeleton'

type Student = {
  id: string
  full_name: string
  roll_number?: string
  class_name: string
  section?: string
}

type SubjectOption = { id: string; name: string }
type ExamOption = { id: string; name: string; term: string; year: string; class_id: string }
type ClassOption = { id: string; name: string }

type ResultRecord = {
  id?: string
  student_id: string
  exam_id: string
  subject_id: string
  teacher_id: string | null
  marks: number | ''
  grade: string
  remarks: string
  isModified?: boolean
}

export default function ResultsPage() {
  const { schoolId, userRole } = useSchool()
  const [isPending, startTransition] = useTransition()
  
  // Filter Options State
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [exams, setExams] = useState<ExamOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [years] = useState(['2026', '2027'])
  const [sections] = useState(['A', 'B', 'C', 'D'])

  // Selection States
  const [selectedYear, setSelectedYear] = useState('2026')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('A')
  const [selectedExam, setSelectedExam] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')

  // Loading States
  const [loadingFilters, setLoadingFilters] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)

  // Students & Results States
  const [students, setStudents] = useState<Student[]>([])
  const [resultsMap, setResultsMap] = useState<Record<string, ResultRecord>>({})
  const [teacherId, setTeacherId] = useState<string | null>(null)
  
  // Search & Sorting States
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'roll' | 'marks'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'graded' | 'pending'>('all')

  // Auto-save & Status UI
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle' | 'error'>('idle')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Get current active teacher id
  useEffect(() => {
    async function fetchTeacher() {
      if (!schoolId) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('school_id', schoolId)
          .maybeSingle()

        if (staffData) {
          setTeacherId(staffData.id)
        }
      }
    }
    void fetchTeacher()
  }, [schoolId])

  // Load classes, exams, subjects
  useEffect(() => {
    async function loadFilters() {
      if (!schoolId) return
      setLoadingFilters(true)
      try {
        // Fetch classes
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name', { ascending: true })
        setClasses(classData || [])

        // Fetch subjects
        const { data: subjectData } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name', { ascending: true })
        setSubjects(subjectData || [])

        // Fetch exams
        const { data: examData } = await supabase
          .from('exams')
          .select('id, title, term, year, class_id')
          .eq('school_id', schoolId)
        
        const formattedExams = (examData || []).map(ex => ({
          id: ex.id,
          name: `${ex.title} (${ex.term} - ${ex.year})`,
          term: ex.term,
          year: ex.year,
          class_id: ex.class_id
        }))
        setExams(formattedExams)
      } catch (e) {
        console.error('Error loading filters:', e)
      } finally {
        setLoadingFilters(false)
      }
    }
    void loadFilters()
  }, [schoolId])

  const visibleExams = useMemo(() => {
    if (!selectedClass) return []
    return exams.filter(ex => ex.class_id === selectedClass)
  }, [selectedClass, exams])

  // Reset selected exam if the class changes and previous exam is not in new list
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

  // Fetch Students & Marks on filter change
  const loadStudentsAndMarks = async () => {
    if (!selectedClass || !selectedExam || !selectedSubject) {
      setStudents([])
      setResultsMap({})
      return
    }

    setLoadingStudents(true)
    setErrorMsg('')
    try {
      const clsName = classes.find(c => c.id === selectedClass)?.name || ''
      
      // 1. Fetch students in the selected class and section
      const { data: studentsData, error: studsError } = await supabase
        .from('students')
        .select('id, full_name, roll_number, class_name, section')
        .eq('school_id', schoolId)
        .eq('class_name', clsName)
        // Handle section matching. If database section is null, assume 'A'
        // If query section matches or if column is empty and query is 'A'
        .or(`section.eq.${selectedSection},section.is.null`)

      if (studsError) throw studsError

      // Filter locally to match sections strictly if null default is active
      const matchedStudents = (studentsData || []).filter(s => {
        const sec = s.section || 'A'
        return sec === selectedSection
      })

      // 2. Fetch existing results
      const studentIds = matchedStudents.map(s => s.id)
      let existingResults: any[] = []
      
      if (studentIds.length > 0) {
        const { data: resultsData, error: resError } = await supabase
          .from('results')
          .select('*')
          .eq('exam_id', selectedExam)
          .eq('subject_id', selectedSubject)
          .in('student_id', studentIds)

        if (resError) throw resError
        existingResults = resultsData || []
      }

      // 3. Map results
      const rMap: Record<string, ResultRecord> = {}
      matchedStudents.forEach(st => {
        const found = existingResults.find(r => r.student_id === st.id)
        rMap[st.id] = {
          student_id: st.id,
          exam_id: selectedExam,
          subject_id: selectedSubject,
          teacher_id: teacherId,
          marks: found ? Number(found.marks) : '',
          grade: found ? found.grade : '',
          remarks: found ? found.remarks || '' : '',
          id: found ? found.id : undefined,
          isModified: false
        }
      })

      setStudents(matchedStudents)
      setResultsMap(rMap)
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to load students list.', 'error')
    } finally {
      setLoadingStudents(false)
    }
  }

  useEffect(() => {
    void loadStudentsAndMarks()
  }, [selectedClass, selectedSection, selectedExam, selectedSubject, teacherId])

  // Grade helper
  const calculateGrade = (marks: number) => {
    if (marks >= 90) return 'A+'
    if (marks >= 80) return 'A'
    if (marks >= 70) return 'B'
    if (marks >= 60) return 'C'
    if (marks >= 50) return 'D'
    return 'F'
  }

  // Handle Mark / Remarks change
  const handleRecordChange = (studentId: string, field: 'marks' | 'remarks', value: string) => {
    setResultsMap(prev => {
      const current = prev[studentId]
      let updatedMarks = current.marks
      let updatedGrade = current.grade
      let updatedRemarks = current.remarks

      if (field === 'marks') {
        const parsed = value === '' ? '' : Number(value)
        if (parsed !== '' && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
          return prev // Cancel out-of-bounds inputs
        }
        updatedMarks = parsed
        updatedGrade = parsed === '' ? '' : calculateGrade(parsed)
      } else {
        updatedRemarks = value
      }

      return {
        ...prev,
        [studentId]: {
          ...current,
          marks: updatedMarks,
          grade: updatedGrade,
          remarks: updatedRemarks,
          isModified: true
        }
      }
    })
    setSaveStatus('idle')
  }

  // Save single result record
  const saveSingleRecord = async (record: ResultRecord) => {
    setSaveStatus('saving')
    try {
      const payload = {
        student_id: record.student_id,
        exam_id: record.exam_id,
        subject_id: record.subject_id,
        teacher_id: record.teacher_id,
        marks: record.marks === '' ? 0 : record.marks,
        grade: record.grade || 'F',
        remarks: record.remarks
      }

      const { data, error } = await supabase
        .from('results')
        .upsert(payload, { onConflict: 'student_id,exam_id,subject_id' })
        .select()

      if (error) throw error

      setResultsMap(prev => ({
        ...prev,
        [record.student_id]: {
          ...prev[record.student_id],
          id: data?.[0]?.id || prev[record.student_id].id,
          isModified: false
        }
      }))
      setSaveStatus('saved')
    } catch (e) {
      console.error(e)
      setSaveStatus('error')
    }
  }

  // Auto-save trigger on input focus blur
  const handleInputBlur = (studentId: string) => {
    const record = resultsMap[studentId]
    if (record && record.isModified) {
      void saveSingleRecord(record)
    }
  }

  // Save all modified results
  const handleBulkSave = async () => {
    const modifiedRecords = Object.values(resultsMap).filter(r => r.isModified)
    if (modifiedRecords.length === 0) {
      showToast('No unsaved changes detected.')
      return
    }

    setSaveStatus('saving')
    try {
      const payload = modifiedRecords.map(r => ({
        student_id: r.student_id,
        exam_id: r.exam_id,
        subject_id: r.subject_id,
        teacher_id: r.teacher_id,
        marks: r.marks === '' ? 0 : r.marks,
        grade: r.grade || 'F',
        remarks: r.remarks
      }))

      const { error } = await supabase
        .from('results')
        .upsert(payload, { onConflict: 'student_id,exam_id,subject_id' })

      if (error) throw error

      // Mark all as saved
      setResultsMap(prev => {
        const updated = { ...prev }
        modifiedRecords.forEach(r => {
          updated[r.student_id].isModified = false
        })
        return updated
      })

      setSaveStatus('saved')
      showToast('All student grades saved successfully.')
    } catch (e: any) {
      console.error(e)
      setSaveStatus('error')
      showToast(e.message || 'Failed to perform bulk save.', 'error')
    }
  }

  // Filter and sort students list
  const getProcessedStudents = () => {
    let result = [...students]

    // Search query filter
    if (searchQuery) {
      result = result.filter(st => st.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(st => {
        const rec = resultsMap[st.id]
        const hasMarks = rec && rec.marks !== ''
        return statusFilter === 'graded' ? hasMarks : !hasMarks
      })
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a.full_name
      let valB: any = b.full_name

      if (sortBy === 'roll') {
        valA = Number(a.roll_number) || 9999
        valB = Number(b.roll_number) || 9999
      } else if (sortBy === 'marks') {
        const recA = resultsMap[a.id]
        const recB = resultsMap[b.id]
        valA = recA && recA.marks !== '' ? Number(recA.marks) : -1
        valB = recB && recB.marks !== '' ? Number(recB.marks) : -1
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return result
  }

  const [errorMsg, setErrorMsg] = useState('')
  const processedStudents = getProcessedStudents()
  const isClassSelected = selectedClass !== '' && selectedExam !== '' && selectedSubject !== ''

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center px-4 py-3 rounded-xl shadow-lg font-semibold text-xs border animate-slideDown ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'} {toast.message}</span>
        </div>
      )}

      {/* Header */}
      <AcademicHeader
        title="Gradebook & Results"
        description="Enter, update, and manage student examination marks. Grades are automatically computed based on standard scales."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Academics' },
          { label: 'Results' }
        ]}
        actions={
          isClassSelected && (
            <div className="flex items-center gap-3">
              {/* Save State Pill */}
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                saveStatus === 'saved' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                saveStatus === 'saving' ? 'bg-amber-50 border-amber-100 text-amber-600 animate-pulse' :
                saveStatus === 'error' ? 'bg-rose-50 border-rose-100 text-rose-600 animate-bounce' :
                'bg-slate-50 border-slate-250/60 text-slate-500'
              }`}>
                {saveStatus === 'saved' ? '✓ Saved (Auto)' :
                 saveStatus === 'saving' ? '⚡ Saving...' :
                 saveStatus === 'error' ? '⚠️ Save Error' :
                 '✓ Cloud Connected'}
              </span>

              <button
                onClick={() => void handleBulkSave()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
              >
                Save All
              </button>
            </div>
          )
        }
      />

      {/* Filter Selector Panel */}
      <FilterBar
        showYear={true}
        showClass={true}
        showSection={true}
        showExam={true}
        showSubject={true}
        selectedYear={selectedYear}
        onChangeYear={setSelectedYear}
        selectedClass={selectedClass}
        onChangeClass={setSelectedClass}
        selectedSection={selectedSection}
        onChangeSection={setSelectedSection}
        selectedExam={selectedExam}
        onChangeExam={setSelectedExam}
        selectedSubject={selectedSubject}
        onChangeSubject={setSelectedSubject}
        classes={classes}
        exams={visibleExams}
        subjects={subjects}
        loading={loadingFilters}
      />

      {/* Results Workspace */}
      {!isClassSelected ? (
        <div className="w-full bg-white border border-slate-200/60 rounded-3xl p-16 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
            📊
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Select Filters to Load Gradebook</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Please choose a Class, Section, Exam, and Subject from the drop-downs above to display matching student grading templates.
            </p>
          </div>
        </div>
      ) : loadingStudents ? (
        <TableSkeleton rows={6} cols={5} />
      ) : students.length === 0 ? (
        <div className="w-full bg-white border border-slate-200/60 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
            👥
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">No Students Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No students are currently registered in this class and section. Please check the section filters.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sorting / Search Header */}
          <div className="w-full bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between">
            <div className="w-full max-w-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition">
              <span className="text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Search students in this list..."
                className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder-slate-400 focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-4 items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Filter status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 outline-none text-xs cursor-pointer"
                >
                  <option value="all">All Students</option>
                  <option value="graded">Graded Only</option>
                  <option value="pending">Ungraded Only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 outline-none text-xs cursor-pointer"
                >
                  <option value="name">Student Name</option>
                  <option value="roll">Roll Number</option>
                  <option value="marks">Marks Obtained</option>
                </select>
                
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-600 transition text-xs cursor-pointer"
                >
                  {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </div>
          </div>

          {/* Results Grid Table */}
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4 w-[8%] text-center">Roll No</th>
                  <th className="px-6 py-4 w-[25%]">Student</th>
                  <th className="px-6 py-4 w-[15%] text-center">Marks (max 100)</th>
                  <th className="px-6 py-4 w-[10%] text-center">Grade</th>
                  <th className="px-6 py-4 w-[42%]">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                {processedStudents.map((st) => {
                  const record = resultsMap[st.id] || { marks: '', grade: '', remarks: '' }
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 text-center font-bold text-slate-400">
                        {st.roll_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-900 font-bold">
                        {st.full_name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="-"
                            value={record.marks}
                            onChange={(e) => handleRecordChange(st.id, 'marks', e.target.value)}
                            onBlur={() => handleInputBlur(st.id)}
                            className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-bold text-slate-800 transition"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            record.grade === 'A+' || record.grade === 'A' ? 'bg-emerald-50 text-emerald-700' :
                            record.grade === 'B' || record.grade === 'C' ? 'bg-indigo-50 text-indigo-700' :
                            record.grade === 'D' ? 'bg-amber-50 text-amber-700' :
                            record.grade === 'F' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-400'
                          }`}>
                            {record.grade || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          placeholder="Add teacher remarks..."
                          value={record.remarks}
                          onChange={(e) => handleRecordChange(st.id, 'remarks', e.target.value)}
                          onBlur={() => handleInputBlur(st.id)}
                          className="w-full bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent focus:border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-medium transition"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
