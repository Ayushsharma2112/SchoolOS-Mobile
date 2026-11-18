'use client'

import AcademicHeader from '../../../components/academics/AcademicHeader'

type Route = {
  id: string
  route: string
  driver: string
  contact: string
  status: 'On Route' | 'Completed' | 'Idle'
  capacity: string
}

export default function TransportPage() {
  const routes: Route[] = [
    { id: 'BUS-01', route: 'Route A: Vasant Kunj - Saket', driver: 'Vijay Singh', contact: '+91 98112 03948', status: 'On Route', capacity: '35 / 40' },
    { id: 'BUS-02', route: 'Route B: Dwarka Sector 6 - Janakpuri', driver: 'Rajesh Yadav', contact: '+91 88261 90812', status: 'Completed', capacity: '28 / 40' },
    { id: 'BUS-03', route: 'Route C: Rohini Sector 11 - Pitampura', driver: 'Sukhdev Verma', contact: '+91 70119 45291', status: 'Idle', capacity: '12 / 30' },
    { id: 'BUS-04', route: 'Route D: Karol Bagh - Connaught Place', driver: 'Manpreet Singh', contact: '+91 95821 77391', status: 'On Route', capacity: '38 / 40' }
  ]

  return (
    <div className="space-y-6">
      <AcademicHeader 
        title="Transport & Vehicles"
        description="Monitor school bus routes, driver registry, vehicle tracking, and stops timings schedule."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Transport' }
        ]}
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Active Vehicles</span>
          <h3 className="text-xl font-black text-slate-800 mt-1">4 Buses</h3>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Subscribed Students</span>
          <h3 className="text-xl font-black text-indigo-600 mt-1">113 Students</h3>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm text-left">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">On-route Status</span>
          <h3 className="text-xl font-black text-emerald-600 mt-1">2 Live Routes</h3>
        </div>
      </div>

      {/* Visual map mockup & Route list grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        {/* Route List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest border-b border-slate-100 pb-2">Active Transport Routes</h3>
            <div className="space-y-3">
              {routes.map(r => (
                <div key={r.id} className="border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/20">
                  <div className="space-y-1">
                    <strong className="text-xs font-bold text-slate-800 block">{r.route} ({r.id})</strong>
                    <span className="text-[10px] text-slate-400 font-semibold block">Driver: {r.driver} | Call: {r.contact}</span>
                  </div>
                  <div className="flex items-center gap-3.5 justify-between">
                    <span className="text-[10px] text-slate-400 font-bold">Seats: {r.capacity}</span>
                    <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border ${
                      r.status === 'On Route' ? 'bg-indigo-50 text-indigo-700 border-indigo-100 animate-pulse' :
                      r.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map mockup and tracker info */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest border-b border-slate-100 pb-2">GPS Live Tracking Mock</h3>
          <div className="w-full h-48 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-center relative overflow-hidden">
            {/* Draw mock stop markers */}
            <div className="absolute top-1/4 left-1/4 w-3.5 h-3.5 bg-indigo-600 rounded-full border-2 border-white shadow animate-bounce" title="Bus 01" />
            <div className="absolute top-2/3 left-1/2 w-3.5 h-3.5 bg-emerald-650 rounded-full border-2 border-white shadow" title="Bus 02" />
            <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-widest bg-white border border-indigo-100 rounded-lg px-2.5 py-1 z-10 shadow-sm">
              🛰 Map Tracking Online
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
