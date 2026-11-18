'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useSchool } from '../../../../lib/SchoolContext'
import AcademicHeader from '../../../../components/academics/AcademicHeader'
import { TableSkeleton } from '../../../../components/academics/LoadingSkeleton'

type Subject = {
  id: string
  name: string
  created_at: string
}

export default function SubjectsPage() {
  const { schoolId, userRole } = useSchool()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [targetSubject, setTargetSubject] = useState<Subject | null>(null)
  const [subjectName, setSubjectName] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchSubjects = async () => {
    if (!schoolId) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true })

      if (error) throw error
      setSubjects(data || [])
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to fetch subjects.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchSubjects()
  }, [schoolId])

  const handleOpenAddModal = () => {
    setModalMode('add')
    setSubjectName('')
    setTargetSubject(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (subject: Subject) => {
    setModalMode('edit')
    setSubjectName(subject.name)
    setTargetSubject(subject)
    setIsModalOpen(true)
  }

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subjectName.trim()) {
      showToast('Subject name cannot be empty.', 'error')
      return
    }
    if (!schoolId) return

    setSaving(true)
    try {
      if (modalMode === 'add') {
        const { error } = await supabase
          .from('subjects')
          .insert({
            school_id: schoolId,
            name: subjectName.trim()
          })

        if (error) throw error
        showToast('Subject added successfully.')
      } else {
        if (!targetSubject) return
        const { error } = await supabase
          .from('subjects')
          .update({ name: subjectName.trim() })
          .eq('id', targetSubject.id)

        if (error) throw error
        showToast('Subject updated successfully.')
      }
      setIsModalOpen(false)
      void fetchSubjects()
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to save subject.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSubject = async (subjectId: string) => {
    if (!confirm('Are you sure you want to delete this subject? All associated homework and exam marks will be deleted.')) return

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)

      if (error) throw error
      showToast('Subject deleted successfully.')
      void fetchSubjects()
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'Failed to delete subject.', 'error')
    }
  }

  const filteredSubjects = subjects.filter(sub =>
    sub.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
        title="Subjects Directory"
        description="View and manage the academic courses and subjects taught across all class rooms."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Academics' },
          { label: 'Subjects' }
        ]}
        actions={
          isEditable ? (
            <button
              onClick={handleOpenAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              + Create Subject
            </button>
          ) : undefined
        }
      />

      {/* Search Filter */}
      <div className="w-full max-w-md bg-white border border-slate-200/60 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition">
        <span className="text-slate-400">🔍</span>
        <input
          type="text"
          placeholder="Search subjects..."
          className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder-slate-400 focus:outline-none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Main Contents */}
      {loading ? (
        <TableSkeleton rows={5} cols={2} />
      ) : filteredSubjects.length === 0 ? (
        <div className="w-full bg-white border border-slate-200/60 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
            📚
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">No Subjects Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery ? "No subjects match your query. Try resetting your search filter." : "This school has not set up any courses or subjects yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">Subject Name</th>
                <th className="px-6 py-4">Created Date</th>
                {isEditable && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
              {filteredSubjects.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 text-slate-900 font-bold">{sub.name}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(sub.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </td>
                  {isEditable && (
                    <td className="px-6 py-4 text-right flex justify-end gap-2.5">
                      <button
                        onClick={() => handleOpenEditModal(sub)}
                        className="text-indigo-600 hover:text-indigo-800 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDeleteSubject(sub.id)}
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
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 animate-scaleUp">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-slate-900">
                {modalMode === 'add' ? 'Create New Subject' : 'Modify Course Name'}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Enter the name of the subject as you would like it to display across exams, grades, and schedules.
              </p>
            </div>
            
            <form onSubmit={handleSaveSubject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">
                  Subject Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Physics, World History"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-xs text-slate-800 font-bold"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Subject'}
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
