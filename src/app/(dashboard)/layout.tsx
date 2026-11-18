'use client'

import { useState, Fragment, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/SchoolContext'
import { checkAndGetSubscription } from '../../lib/subscription'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isAcademicsOpen, setIsAcademicsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const {
    schoolId,
    schoolName,
    schoolLogoUrl,
    profile,
    userRole,
    userEmail,
    memberships,
    switchSchool,
    subscription,
    refreshSubscription,
    isLoading
  } = useSchool()

  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false)
  const [dismissedBanner, setDismissedBanner] = useState(false)

  // Subscription stats
  const [subStats, setSubStats] = useState({ students: 0, teachers: 0, admins: 0, storageGB: 0 })
  const [loadingSubStats, setLoadingSubStats] = useState(false)
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null)

  // 1. Load limits metrics
  const loadSubStats = async () => {
    if (!schoolId) return
    setLoadingSubStats(true)
    try {
      const { count: sCount } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)

      const { count: tCount } = await supabase
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'Teacher')

      const { count: aCount } = await supabase
        .from('school_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'Admin')

      const { data: docs } = await supabase
        .from('documents')
        .select('file_size')
        .eq('school_id', schoolId)

      const totalBytes = docs?.reduce((acc, d) => acc + Number(d.file_size || 0), 0) || 0
      const storageGB = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(3))

      setSubStats({
        students: sCount || 0,
        teachers: tCount || 0,
        admins: aCount || 0,
        storageGB
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingSubStats(false)
    }
  }

  useEffect(() => {
    if (isSubscriptionModalOpen && schoolId) {
      void loadSubStats()
    }
  }, [isSubscriptionModalOpen, schoolId])

  const usageWarnings = useMemo(() => {
    if (!subscription || !subscription.usage) return []
    const warnings: { metric: string; pct: number; used: number; limit: number }[] = []
    
    const keyMetrics = ['students', 'teachers', 'admins', 'file_storage', 'ai_credits', 'whatsapp_messages']
    keyMetrics.forEach(key => {
      const metric = subscription.usage[key]
      if (metric && metric.limit !== -1 && metric.pct >= 70) {
        warnings.push({
          metric: key === 'file_storage' ? 'storage' : key,
          pct: metric.pct,
          used: metric.used,
          limit: metric.limit
        })
      }
    })
    return warnings.sort((a, b) => b.pct - a.pct)
  }, [subscription])

  // 2. Client-side route protection: intercept expired plans and redirect
  useEffect(() => {
    if (subscription && !isLoading) {
      const isExpired = subscription.status === 'expired' || subscription.status === 'suspended'
      const isExcludedRoute = 
        pathname.startsWith('/dashboard/superadmin') || 
        pathname === '/fees' || 
        pathname === '/subscription-expired'
      
      if (isExpired && !isExcludedRoute) {
        router.push('/subscription-expired')
      }
    }
  }, [subscription, isLoading, pathname, router])

  // 3. Mock subscription upgrade checkout helper
  const handleUpgradePlan = async (plan: 'Starter' | 'Professional' | 'Enterprise') => {
    if (!schoolId || !subscription) return
    setUpgradingPlan(plan)
    try {
      const now = new Date()
      const planEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const graceEnd = new Date(planEnd.getTime() + 7 * 24 * 60 * 60 * 1000)

      // Fetch dynamic plan template ID from DB
      const { data: dbPlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', plan)
        .maybeSingle()

      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan_name: plan,
          plan_id: dbPlan ? dbPlan.id : null,
          status: 'active',
          subscription_start: now.toISOString(),
          subscription_end: planEnd.toISOString(),
          days_remaining: 30,
          grace_period_end: graceEnd.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', subscription.id)

      if (error) throw error

      // Audit Log
      await supabase.from('subscription_audit_logs').insert({
        school_id: schoolId,
        action: 'plan_changed',
        previous_plan: subscription.plan_name,
        new_plan: plan,
        previous_status: subscription.status,
        new_status: 'active',
        details: { checkout: 'Simulated inline plan change upgrade success' }
      })

      alert(`Congratulations! You have upgraded to the ${plan} Plan!`)
      await refreshSubscription()
      setIsSubscriptionModalOpen(false)
    } catch (e: any) {
      console.error(e)
      alert(`Upgrade failed: ${e.message}`)
    } finally {
      setUpgradingPlan(null)
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'AD'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Set academics open if we are in an academics route
  useEffect(() => {
    if (pathname.startsWith('/academics')) {
      setIsAcademicsOpen(true)
    }
  }, [pathname])

  useEffect(() => {
    if (userRole === 'Teacher') {
      if (pathname.startsWith('/dashboard/staff/my-attendance')) {
        return
      }
      const restrictedRoutes = ['/dashboard/settings', '/dashboard/staff', '/fees']
      if (restrictedRoutes.some(route => pathname.startsWith(route))) {
        router.push('/dashboard')
      }
    }
  }, [userRole, pathname, router])

  const navLinks = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      ) 
    },
    {
      name: 'Academics',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5zM2 14l10 5 10-5"/></svg>
      ),
      subLinks: [
        { name: 'Subjects', href: '/academics/subjects' },
        { name: 'Homework', href: '/academics/homework' },
        { name: 'Exams', href: '/academics/exams' },
        { name: 'Results', href: '/academics/results' },
        { name: 'Report Cards', href: '/academics/report-cards' }
      ]
    },
    { 
      name: 'Students', 
      href: '/students', 
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ) 
    },
    { 
      name: 'Teachers',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      subLinks: [
        { name: 'Staff Directory', href: '/dashboard/staff' },
        { name: 'Teacher Attendance', href: '/dashboard/staff/attendance' }
      ]
    },
    {
      name: 'Finance',
      href: '/fees',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      ) 
    },
    {
      name: 'Library',
      href: '/library',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    },
    {
      name: 'Transport',
      href: '/transport',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="22" height="13" rx="2" ry="2" />
          <line x1="4" y1="16" x2="4" y2="21" />
          <line x1="20" y1="16" x2="20" y2="21" />
        </svg>
      )
    },
    {
      name: 'Communication',
      href: '/communication',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    },
  ]

  const filteredNavLinks = useMemo(() => {
    let links = [...navLinks]

    // Feature gating based on database subscription plans
    if (subscription && subscription.features) {
      links = links.filter(link => {
        if (link.name === 'Library' && !subscription.features.library) return false
        if (link.name === 'Transport' && !subscription.features.transport) return false
        if (link.name === 'Analytics' && !subscription.features.analytics) return false
        if (link.name === 'Finance' && !subscription.features.payroll) return false
        if (link.name === 'Communication' && 
            !subscription.features.email && 
            !subscription.features.sms && 
            !subscription.features.whatsapp_integration) return false
        return true
      })
    }

    if (userRole === 'Teacher') {
      const teacherFiltered = links.filter(link => 
        link.name !== 'Settings' && 
        link.name !== 'Teachers' && 
        link.name !== 'Finance'
      )
      // Insert My Attendance item for Teachers
      teacherFiltered.splice(1, 0, {
        name: 'My Attendance',
        href: '/dashboard/staff/my-attendance',
        icon: (
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="m9 16 2 2 4-4" />
          </svg>
        )
      })
      return teacherFiltered
    }
    if (userRole === 'SuperAdmin') {
      return [
        ...links,
        {
          name: 'Registered Schools',
          href: '/dashboard/superadmin/schools',
          icon: (
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )
        },
        {
          name: 'Plan Definitions',
          href: '/dashboard/superadmin/plans',
          icon: (
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="4"/>
              <line x1="8" y1="2" x2="8" y2="4"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          )
        }
      ]
    }
    if (userRole === 'Admin') {
      links.push({
        name: 'Subscription & Billing',
        href: '/dashboard/subscription',
        icon: (
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="4"/>
            <line x1="8" y1="2" x2="8" y2="4"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        )
      })
    }
    return links
  }, [userRole, navLinks, subscription])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 animate-spin border-4 border-indigo-200 border-t-indigo-600" />
          <span className="text-sm font-semibold text-slate-500 animate-pulse">Loading school session...</span>
        </div>
      </div>
    )
  }

  if (!schoolId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50/50 p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-slate-200/60 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100 shadow-sm shadow-rose-100/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">No School Membership</h2>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Your account ({userEmail || 'registered user'}) is not linked to any registered school space. Please contact your administrator or ask them to add your email to the school staff registry.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            {userRole === 'SuperAdmin' && (
              <Link
                href="/register"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition shadow shadow-indigo-500/10 active:scale-95 text-center block"
              >
                + Register a New School
              </Link>
            )}
            <Link
              href="/login"
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-600 font-bold text-xs py-3 rounded-xl transition active:scale-95 text-center block"
            >
              Sign Out / Switch Account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return ['Home']
    return parts.map((part) => {
      if (part.length > 20) return 'Profile'
      const label = part.charAt(0).toUpperCase() + part.slice(1)
      if (label === 'Documents') return 'Documents Vault'
      if (label === 'Fees') return 'Fees & Billing'
      return label
    })
  }

  return (
    <div className="flex h-screen bg-slate-50/50 overflow-hidden font-sans">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white/95 backdrop-blur-md border-r border-slate-200/60 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col print:hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow shadow-indigo-500/20 overflow-hidden shrink-0">
              {schoolLogoUrl ? (
                <img src={schoolLogoUrl} alt={schoolName || 'School Logo'} className="object-cover w-full h-full" />
              ) : (
                <span>{schoolName ? schoolName.charAt(0).toUpperCase() : '★'}</span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-extrabold text-slate-800 truncate leading-tight select-none" title={schoolName || 'EduManage'}>
                {schoolName || 'EduManage'}
              </span>
              <span className="text-[9px] text-indigo-655 font-black tracking-wider uppercase leading-none mt-0.5">
                {userRole || 'Staff'}
              </span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 transition-colors ml-2 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>
        {memberships.length > 1 && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <label className="text-[9px] font-bold text-slate-400 uppercase whitespace-nowrap">School:</label>
            <select
              value={schoolId || ''}
              onChange={(e) => void switchSchool(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-[10px] font-bold text-indigo-600 cursor-pointer focus:ring-0 truncate"
            >
              {memberships.map((m) => (
                <option key={m.id} value={m.school_id} className="text-slate-800 font-semibold">
                  {m.school_name || 'School'}
                </option>
              ))}
            </select>
          </div>
        )}
        {userRole === 'SuperAdmin' && (
          <div className="px-6 py-2.5 bg-indigo-50/50 border-b border-slate-100/60 flex items-center justify-between gap-2 shrink-0">
            <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider">Super Admin:</span>
            <Link
              href="/register"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm shadow-indigo-500/10"
            >
              + Register School
            </Link>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="space-y-1.5 px-4">
            {filteredNavLinks.map((link) => {
              if (link.subLinks) {
                const isAnySubActive = link.subLinks.some(sub => pathname === sub.href)
                return (
                  <div key={link.name} className="space-y-1">
                    <button
                      onClick={() => setIsAcademicsOpen(!isAcademicsOpen)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group text-slate-600 hover:bg-slate-55 hover:text-slate-900 cursor-pointer ${
                        isAnySubActive ? 'text-indigo-700 font-bold bg-indigo-50/30' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <span className={`mr-3 transition-colors ${isAnySubActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                          {link.icon}
                        </span>
                        <span className="text-sm font-semibold">{link.name}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-black">
                        {isAcademicsOpen ? '▼' : '▶'}
                      </span>
                    </button>
                    {isAcademicsOpen && (
                      <div className="pl-8 space-y-1 border-l border-slate-100 ml-6 animate-fadeIn">
                        {link.subLinks.map(sub => {
                          const isSubActive = pathname === sub.href
                          return (
                            <Link
                              key={sub.name}
                              href={sub.href}
                              onClick={() => setIsSidebarOpen(false)}
                              className={`flex items-center px-4 py-2 text-xs rounded-lg transition-all font-semibold ${
                                isSubActive
                                  ? 'text-indigo-700 font-extrabold bg-indigo-50/50'
                                  : 'text-slate-500 hover:text-slate-950 hover:bg-slate-50/30'
                              }`}
                            >
                              {sub.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
              const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/dashboard')
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 font-bold' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-600 rounded-r-full" />
                  )}
                  <span className={`mr-3 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                    {link.icon}
                  </span>
                  <span className="text-sm font-semibold">{link.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-100/80">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-200 cursor-pointer border border-transparent hover:border-slate-100 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-100 to-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-200/50 shadow-sm transition-transform group-hover:scale-105">
              {getInitials(profile?.full_name || 'Admin User')}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-800 truncate">{profile?.full_name || 'Admin User'}</span>
              <span className="text-xs text-slate-400 truncate">{userEmail || 'admin@school.com'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" onClick={() => {
        setIsNotificationsOpen(false)
        setIsProfileOpen(false)
      }}>
        {/* Top Navbar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 h-16 flex items-center justify-between px-4 sm:px-6 z-10 shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsSidebarOpen(true)
              }}
              className="lg:hidden text-slate-500 hover:text-slate-700 p-2 hover:bg-slate-50 rounded-xl transition-colors focus:outline-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>

            {/* Breadcrumbs */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-slate-400 select-none">
              <span>Home</span>
              {getBreadcrumbs().map((b, i) => (
                <Fragment key={i}>
                  <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className={i === getBreadcrumbs().length - 1 ? "text-indigo-600" : ""}>{b}</span>
                </Fragment>
              ))}
            </div>

            {/* Mobile / fallback Title */}
            <span className="md:hidden font-black text-sm text-slate-800">EduManage ERP</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="hidden sm:flex items-center bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white focus-within:border-indigo-400/80 transition-all relative">
              <svg className="text-slate-400 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input 
                type="text" 
                placeholder="Search students, billing..." 
                className="bg-transparent border-none outline-none text-xs ml-2 w-48 placeholder-slate-400 text-slate-700 focus:outline-none"
              />
              <span className="text-[9px] font-black text-slate-400 bg-slate-100 border border-slate-200/60 px-1.5 py-0.2 rounded-md ml-2 select-none">⌘K</span>
            </div>

            {/* Subscription Status Badge */}
            {subscription && (
              <button
                onClick={() => setIsSubscriptionModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border tracking-wider transition hover:shadow-sm cursor-pointer select-none ${
                  subscription.status === 'active'
                    ? 'bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100/50'
                    : subscription.status === 'trial'
                    ? 'bg-amber-50 border-amber-250 text-amber-700 hover:bg-amber-100/50'
                    : subscription.status === 'grace_period'
                    ? 'bg-orange-50 border-orange-250 text-orange-700 hover:bg-orange-100/50 animate-pulse'
                    : 'bg-rose-50 border-rose-250 text-rose-700 hover:bg-rose-100/50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  subscription.status === 'active'
                    ? 'bg-emerald-500'
                    : subscription.status === 'trial'
                    ? 'bg-amber-500'
                    : subscription.status === 'grace_period'
                    ? 'bg-orange-500'
                    : 'bg-rose-500'
                }`} />
                {subscription.plan_name} • {subscription.days_remaining} {subscription.days_remaining === 1 ? 'Day' : 'Days'} Left
              </button>
            )}

            {/* Notifications Dropdown Container */}
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  setIsNotificationsOpen(!isNotificationsOpen)
                  setIsProfileOpen(false)
                }}
                className="text-slate-400 hover:text-indigo-600 relative p-2 hover:bg-slate-50 rounded-xl transition-all group cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:rotate-12">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
              </button>

              {isNotificationsOpen && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2.5 w-76 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in-50 slide-in-from-top-2 duration-200"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                    <span className="text-xs font-black text-slate-800">Recent Activity Logs</span>
                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">3 New</span>
                  </div>
                  <div className="space-y-3.5 pt-1">
                    <div className="flex gap-3 text-left">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block">Birth Certificate Uploaded</span>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.2">Khushi Sharma • 5 mins ago</span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-left">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block">Aadhaar Card Missing</span>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.2">Ayush Kumar • 1 hour ago</span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-left">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 block">Tuition Fee Collection</span>
                        <span className="text-[9px] font-bold text-slate-400 block mt-0.2">Pooja Devi • Billed ₹2,500</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Container */}
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  setIsProfileOpen(!isProfileOpen)
                  setIsNotificationsOpen(false)
                }}
                className="flex items-center gap-2.5 pl-2 border-l border-slate-250/70 cursor-pointer focus:outline-none group select-none text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-100 to-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs border border-indigo-200/50 shadow-sm transition-transform group-hover:scale-105">
                  {getInitials(profile?.full_name || 'Admin User')}
                </div>
                <div className="hidden md:flex flex-col text-left min-w-0">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{profile?.full_name || 'Admin User'}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">{userRole || 'Staff'}</span>
                </div>
                <svg className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isProfileOpen && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2.5 w-48 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in-50 slide-in-from-top-2 duration-200"
                >
                  <div className="px-3 py-2 border-b border-slate-100 mb-1.5 md:hidden">
                    <span className="text-xs font-bold text-slate-800 block">{profile?.full_name || 'Admin User'}</span>
                    <span className="text-[9px] font-bold text-slate-400 block mt-0.5">{userEmail || 'admin@school.com'}</span>
                  </div>
                  <Link 
                    href="/dashboard/settings"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all block text-left"
                  >
                    Settings
                  </Link>
                  {userRole === 'SuperAdmin' && (
                    <Link 
                      href="/register"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 transition-all block text-left font-semibold"
                    >
                      Register New School
                    </Link>
                  )}

                  <hr className="border-slate-100 my-1.5" />
                  <Link 
                    href="/login"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all block text-left"
                  >
                    Log Out
                  </Link>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Dismissible Expiry Alert Banners */}
        {!dismissedBanner && subscription && (subscription.status === 'grace_period' || subscription.days_remaining <= 5) && (
          <div className="bg-amber-500 text-white text-xs font-bold py-3 px-6 flex items-center justify-between gap-4 border-b border-amber-650 select-none animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span>
                {subscription.status === 'grace_period' ? (
                  `Your Subscription is in its GRACE PERIOD! (${subscription.days_remaining} ${subscription.days_remaining === 1 ? 'day' : 'days'} left to renew before service lockout).`
                ) : (
                  `Your '${subscription.plan_name}' subscription expires in ${subscription.days_remaining} ${subscription.days_remaining === 1 ? 'day' : 'days'}. Please renew now to prevent limit blocks.`
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/subscription"
                className="bg-white hover:bg-slate-50 text-amber-700 font-black uppercase text-[9px] tracking-wider px-3 py-1.5 rounded-xl shadow transition cursor-pointer"
              >
                Renew Now
              </Link>
              <button
                onClick={() => setDismissedBanner(true)}
                className="text-white hover:text-amber-100 font-extrabold text-xs transition px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Resource Limit Warning Banners (70%, 85%, 95%, 100%) */}
        {usageWarnings.length > 0 && (
          <div className={`text-white text-xs font-bold py-3 px-6 flex items-center justify-between gap-4 border-b select-none animate-in slide-in-from-top duration-300 ${
            usageWarnings[0].pct >= 100 
              ? 'bg-rose-650 border-rose-700' 
              : usageWarnings[0].pct >= 95 
              ? 'bg-orange-500 border-orange-600' 
              : usageWarnings[0].pct >= 85 
              ? 'bg-amber-500 border-amber-600' 
              : 'bg-indigo-650 border-indigo-700'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-sm">⚡</span>
              <span>
                {usageWarnings[0].pct >= 100 
                  ? `Student Limit Reached: Your school has reached 100% of its ${usageWarnings[0].metric} limit (${usageWarnings[0].used}/${usageWarnings[0].limit}). Upgrade Plan.`
                  : `Plan Warning: Your ${usageWarnings[0].metric} usage is at ${usageWarnings[0].pct}% of plan limit (${usageWarnings[0].used}/${usageWarnings[0].limit}). Upgrade Plan to prevent lockouts.`
                }
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/subscription"
                className="bg-white hover:bg-slate-50 text-slate-800 font-black uppercase text-[9px] tracking-wider px-3 py-1.5 rounded-xl shadow transition cursor-pointer"
              >
                Upgrade Plan
              </Link>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8 print:p-0 print:bg-white">
          {children}
        </main>
      </div>

      {/* Subscription Details & Upgrade Modal */}
      {isSubscriptionModalOpen && subscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none" onClick={() => setIsSubscriptionModalOpen(false)}>
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl relative border border-slate-200/50 animate-in fade-in zoom-in-95 duration-200 text-left"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">Subscription & Licensing Plan</h3>
                <p className="text-xs text-slate-450 mt-1 font-semibold">Monitor plan status, limits utilization, and billing transactions.</p>
              </div>
              <button 
                onClick={() => setIsSubscriptionModalOpen(false)}
                className="w-7 h-7 bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 rounded-xl flex items-center justify-center transition active:scale-90 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Summary Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-150 p-4.5 rounded-2xl">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Active Plan Tier</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-extrabold text-slate-800">{subscription.plan_name} Plan</span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                    subscription.status === 'active' 
                      ? 'bg-emerald-50 border-emerald-250 text-emerald-700' 
                      : subscription.status === 'trial'
                      ? 'bg-amber-50 border-amber-250 text-amber-705'
                      : subscription.status === 'grace_period'
                      ? 'bg-orange-50 border-orange-250 text-orange-700 animate-pulse'
                      : 'bg-rose-50 border-rose-250 text-rose-700'
                  }`}>
                    {subscription.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 p-4.5 rounded-2xl">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Days Remaining</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-extrabold ${subscription.days_remaining <= 5 ? 'text-rose-650' : 'text-slate-800'}`}>
                    {subscription.days_remaining} Days Left
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">
                    (Expires {subscription.status === 'trial' ? new Date(subscription.trial_end).toLocaleDateString() : (subscription.subscription_end ? new Date(subscription.subscription_end).toLocaleDateString() : 'N/A')})
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Utilization Bars */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1.5">Limits Utilization</h4>
              
              {loadingSubStats ? (
                <p className="text-xs font-bold text-slate-450 animate-pulse py-4 text-center">Recalculating live resource counters...</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5">
                  {/* Students limit */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-700">
                      <span>Admitted Students</span>
                      <span>
                        {subStats.students} / {subscription.limits?.students === -1 ? '∞' : subscription.limits?.students ?? 0} 
                        {subscription.limits?.students !== -1 && ` (${Math.min(100, Math.round((subStats.students / (subscription.limits?.students || 1)) * 100))}%)`}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          subscription.limits?.students !== -1 && (subStats.students / (subscription.limits?.students || 1)) >= 1.0 
                            ? 'bg-rose-500' 
                            : subscription.limits?.students !== -1 && (subStats.students / (subscription.limits?.students || 1)) >= 0.8 
                            ? 'bg-amber-500' 
                            : 'bg-indigo-650'
                        }`}
                        style={{ width: `${subscription.limits?.students === -1 ? 100 : Math.min(100, Math.round((subStats.students / (subscription.limits?.students || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Teachers limit */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-700">
                      <span>Active Teachers</span>
                      <span>
                        {subStats.teachers} / {subscription.limits?.teachers === -1 ? '∞' : subscription.limits?.teachers ?? 0}
                        {subscription.limits?.teachers !== -1 && ` (${Math.min(100, Math.round((subStats.teachers / (subscription.limits?.teachers || 1)) * 100))}%)`}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          subscription.limits?.teachers !== -1 && (subStats.teachers / (subscription.limits?.teachers || 1)) >= 1.0 
                            ? 'bg-rose-500' 
                            : subscription.limits?.teachers !== -1 && (subStats.teachers / (subscription.limits?.teachers || 1)) >= 0.8 
                            ? 'bg-amber-500' 
                            : 'bg-indigo-650'
                        }`}
                        style={{ width: `${subscription.limits?.teachers === -1 ? 100 : Math.min(100, Math.round((subStats.teachers / (subscription.limits?.teachers || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Admins limit */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-700">
                      <span>Dashboard Admins</span>
                      <span>
                        {subStats.admins} / {subscription.limits?.admins === -1 ? '∞' : subscription.limits?.admins ?? 0}
                        {subscription.limits?.admins !== -1 && ` (${Math.min(100, Math.round((subStats.admins / (subscription.limits?.admins || 1)) * 100))}%)`}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          subscription.limits?.admins !== -1 && (subStats.admins / (subscription.limits?.admins || 1)) >= 1.0 
                            ? 'bg-rose-500' 
                            : subscription.limits?.admins !== -1 && (subStats.admins / (subscription.limits?.admins || 1)) >= 0.8 
                            ? 'bg-amber-500' 
                            : 'bg-indigo-655'
                        }`}
                        style={{ width: `${subscription.limits?.admins === -1 ? 100 : Math.min(100, Math.round((subStats.admins / (subscription.limits?.admins || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Storage limit */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-700">
                      <span>Vault Storage</span>
                      <span>
                        {subStats.storageGB} GB / {subscription.limits?.file_storage === -1 ? '∞' : `${subscription.limits?.file_storage ?? 0} GB`}
                        {subscription.limits?.file_storage !== -1 && ` (${Math.min(100, Math.round((subStats.storageGB / (subscription.limits?.file_storage || 1)) * 100))}%)`}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          subscription.limits?.file_storage !== -1 && (subStats.storageGB / (subscription.limits?.file_storage || 1)) >= 1.0 
                            ? 'bg-rose-500' 
                            : subscription.limits?.file_storage !== -1 && (subStats.storageGB / (subscription.limits?.file_storage || 1)) >= 0.8 
                            ? 'bg-amber-500' 
                            : 'bg-indigo-650'
                        }`}
                        style={{ width: `${subscription.limits?.file_storage === -1 ? 100 : Math.min(100, Math.round((subStats.storageGB / (subscription.limits?.file_storage || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Upgrades Workspace */}
            <div className="space-y-4 pt-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-1.5">Upgrade or Renew License</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Starter Tier */}
                <div className="border border-slate-200 hover:border-indigo-300 rounded-2xl p-4.5 space-y-3 bg-slate-50/20 text-center relative flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold text-slate-750 block">Starter Tier</span>
                    <span className="text-base font-black text-slate-900 block mt-1">$29<span className="text-[9px] text-slate-450 font-bold">/mo</span></span>
                    <ul className="text-[9px] text-slate-450 font-bold text-left space-y-1.5 mt-3 leading-relaxed">
                      <li>👥 Max 200 Students</li>
                      <li>💼 Max 20 Teachers</li>
                      <li>🔐 Max 3 Admins</li>
                      <li>💾 2 GB Storage</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => handleUpgradePlan('Starter')}
                    disabled={upgradingPlan !== null || subscription.plan_name === 'Starter'}
                    className={`w-full text-[9px] font-black uppercase py-2.5 rounded-xl border transition active:scale-95 cursor-pointer ${
                      subscription.plan_name === 'Starter'
                        ? 'bg-slate-100 border-slate-250 text-slate-400'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-650'
                    }`}
                  >
                    {subscription.plan_name === 'Starter' ? 'Current Tier' : 'Upgrade'}
                  </button>
                </div>

                {/* Professional Tier */}
                <div className="border-2 border-indigo-500 rounded-2xl p-4.5 space-y-3 bg-indigo-50/10 text-center relative flex flex-col justify-between shadow-sm">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white font-black text-[7px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">POPULAR</span>
                  <div>
                    <span className="text-[11px] font-extrabold text-slate-750 block mt-1">Professional</span>
                    <span className="text-base font-black text-slate-900 block mt-1">$79<span className="text-[9px] text-slate-450 font-bold">/mo</span></span>
                    <ul className="text-[9px] text-slate-450 font-bold text-left space-y-1.5 mt-3 leading-relaxed">
                      <li>👥 Max 1000 Students</li>
                      <li>💼 Max 100 Teachers</li>
                      <li>🔐 Max 10 Admins</li>
                      <li>💾 10 GB Storage</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => handleUpgradePlan('Professional')}
                    disabled={upgradingPlan !== null || subscription.plan_name === 'Professional'}
                    className={`w-full text-[9px] font-black uppercase py-2.5 rounded-xl border transition active:scale-95 cursor-pointer ${
                      subscription.plan_name === 'Professional'
                        ? 'bg-slate-100 border-slate-250 text-slate-400'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-650'
                    }`}
                  >
                    {subscription.plan_name === 'Professional' ? 'Current Plan' : 'Upgrade'}
                  </button>
                </div>

                {/* Enterprise Tier */}
                <div className="border border-slate-200 hover:border-indigo-300 rounded-2xl p-4.5 space-y-3 bg-slate-50/20 text-center relative flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold text-slate-750 block">Enterprise</span>
                    <span className="text-base font-black text-slate-900 block mt-1">$199<span className="text-[9px] text-slate-450 font-bold">/mo</span></span>
                    <ul className="text-[9px] text-slate-450 font-bold text-left space-y-1.5 mt-3 leading-relaxed">
                      <li>👥 Unlimited Students</li>
                      <li>💼 Unlimited Teachers</li>
                      <li>🔐 Unlimited Admins</li>
                      <li>💾 100 GB Storage</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => handleUpgradePlan('Enterprise')}
                    disabled={upgradingPlan !== null || subscription.plan_name === 'Enterprise'}
                    className={`w-full text-[9px] font-black uppercase py-2.5 rounded-xl border transition active:scale-95 cursor-pointer ${
                      subscription.plan_name === 'Enterprise'
                        ? 'bg-slate-100 border-slate-250 text-slate-400'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-650'
                    }`}
                  >
                    {subscription.plan_name === 'Enterprise' ? 'Current Tier' : 'Upgrade'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
