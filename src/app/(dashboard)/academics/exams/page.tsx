'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useSchool } from '../../../../lib/SchoolContext'
import AcademicHeader from '../../../../components/academics/AcademicHeader'
import { TableSkeleton } from '../../../../components/academics/LoadingSkeleton'

type Exam = {
  id: string
  title: string
  term: string
  year: string
  class_id: string
  classes?: { name: string }
  created_at: string
}

export default function ExamsPage() {
  const { schoolId, userRole } = useSchool()
  const [exams, setExams] = useState<Exam[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [termFilter, setTermFilter] = useState('All')
  const [classFilter, setClassFilter] = useState('All')
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [targetExam, setTargetExam] = useState<Exam | null>(null)
  
  // Form states
  const [examTitle, setExamTitle] = useState('')
  const [examTerm, setExamTerm] = useState('Term 1')
  const [examYear, setExamYear] = useState('2026')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [saving, setSaving] = useState(false)

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchExams = async () => {
    if (!schoolId) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('exams')
        .select('*, classes(name)')
        .eq('school_id', schoolId)
        .order('year', { ascending: false })
        .order('term', { ascending: true })

      if (error) throw error
      setExams(data || [])
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to fetch exams.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchClasses = async () => {
    if (!schoolId) return
    try {
      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name', { ascending: true })
      setClasses(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    void fetchExams()
    void fetchClasses()
  }, [schoolId])

  const handleOpenAddModal = () => {
    setModalMode('add')
    setExamTitle('')
    setExamTerm('Term 1')
    setExamYear('2026')
    setSelectedClassId('')
    setTargetExam(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (exam: Exam) => {
    setModalMode('edit')
    setExamTitle(exam.title)
    setExamTerm(exam.term)
    setExamYear(exam.year)
    setSelectedClassId(exam.class_id || '')
    setTargetExam(exam)
    setIsModalOpen(true)
  }

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!examTitle.trim() || !examYear.trim() || !selectedClassId || !schoolId) {
      showToast('Please fill out all fields.', 'error')
      return
    }

    setSaving(true)
    try {
      if (modalMode === 'add') {
        const { error } = await supabase
          .from('exams')
          .insert({
            school_id: schoolId,
            class_id: selectedClassId,
            title: examTitle.trim(),
            term: examTerm,
            year: examYear.trim()
          })

        if (error) throw error
        showToast('Exam scheduled successfully.')
      } else {
        if (!targetExam) return
        const { error } = await supabase
          .from('exams')
          .update({
            class_id: selectedClassId,
            title: examTitle.trim(),
            term: examTerm,
            year: examYear.trim()
          })
          .eq('id', targetExam.id)

        if (error) throw error
        showToast('Exam updated successfully.')
      }
      setIsModalOpen(false)
      void fetchExams()
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to save exam details.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to delete this exam schedule? All student marks registered under this exam will be deleted.')) return

    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId)

      if (error) throw error
      showToast('Exam schedule deleted successfully.')
      void fetchExams()
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to delete exam.', 'error')
    }
  }

  const filteredExams = exams.filter(ex => {
    const matchesSearch = ex.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ex.year.includes(searchQuery)
    const matchesTerm = termFilter === 'All' || ex.term === termFilter
    const matchesClass = classFilter === 'All' || ex.class_id === classFilter
    return matchesSearch && matchesTerm && matchesClass
  })

  const isEditable = userRole === 'Admin' || userRole === 'SuperAdmin'

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
        title="Examinations & Terms"
        description="Schedule and configure grading exams, mid-terms, and terminal exams for the academic year."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Academics' },
          { label: 'Exams' }
        ]}
        actions={
          isEditable ? (
            <button
              onClick={handleOpenAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              + Create Exam
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="w-full max-w-xs bg-white border border-slate-200/60 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition">
          <span className="text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Search exams or year..."
            className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder-slate-400 focus:outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest pl-1">Class Filter</span>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2 outline-none transition focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="All">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest pl-1">Term Filter</span>
          <select
            value={termFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2 outline-none transition focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="All">All Terms</option>
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Final">Final Term</option>
          </select>
        </div>
      </div>

      {/* Main Contents */}
      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : filteredExams.length === 0 ? (
        <div className="w-full bg-white border border-slate-200/60 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
            📝
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">No Exams Scheduled</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || termFilter !== 'All' ? "No exams match your filters. Try resetting them." : "There are no exams scheduled for this school yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Exam Title</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Academic Term</th>
                <th className="px-6 py-4">Academic Year</th>
                {isEditable && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
              {filteredExams.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 text-slate-900 font-bold">{ex.title}</td>
                  <td className="px-6 py-4 text-indigo-600 font-extrabold">{ex.classes?.name || 'School-wide'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      ex.term === 'Term 1' ? 'bg-indigo-50 text-indigo-700' :
                      ex.term === 'Term 2' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {ex.term}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-bold">{ex.year}</td>
                  {isEditable && (
                    <td className="px-6 py-4 text-right flex justify-end gap-2.5">
                      <button
                        onClick={() => handleOpenEditModal(ex)}
                        className="text-indigo-600 hover:text-indigo-800 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDeleteExam(ex.id)}
                        className="text-rose-600 hover:text-rose-800 transition"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-slate-900">
                {modalMode === 'add' ? 'Schedule New Examination' : 'Modify Examination Details'}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Provide a title, choose the term category, and specify the academic year to structure grades.
              </p>
            </div>
            
            <form onSubmit={handleSaveExam} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                  Exam Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mid-Term 1 Assessment, Half Yearly Exam"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                  Class Room
                </label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold bg-white cursor-pointer"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  required
                >
                  <option value="">Select Class Room</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Academic Term
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold bg-white cursor-pointer"
                    value={examTerm}
                    onChange={(e) => setExamTerm(e.target.value)}
                  >
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Final">Final Term</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2026"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold"
                    value={examYear}
                    onChange={(e) => setExamYear(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Scheduling...' : 'Save Exam'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 font-bold text-xs py-3 rounded-xl transition active:scale-95 cursor-pointer"
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
