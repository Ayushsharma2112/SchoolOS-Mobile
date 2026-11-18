'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useSchool } from '../../../../lib/SchoolContext'
import AcademicHeader from '../../../../components/academics/AcademicHeader'
import { TableSkeleton } from '../../../../components/academics/LoadingSkeleton'
import { generateHomeworkSuggestion } from '../../../../lib/services/ai'

type Homework = {
  id: string
  title: string
  description: string
  due_date: string
  submission_required: boolean
  max_marks: number
  status: 'Draft' | 'Published' | 'Archived'
  visibility: string
  section: string
  created_at: string
  pdf_url?: string
  video_url?: string
  attachments?: string[]
  images?: string[]
  subjects?: { name: string }
  classes?: { name: string }
  staff?: { full_name: string }
  subject_id: string
  class_id: string
}

type SubjectOption = { id: string; name: string }
type ClassOption = { id: string; name: string }

export default function HomeworkPage() {
  const { schoolId, userRole } = useSchool()
  const [homeworkList, setHomeworkList] = useState<Homework[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [loading, setLoading] = useState(true)

  // Filtering
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilter, setClassFilter] = useState('All')
  const [subjectFilter, setSubjectFilter] = useState('All')

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [targetHomework, setTargetHomework] = useState<Homework | null>(null)
  const [saving, setSaving] = useState(false)

  // Form Fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [section, setSection] = useState('A')
  const [dueDate, setDueDate] = useState('')
  const [subRequired, setSubRequired] = useState(false)
  const [maxMarks, setMaxMarks] = useState(100)
  const [hwStatus, setHwStatus] = useState<'Draft' | 'Published'>('Published')
  const [visibility, setVisibility] = useState('students')
  
  // Attachments fields
  const [pdfUrl, setPdfUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  // AI Assistance states
  const [aiPromptTopic, setAiPromptTopic] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Current authenticated staff (teacher) ID
  const [teacherId, setTeacherId] = useState<string | null>(null)
  
  // Toast notify
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch initial active teacher ID
  useEffect(() => {
    async function getStaff() {
      if (!schoolId) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase
          .from('staff')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('school_id', schoolId)
          .maybeSingle()
        if (data) setTeacherId(data.id)
      }
    }
    void getStaff()
  }, [schoolId])

  // Fetch filters and homework
  const fetchFiltersAndData = async () => {
    if (!schoolId) return
    try {
      setLoading(true)
      
      // Fetch subjects & classes
      const { data: subs } = await supabase.from('subjects').select('id, name').eq('school_id', schoolId)
      setSubjects(subs || [])

      const { data: cls } = await supabase.from('classes').select('id, name').eq('school_id', schoolId)
      setClasses(cls || [])

      // Fetch homework with join references
      const { data: hw, error } = await supabase
        .from('homework')
        .select(`
          *,
          subjects(name),
          classes(name),
          staff(full_name)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setHomeworkList(hw || [])
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to fetch homework listings.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchFiltersAndData()
  }, [schoolId])

  const handleOpenAddModal = () => {
    setModalMode('add')
    setTitle('')
    setDescription('')
    setSelectedSubject(subjects[0]?.id || '')
    setSelectedClass(classes[0]?.id || '')
    setSection('A')
    
    // Set default due date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDueDate(tomorrow.toISOString().split('T')[0])
    
    setSubRequired(false)
    setMaxMarks(100)
    setHwStatus('Published')
    setVisibility('students')
    setPdfUrl('')
    setVideoUrl('')
    setAiPromptTopic('')
    setTargetHomework(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (hw: Homework) => {
    setModalMode('edit')
    setTitle(hw.title)
    setDescription(hw.description)
    setSelectedSubject(hw.subject_id)
    setSelectedClass(hw.class_id)
    setSection(hw.section)
    setDueDate(hw.due_date)
    setSubRequired(hw.submission_required)
    setMaxMarks(hw.max_marks)
    setHwStatus(hw.status === 'Archived' ? 'Published' : hw.status)
    setVisibility(hw.visibility || 'students')
    setPdfUrl(hw.pdf_url || '')
    setVideoUrl(hw.video_url || '')
    setAiPromptTopic('')
    setTargetHomework(hw)
    setIsModalOpen(true)
  }

  const handleSaveHomework = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dueDate || !selectedSubject || !selectedClass) {
      showToast('Please fill out all required fields.', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        school_id: schoolId,
        teacher_id: teacherId,
        subject_id: selectedSubject,
        class_id: selectedClass,
        section,
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate,
        submission_required: subRequired,
        max_marks: Number(maxMarks),
        status: hwStatus,
        visibility,
        pdf_url: pdfUrl.trim() || null,
        video_url: videoUrl.trim() || null
      }

      if (modalMode === 'add') {
        const { error } = await supabase.from('homework').insert(payload)
        if (error) throw error
        showToast('Homework assignment published successfully.')
      } else {
        if (!targetHomework) return
        const { error } = await supabase
          .from('homework')
          .update(payload)
          .eq('id', targetHomework.id)
        if (error) throw error
        showToast('Homework details updated successfully.')
      }

      setIsModalOpen(false)
      void fetchFiltersAndData()
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Error saving homework.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteHomework = async (id: string) => {
    if (!confirm('Are you sure you want to delete this homework? This action is permanent.')) return
    try {
      const { error } = await supabase.from('homework').delete().eq('id', id)
      if (error) throw error
      showToast('Homework assignment deleted.')
      void fetchFiltersAndData()
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to delete homework.', 'error')
    }
  }

  // Trigger AI Magic generation suggestion
  const handleTriggerAISuggestion = async () => {
    const subName = subjects.find(s => s.id === selectedSubject)?.name || 'Mathematics'
    const clsName = classes.find(c => c.id === selectedClass)?.name || 'Class 5'

    if (!aiPromptTopic.trim()) {
      showToast('Please enter a lesson topic/prompt for the AI Assistant.', 'error')
      return
    }

    setAiLoading(true)
    try {
      const result = await generateHomeworkSuggestion(subName, aiPromptTopic.trim(), clsName)
      setTitle(result.suggestedTitle)
      setDescription(result.suggestedDescription)
      setMaxMarks(result.suggestedMaxMarks)
      showToast('AI suggestions generated! Review details below.')
    } catch (e) {
      console.error(e)
      showToast('AI Generator failed. Please try again.', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  // Filters logic
  const filteredHomework = homeworkList.filter(hw => {
    const matchesSearch = hw.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          hw.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClass = classFilter === 'All' || hw.class_id === classFilter
    const matchesSubject = subjectFilter === 'All' || hw.subject_id === subjectFilter
    return matchesSearch && matchesClass && matchesSubject
  })

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
        title="Homework Assignments"
        description="Create and assign homework, upload reference materials, and configure submission expectations for students."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Academics' },
          { label: 'Homework' }
        ]}
        actions={
          userRole !== 'Accountant' && userRole !== 'Receptionist' ? (
            <button
              onClick={handleOpenAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              + Create Homework
            </button>
          ) : undefined
        }
      />

      {/* Filters Bar */}
      <div className="w-full bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center flex-1 min-w-0">
          <div className="w-full max-w-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition">
            <span className="text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Search homework details..."
              className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder-slate-400 focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest pl-1">Class</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-50 border border-slate-250/60 text-slate-700 font-bold text-xs rounded-xl px-3 py-2 outline-none transition focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="All">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest pl-1">Subject</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-slate-50 border border-slate-250/60 text-slate-700 font-bold text-xs rounded-xl px-3 py-2 outline-none transition focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="All">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Contents */}
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : filteredHomework.length === 0 ? (
        <div className="w-full bg-white border border-slate-200/60 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
            ✍️
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">No Homework Assigned</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || classFilter !== 'All' || subjectFilter !== 'All' 
                ? "No homework assignments match your filters. Try resetting them." 
                : "There are no active homework tasks published for this school yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHomework.map((hw) => {
            const isOverdue = new Date(hw.due_date) < new Date() && hw.status === 'Published'
            return (
              <div 
                key={hw.id} 
                className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden"
              >
                {/* Due Date Indicator */}
                <div className={`absolute top-0 right-0 px-3.5 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-wider ${
                  isOverdue ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-700'
                }`}>
                  Due: {new Date(hw.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>

                <div className="space-y-3.5">
                  {/* Subject and Status Tags */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                      {hw.subjects?.name || 'General'}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                      hw.status === 'Published' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/30' : 'bg-amber-50 text-amber-700 border border-amber-100/30'
                    }`}>
                      {hw.status}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100/30">
                      Target: {hw.visibility || 'students'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-1">
                      {hw.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-bold block mt-1">
                      For: {hw.classes?.name || 'All'} - Sec {hw.section} | Assigned by: {hw.staff?.full_name || 'Teacher'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-medium line-clamp-3 leading-relaxed">
                    {hw.description}
                  </p>

                  {/* Attachment indicator */}
                  {(hw.pdf_url || hw.video_url) && (
                    <div className="flex gap-2.5 pt-1">
                      {hw.pdf_url && (
                        <a 
                          href={hw.pdf_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                        >
                          📄 Reference PDF
                        </a>
                      )}
                      {hw.video_url && (
                        <a 
                          href={hw.video_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] font-bold text-violet-600 hover:underline flex items-center gap-1"
                        >
                          🎥 Lesson Video
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100/80 pt-4 mt-5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Submissions</span>
                    <span className="text-xs font-black text-slate-800">
                      {hw.submission_required ? `Required (max ${hw.max_marks}m)` : 'Read & Study'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(hw)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-600 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDeleteHomework(hw.id)}
                      className="bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Homework Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-scaleUp my-8">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-slate-900">
                {modalMode === 'add' ? 'Publish Homework Task' : 'Modify Homework Details'}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Distribute assignments to classes, upload study links, or use AI Magic recommendations.
              </p>
            </div>

            {/* AI Assistant Section */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2.5">
              <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                ✨ SchoolOS AI Homework Assistant
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask AI: e.g. Fractions and Decimals, Photosynthesis lab"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={aiPromptTopic}
                  onChange={(e) => setAiPromptTopic(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleTriggerAISuggestion}
                  disabled={aiLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl transition active:scale-95 disabled:opacity-60 cursor-pointer shrink-0"
                >
                  {aiLoading ? 'Thinking...' : 'AI Suggest'}
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSaveHomework} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                  Homework Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 3 Calculus Problems"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                  Instructions / Description
                </label>
                <textarea
                  placeholder="Describe the tasks, read materials, questions, or links required..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-medium resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Class Target
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold bg-white cursor-pointer"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Subject Course
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold bg-white cursor-pointer"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Section
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold bg-white cursor-pointer"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold bg-white"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Publish Status
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold bg-white cursor-pointer"
                    value={hwStatus}
                    onChange={(e) => setHwStatus(e.target.value as any)}
                  >
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Visibility Target
                  </label>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold bg-white cursor-pointer"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                  >
                    <option value="students">Students</option>
                    <option value="All">All Portal Users</option>
                    <option value="parents">Parents Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Reference PDF URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/sheet.pdf"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                    Lesson Video URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-4 p-4 border border-slate-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sub-req"
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    checked={subRequired}
                    onChange={(e) => setSubRequired(e.target.checked)}
                  />
                  <label htmlFor="sub-req" className="text-xs font-bold text-slate-700">
                    File Submission Required
                  </label>
                </div>
                
                {subRequired && (
                  <div className="flex items-center gap-2 flex-1 animate-fadeIn">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Max Marks</span>
                    <input
                      type="number"
                      className="w-16 border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-center"
                      value={maxMarks}
                      onChange={(e) => setMaxMarks(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3.5 rounded-xl transition active:scale-95 disabled:opacity-60 cursor-pointer text-center"
                >
                  {saving ? 'Publishing...' : 'Save & Publish'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 font-bold text-xs py-3.5 rounded-xl transition active:scale-95 cursor-pointer"
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
