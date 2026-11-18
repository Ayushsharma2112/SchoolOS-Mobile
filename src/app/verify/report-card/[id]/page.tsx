'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'

type VerificationData = {
  studentName: string
  class_name: string
  roll_number?: string
  examTitle: string
  examTerm: string
  examYear: string
  schoolName: string
  totalObtained: number
  totalMax: number
  percentage: number
  overallGrade: string
  verifiedAt: string
}

export default function ReportCardVerificationPage() {
  const params = useParams()
  const compositeId = params?.id as string
  
  const [loading, setLoading] = useState(true)
  const [verifiedData, setVerifiedData] = useState<VerificationData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!compositeId) return

    async function verifyReportCard() {
      try {
        setLoading(true)
        setErrorMsg('')

        // Composite ID is in format "studentId-examId"
        const parts = compositeId.split('-')
        if (parts.length < 2) {
          throw new Error('Invalid verification identifier format.')
        }

        const studentId = parts[0]
        const examId = parts[1]

        // 1. Fetch student info
        const { data: student, error: studErr } = await supabase
          .from('students')
          .select('full_name, class_name, roll_number, school_id')
          .eq('id', studentId)
          .single()

        if (studErr || !student) {
          throw new Error('Student record could not be verified in registry.')
        }

        // 2. Fetch exam details
        const { data: exam, error: examErr } = await supabase
          .from('exams')
          .select('title, term, year')
          .eq('id', examId)
          .single()

        if (examErr || !exam) {
          throw new Error('Associated exam schedule not found in registry.')
        }

        // 3. Fetch school info
        const { data: school } = await supabase
          .from('schools')
          .select('name')
          .eq('id', student.school_id)
          .single()

        // 4. Fetch results
        const { data: results, error: resErr } = await supabase
          .from('results')
          .select('marks')
          .eq('student_id', studentId)
          .eq('exam_id', examId)

        if (resErr || !results || results.length === 0) {
          throw new Error('Grade records associated with this document are missing.')
        }

        // Calculate totals
        const obtained = results.reduce((sum, r) => sum + Number(r.marks), 0)
        const max = results.length * 100
        const pct = Math.round((obtained / max) * 100)
        const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F'

        setVerifiedData({
          studentName: student.full_name,
          class_name: student.class_name,
          roll_number: student.roll_number,
          examTitle: exam.title,
          examTerm: exam.term,
          examYear: exam.year,
          schoolName: school?.name || 'SchoolOS Institution',
          totalObtained: obtained,
          totalMax: max,
          percentage: pct,
          overallGrade: grade,
          verifiedAt: new Date().toISOString()
        })
      } catch (e: any) {
        console.error(e)
        setErrorMsg(e.message || 'Verification failed. Document may be modified or invalid.')
      } finally {
        setLoading(false)
      }
    }

    void verifyReportCard()
  }, [compositeId])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans text-slate-100">
      {/* Background glow orbs */}
      <div className="absolute top-[-25%] left-[-15%] w-[60%] h-[60%] rounded-full bg-emerald-950/15 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-25%] right-[-15%] w-[60%] h-[60%] rounded-full bg-indigo-950/15 blur-[140px] pointer-events-none" />

      {/* Main Card */}
      <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 text-center">
        
        {loading ? (
          <div className="space-y-4 py-8">
            <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin mx-auto" />
            <span className="text-xs text-slate-400 font-bold block animate-pulse">Running Cryptographic Registry Check...</span>
          </div>
        ) : errorMsg ? (
          <div className="space-y-6 py-6 animate-scaleUp">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto text-3xl">
              ⚠️
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-white">Verification Failed</h2>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                {errorMsg}
              </p>
            </div>
            <div className="bg-rose-950/20 border border-rose-900/40 p-4 rounded-2xl text-[10px] text-rose-300 leading-relaxed font-semibold">
              Warning: This link does not represent an active authenticated document inside the SchoolOS decentralized relational registry.
            </div>
          </div>
        ) : (
          verifiedData && (
            <div className="space-y-6 animate-scaleUp text-left">
              {/* Badge */}
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3.5 py-2 rounded-2xl w-fit mx-auto text-xs font-black tracking-wide uppercase select-none">
                <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                ✓ Certified Verification
              </div>

              <div className="text-center space-y-1">
                <h2 className="text-lg font-black text-white">Transcript Verified</h2>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">SchoolOS ERP Authenticity Registry</p>
              </div>

              {/* Verified Details Box */}
              <div className="bg-slate-950/50 border border-slate-850 p-5 rounded-2xl space-y-4 text-xs font-semibold">
                <div className="space-y-1">
                  <span className="text-slate-500 text-[9px] uppercase tracking-wider block">Issuing Institution</span>
                  <span className="text-white font-extrabold text-sm block">{verifiedData.schoolName}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-3">
                  <div className="space-y-1">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider block">Student Name</span>
                    <span className="text-slate-100 font-bold block">{verifiedData.studentName}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider block">Roll No / Class</span>
                    <span className="text-slate-100 font-bold block">{verifiedData.roll_number || '-'} ({verifiedData.class_name})</span>
                  </div>
                </div>

                <div className="space-y-1 border-t border-slate-900 pt-3">
                  <span className="text-slate-500 text-[9px] uppercase tracking-wider block">Examination Term</span>
                  <span className="text-slate-100 font-bold block">{verifiedData.examTitle} ({verifiedData.examTerm} - {verifiedData.examYear})</span>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-slate-900 pt-3">
                  <div className="space-y-1 text-center">
                    <span className="text-slate-500 text-[8px] uppercase tracking-wider block">Aggregate Marks</span>
                    <span className="text-indigo-400 font-bold text-sm block mt-0.5">{verifiedData.totalObtained}/{verifiedData.totalMax}</span>
                  </div>
                  <div className="space-y-1 text-center">
                    <span className="text-slate-500 text-[8px] uppercase tracking-wider block">Percentage</span>
                    <span className="text-white font-bold text-sm block mt-0.5">{verifiedData.percentage}%</span>
                  </div>
                  <div className="space-y-1 text-center">
                    <span className="text-slate-500 text-[8px] uppercase tracking-wider block">Overall Grade</span>
                    <span className="text-emerald-400 font-black text-sm block mt-0.5">{verifiedData.overallGrade}</span>
                  </div>
                </div>
              </div>

              {/* Footer details */}
              <div className="text-[10px] text-slate-500 leading-relaxed font-semibold text-center border-t border-slate-800/80 pt-4">
                <span>Verified securely via cryptographic record match on:</span>
                <span className="block text-slate-400 mt-1 font-bold">
                  {new Date(verifiedData.verifiedAt).toLocaleString()}
                </span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
