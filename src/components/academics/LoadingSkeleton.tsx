import React from 'react'

type TableSkeletonProps = {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
  return (
    <div className="w-full bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm animate-pulse space-y-4">
      {/* Table Header */}
      <div className="flex gap-4 border-b border-slate-100 pb-4">
        {Array.from({ length: cols }).map((_, idx) => (
          <div key={idx} className="h-4 bg-slate-200 rounded-lg flex-1" />
        ))}
      </div>

      {/* Table Rows */}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div 
                key={cIdx} 
                className={`h-3 bg-slate-100 rounded-lg flex-1 ${cIdx === 0 ? 'w-3/4' : ''}`} 
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

type CardSkeletonProps = {
  count?: number
}

export function CardSkeleton({ count = 3 }: CardSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div 
          key={idx} 
          className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm animate-pulse space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-slate-200 rounded-lg w-2/3" />
              <div className="h-2 bg-slate-100 rounded-lg w-1/3" />
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-lg w-full" />
          <div className="h-2 bg-slate-100 rounded-lg w-5/6" />
          <div className="flex gap-2 justify-end pt-2">
            <div className="w-16 h-7 bg-slate-200 rounded-lg" />
            <div className="w-16 h-7 bg-slate-150 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="h-10 bg-slate-200 rounded-xl w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white border border-slate-200/60 rounded-3xl p-6 h-60 space-y-4">
          <div className="w-20 h-20 bg-slate-200 rounded-full mx-auto" />
          <div className="h-3 bg-slate-200 rounded-lg w-2/3 mx-auto" />
          <div className="h-2.5 bg-slate-100 rounded-lg w-1/2 mx-auto" />
        </div>
        <div className="md:col-span-2 bg-white border border-slate-200/60 rounded-3xl p-6 h-60 space-y-4">
          <div className="h-3 bg-slate-200 rounded-lg w-1/4" />
          <div className="space-y-3">
            <div className="h-2.5 bg-slate-100 rounded-lg w-full" />
            <div className="h-2.5 bg-slate-100 rounded-lg w-5/6" />
            <div className="h-2.5 bg-slate-100 rounded-lg w-4/5" />
            <div className="h-2.5 bg-slate-100 rounded-lg w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
