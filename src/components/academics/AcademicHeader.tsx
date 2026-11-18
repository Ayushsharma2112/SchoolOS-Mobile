import React from 'react'

type Breadcrumb = {
  label: string
  href?: string
}

type AcademicHeaderProps = {
  title: string
  description?: string
  breadcrumbs: Breadcrumb[]
  actions?: React.ReactNode
}

export default function AcademicHeader({ title, description, breadcrumbs, actions }: AcademicHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200/60 pb-6 mb-6 gap-4">
      <div className="space-y-1.5 min-w-0">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-300">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-indigo-600 transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-slate-500">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Title */}
        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
          {title}
        </h1>

        {/* Description */}
        {description && (
          <p className="text-xs text-slate-500 font-medium max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
          {actions}
        </div>
      )}
    </div>
  )
}
