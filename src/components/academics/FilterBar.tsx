import React from 'react'

type Option = {
  id: string
  name: string
}

type FilterBarProps = {
  selectedYear?: string
  onChangeYear?: (year: string) => void
  years?: string[]

  selectedClass?: string
  onChangeClass?: (classId: string) => void
  classes?: Option[]

  selectedSection?: string
  onChangeSection?: (section: string) => void
  sections?: string[]

  selectedSubject?: string
  onChangeSubject?: (subjectId: string) => void
  subjects?: Option[]

  selectedExam?: string
  onChangeExam?: (examId: string) => void
  exams?: Option[]

  showYear?: boolean
  showClass?: boolean
  showSection?: boolean
  showSubject?: boolean
  showExam?: boolean

  loading?: boolean
}

export default function FilterBar({
  selectedYear = '2026',
  onChangeYear,
  years = ['2026', '2027'],
  selectedClass = '',
  onChangeClass,
  classes = [],
  selectedSection = 'A',
  onChangeSection,
  sections = ['A', 'B', 'C', 'D'],
  selectedSubject = '',
  onChangeSubject,
  subjects = [],
  selectedExam = '',
  onChangeExam,
  exams = [],
  showYear = false,
  showClass = false,
  showSection = false,
  showSubject = false,
  showExam = false,
  loading = false
}: FilterBarProps) {
  return (
    <div className="w-full bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between">
      <div className="flex flex-wrap gap-3 items-center flex-1 min-w-0">
        {/* Academic Year Filter */}
        {showYear && onChangeYear && (
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">Year</span>
            <select
              value={selectedYear}
              onChange={(e) => onChangeYear(e.target.value)}
              disabled={loading}
              className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-indigo-500/20 cursor-pointer min-w-[100px]"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {/* Class Filter */}
        {showClass && onChangeClass && (
          <div className="flex flex-col gap-1 flex-1 min-w-[120px] max-w-[200px]">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">Class</span>
            <select
              value={selectedClass}
              onChange={(e) => onChangeClass(e.target.value)}
              disabled={loading}
              className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-indigo-500/20 cursor-pointer w-full"
            >
              <option value="" className="text-slate-400 font-semibold">Select Class</option>
              {classes.map(c => (
                <option key={c.id} value={c.id} className="text-slate-800 font-semibold">{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Section Filter */}
        {showSection && onChangeSection && (
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">Section</span>
            <select
              value={selectedSection}
              onChange={(e) => onChangeSection(e.target.value)}
              disabled={loading}
              className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-indigo-500/20 cursor-pointer min-w-[80px]"
            >
              {sections.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Exam Filter */}
        {showExam && onChangeExam && (
          <div className="flex flex-col gap-1 flex-1 min-w-[140px] max-w-[220px]">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">Exam</span>
            <select
              value={selectedExam}
              onChange={(e) => onChangeExam(e.target.value)}
              disabled={loading}
              className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-indigo-500/20 cursor-pointer w-full"
            >
              <option value="" className="text-slate-400 font-semibold">Select Exam</option>
              {exams.map(e => (
                <option key={e.id} value={e.id} className="text-slate-800 font-semibold">{e.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Subject Filter */}
        {showSubject && onChangeSubject && (
          <div className="flex flex-col gap-1 flex-1 min-w-[130px] max-w-[220px]">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest pl-0.5">Subject</span>
            <select
              value={selectedSubject}
              onChange={(e) => onChangeSubject(e.target.value)}
              disabled={loading}
              className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-indigo-500/20 cursor-pointer w-full"
            >
              <option value="" className="text-slate-400 font-semibold">Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id} className="text-slate-800 font-semibold">{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 animate-pulse bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
          <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          Updating filters...
        </div>
      )}
    </div>
  )
}

