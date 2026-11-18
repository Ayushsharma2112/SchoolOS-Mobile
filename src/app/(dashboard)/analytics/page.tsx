'use client'

import AcademicHeader from '../../../components/academics/AcademicHeader'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <AcademicHeader 
        title="Institutional Analytics & Intelligence"
        description="Review high-fidelity analysis logs of student attendance trends, tuition fee collections, and examination GPA distribution curves."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Analytics' }
        ]}
      />

      {/* Grid segments */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
        
        {/* Card 1: Attendance Rate line chart */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-sans">Student Attendance Rate</span>
            <h3 className="text-xl font-black text-slate-800">92.4% Average</h3>
          </div>
          {/* Custom SVG line chart */}
          <div className="h-44 w-full bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-center p-2 relative overflow-hidden">
            <svg viewBox="0 0 100 40" className="w-full h-full text-indigo-600">
              <path
                d="M 0 35 Q 20 25 40 28 T 80 12 T 100 5 L 100 40 L 0 40 Z"
                fill="rgba(79, 70, 229, 0.08)"
                stroke="none"
              />
              <path
                d="M 0 35 Q 20 25 40 28 T 80 12 T 100 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              {/* Markers */}
              <circle cx="40" cy="28" r="1.5" fill="currentColor" />
              <circle cx="80" cy="12" r="1.5" fill="currentColor" />
              <circle cx="100" cy="5" r="1.5" fill="currentColor" />
            </svg>
            <div className="absolute bottom-2 left-3 text-[9px] font-bold text-slate-400">June</div>
            <div className="absolute bottom-2 right-3 text-[9px] font-bold text-slate-400">July</div>
          </div>
        </div>

        {/* Card 2: Tuition Fees revenue bar chart */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-sans">Monthly Tuition Invoicing Collections</span>
            <h3 className="text-xl font-black text-slate-800">82.5% Collected</h3>
          </div>
          {/* Custom SVG bar chart */}
          <div className="h-44 w-full bg-slate-50/50 border border-slate-100 rounded-2xl flex items-end justify-between p-4 relative overflow-hidden">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-6 bg-slate-200 h-24 rounded-lg" />
              <span className="text-[8px] font-bold text-slate-400">May</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-6 bg-slate-200 h-28 rounded-lg" />
              <span className="text-[8px] font-bold text-slate-400">Jun</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-6 bg-indigo-600 h-32 rounded-lg" />
              <span className="text-[8px] font-bold text-slate-500 font-extrabold">Jul</span>
            </div>
          </div>
        </div>

        {/* Card 3: GPA grade bell distribution curve */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-sans">Class Performance Spread</span>
            <h3 className="text-xl font-black text-slate-800">B+ Median GPA</h3>
          </div>
          {/* Custom SVG bell curve chart */}
          <div className="h-44 w-full bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-center p-2 relative overflow-hidden">
            <svg viewBox="0 0 100 40" className="w-full h-full text-violet-600">
              <path
                d="M 5 38 Q 25 38 40 20 T 60 5 T 80 38 L 95 38 L 95 40 L 5 40 Z"
                fill="rgba(139, 92, 246, 0.08)"
                stroke="none"
              />
              <path
                d="M 5 38 Q 25 38 40 20 T 60 5 T 80 38 L 95 38"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line x1="50" y1="5" x2="50" y2="40" stroke="rgba(139, 92, 246, 0.3)" strokeDasharray="2" />
            </svg>
            <div className="absolute bottom-2 left-6 text-[9px] font-bold text-slate-400">Failed (F)</div>
            <div className="absolute bottom-2 right-6 text-[9px] font-bold text-slate-400">Distinction (A+)</div>
          </div>
        </div>

      </div>
    </div>
  )
}
