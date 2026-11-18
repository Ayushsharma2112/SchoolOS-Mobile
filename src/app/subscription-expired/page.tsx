'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSchool } from '../../lib/SchoolContext'
import { supabase } from '../../lib/supabase'

export default function SubscriptionExpiredPage() {
  const router = useRouter()
  const { 
    schoolName, 
    schoolLogoUrl, 
    userRole, 
    schoolId, 
    subscription, 
    refreshSubscription 
  } = useSchool()

  const [renewing, setRenewing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // 1. Export school data as CSV (restricted to admins)
  const handleDownloadBackup = async () => {
    if (!schoolId) return
    setDownloading(true)
    try {
      const { data, error } = await supabase
        .from('students')
        .select('full_name, parent_name, parent_phone, class_name, gender, date_of_birth, admission_date, address')
        .eq('school_id', schoolId)

      if (error) throw error

      if (!data || data.length === 0) {
        alert('No student records found to back up.')
        return
      }

      // Construct CSV
      const headers = ['Student Name', 'Parent Name', 'Parent Phone', 'Class Name', 'Gender', 'Birth Date', 'Admission Date', 'Address']
      const rows = data.map(s => [
        `"${s.full_name || ''}"`,
        `"${s.parent_name || ''}"`,
        `"${s.parent_phone || ''}"`,
        `"${s.class_name || ''}"`,
        `"${s.gender || ''}"`,
        `"${s.date_of_birth || ''}"`,
        `"${s.admission_date || ''}"`,
        `"${s.address || ''}"`
      ])

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `${schoolName?.toLowerCase().replace(/\s+/g, '_')}_backup_data.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e: any) {
      console.error(e)
      alert(`Backup download failed: ${e.message}`)
    } finally {
      setDownloading(false)
    }
  }

  // 2. Mock renew subscription triggers immediate DB update to professional plan
  const handleRenewSubscription = async () => {
    if (!schoolId || !subscription) return
    setRenewing(true)
    try {
      const renewStart = new Date()
      const renewEnd = new Date(renewStart.getTime() + 30 * 24 * 60 * 60 * 1000)
      const graceEnd = new Date(renewEnd.getTime() + 7 * 24 * 60 * 60 * 1000)

      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan_name: 'Professional',
          status: 'active',
          subscription_start: renewStart.toISOString(),
          subscription_end: renewEnd.toISOString(),
          days_remaining: 30,
          grace_period_end: graceEnd.toISOString(),
          max_students: 1000,
          max_teachers: 100,
          max_admins: 10,
          max_parents: 2000,
          max_branches: 5,
          storage_limit: 10.0,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id)

      if (error) throw error

      // Audit log
      await supabase.from('subscription_audit_logs').insert({
        school_id: schoolId,
        action: 'renewed',
        previous_plan: subscription.plan_name,
        new_plan: 'Professional',
        previous_status: subscription.status,
        new_status: 'active',
        details: { renewal: 'Instant mock renewal triggered' }
      })

      await refreshSubscription()
      router.push('/dashboard')
    } catch (e: any) {
      console.error(e)
      alert(`Renewal failed: ${e.message}`)
    } finally {
      setRenewing(false)
    }
  }

  const daysExpired = subscription?.grace_period_end 
    ? Math.max(1, Math.ceil((new Date().getTime() - new Date(subscription.grace_period_end).getTime()) / (1000 * 60 * 60 * 24)))
    : 1

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full bg-white border border-slate-200/60 rounded-3xl p-8 sm:p-12 shadow-xl text-center space-y-8 relative overflow-hidden">
        
        {/* Subtle Background Accent */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-rose-50/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl" />

        {/* School branding header */}
        <div className="flex items-center justify-center gap-3 select-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-50 to-orange-50 border border-rose-100 flex items-center justify-center overflow-hidden">
            {schoolLogoUrl ? (
              <img src={schoolLogoUrl} alt={schoolName || 'Logo'} className="object-cover w-full h-full" />
            ) : (
              <span className="text-sm font-extrabold text-rose-600">
                {schoolName ? schoolName.charAt(0).toUpperCase() : '★'}
              </span>
            )}
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{schoolName || 'SchoolOS Tenant'}</span>
        </div>

        {/* Premium Warning Illustration */}
        <div className="relative w-48 h-48 mx-auto flex items-center justify-center bg-rose-50/45 border border-rose-100/50 rounded-full shadow-inner">
          <span className="text-7xl animate-pulse">🔒</span>
          <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center font-bold shadow-md shadow-rose-500/10 border-2 border-white">
            ⚠️
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 border border-rose-200 text-rose-700 inline-block animate-bounce">
            Billing Access Blocked
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Subscription Expired</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-semibold max-w-lg mx-auto leading-relaxed">
            Your school space has exceeded the trial or subscription lifecycle limit. The active grace period ended <strong className="text-rose-650 font-black">{daysExpired} {daysExpired === 1 ? 'day' : 'days'} ago</strong>. Please renew to restore immediate full system access.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto select-none">
          <div className="bg-slate-50 border border-slate-100 p-4.5 rounded-2xl text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Last Active Plan</span>
            <span className="text-sm font-extrabold text-slate-800 block mt-1">{subscription?.plan_name || 'Trial Plan'}</span>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-4.5 rounded-2xl text-left">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Days Overdue</span>
            <span className="text-sm font-extrabold text-rose-600 block mt-1">{daysExpired} Days</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center pt-4 border-t border-slate-100">
          <button
            onClick={handleRenewSubscription}
            disabled={renewing}
            className="w-full sm:w-auto bg-gradient-to-tr from-indigo-650 to-violet-650 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-2xl shadow-md shadow-indigo-600/15 active:scale-95 transition cursor-pointer"
          >
            {renewing ? 'Processing Renewal...' : 'Renew Subscription'}
          </button>
          
          <a
            href="mailto:support@schoolos.com?subject=Subscription%20Renewal%2520Help"
            className="w-full sm:w-auto bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-2xl transition active:scale-95 text-center cursor-pointer"
          >
            Contact Support
          </a>

          {/* Admin Backups Action */}
          {userRole === 'Admin' && (
            <button
              onClick={handleDownloadBackup}
              disabled={downloading}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-2xl transition active:scale-95 cursor-pointer"
              title="Download full CSV backup of student profiles"
            >
              {downloading ? 'Exporting...' : '💾 Export Student Data'}
            </button>
          )}
        </div>

        {/* Footer info */}
        {userRole !== 'Admin' && (
          <p className="text-[10px] text-slate-400 font-bold leading-normal pt-2 select-none">
            Only school administrators can manage billing credentials or download raw student rosters.
          </p>
        )}

      </div>
    </div>
  )
}
