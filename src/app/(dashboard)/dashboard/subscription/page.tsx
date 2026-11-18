'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { useSchool } from '../../../../lib/SchoolContext'
import ClientAuth from '../../ClientAuth'

type PlanTemplate = {
  name: string
  price: string
  students: string
  teachers: string
  storage: string
  ai: string
  features: string[]
}

const COMPARISON_PLANS: PlanTemplate[] = [
  {
    name: 'Starter',
    price: '$29/mo',
    students: '200 Students',
    teachers: '20 Teachers',
    storage: '2 GB',
    ai: '2,000 Credits',
    features: ['Parent Portal', 'Email Notifications', 'SMS Notifications', 'AI Assistant (Basic)']
  },
  {
    name: 'Professional',
    price: '$99/mo',
    students: '1,000 Students',
    teachers: '100 Teachers',
    storage: '15 GB',
    ai: '15,000 Credits',
    features: ['Parent Portal', 'Email & SMS Notifications', 'WhatsApp Integration', 'Library Module', 'Transport Module', 'Analytics & Custom Reports', 'AI Assistant (Advanced)']
  },
  {
    name: 'Enterprise',
    price: '$299/mo',
    students: 'Unlimited Students',
    teachers: 'Unlimited Teachers',
    storage: '100 GB',
    ai: 'Unlimited Credits',
    features: ['All Professional Features', 'White Label Branding', 'Public API Support', 'Unlimited WhatsApp & SMS', 'Hostel & Payroll Modules', 'Priority Developer Support', 'Dedicated Backups']
  }
]

export default function SubscriptionBillingPage() {
  const router = useRouter()
  const { schoolId, userRole, subscription, refreshSubscription } = useSchool()
  const [upgradingTo, setUpgradingTo] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Guard routing: restrict to School Admins
  useEffect(() => {
    if (userRole && userRole !== 'Admin' && userRole !== 'SuperAdmin') {
      router.push('/dashboard')
    }
  }, [userRole, router])

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleUpgrade = async (plan: 'Starter' | 'Professional' | 'Enterprise') => {
    if (!schoolId || !subscription) return
    setUpgradingTo(plan)
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
        details: { checkout: 'Dynamic dashboard plan selection success' }
      })

      showNotification('success', `Congratulations! Your workspace has been upgraded to ${plan}!`)
      await refreshSubscription()
    } catch (e: any) {
      console.error(e)
      showNotification('error', `Upgrade failed: ${e.message}`)
    } finally {
      setUpgradingTo(null)
    }
  }

  if (userRole !== 'Admin' && userRole !== 'SuperAdmin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">Subscription details can only be viewed or modified by School Administrators.</p>
        </div>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center animate-pulse">
        <p className="text-sm text-slate-400 font-extrabold">Loading dynamic subscription details...</p>
      </div>
    )
  }

  return (
    <>
      <ClientAuth />

      <div className="max-w-6xl mx-auto space-y-8 relative">
        {/* Floating Notification */}
        {notification && (
          <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border animate-bounce ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
              : 'bg-rose-50 border-rose-250 text-rose-800'
          }`}>
            <span className="text-lg">{notification.type === 'success' ? '✓' : '⚠'}</span>
            <span className="text-xs font-bold">{notification.message}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Subscription & Billing</h1>
            <p className="text-slate-550 mt-1 font-semibold text-sm">Monitor plan utilization limits, toggle services and manage billing structures.</p>
          </div>
        </div>

        {/* Subscription Metrics Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Plan Overview Card */}
          <div className="bg-gradient-to-tr from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl" />
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-305 tracking-wider block">Current Plan Tier</span>
                  <h2 className="text-2xl font-black mt-1 tracking-tight">{subscription.plan_name} Plan</h2>
                </div>
                <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                  subscription.status === 'active' 
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
                    : subscription.status === 'trial'
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                    : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                }`}>
                  {subscription.status}
                </span>
              </div>
              <p className="text-xs text-indigo-100 font-medium">
                {subscription.status === 'trial' 
                  ? 'Your workspace is in trial mode. Upgrade to professional or enterprise to enable full access.'
                  : 'Your subscription is active and renews automatically.'}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] text-indigo-305 font-black uppercase block">Days Remaining</span>
                <span className="text-lg font-black block mt-0.5">{subscription.days_remaining} Days</span>
              </div>
              <div>
                <span className="text-[9px] text-indigo-305 font-black uppercase block">Renewal/Expiry Date</span>
                <span className="text-xs font-bold block mt-1">
                  {subscription.subscription_end 
                    ? new Date(subscription.subscription_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : new Date(subscription.trial_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Usage Utilization Statistics */}
          <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Limits Utilization</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Recalculating live resource counters. Warnings are triggered automatically at 70%, 85%, and 95% capacity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(subscription.usage || {}).map(([key, data]) => {
                const isUnlimited = data.limit === -1
                const label = key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')
                
                // Color codes
                let progressColor = 'bg-indigo-600'
                let textColor = 'text-slate-700'
                if (data.pct >= 95) {
                  progressColor = 'bg-rose-500'
                  textColor = 'text-rose-600 font-black'
                } else if (data.pct >= 85) {
                  progressColor = 'bg-orange-500'
                  textColor = 'text-orange-600 font-extrabold'
                } else if (data.pct >= 70) {
                  progressColor = 'bg-amber-500'
                  textColor = 'text-amber-600 font-bold'
                }

                return (
                  <div key={key} className="space-y-1.5 border border-slate-50 p-3 rounded-2xl bg-slate-50/20">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">{label}</span>
                      <span className={textColor}>
                        {data.used} / {isUnlimited ? '∞' : data.limit} 
                        {!isUnlimited && ` (${data.pct}%)`}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                        style={{ width: `${isUnlimited ? 100 : data.pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Feature Availability Grid */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Active Features Status</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Toggle active feature gates included in your plan configuration.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(subscription.features || {}).map(([feature, enabled]) => {
              const label = feature.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              return (
                <div 
                  key={feature} 
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs font-bold transition-all ${
                    enabled 
                      ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                      : 'bg-slate-50/50 border-slate-100 text-slate-400 opacity-60'
                  }`}
                >
                  <span className="text-sm">{enabled ? '✓' : '✕'}</span>
                  <span>{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Plans Upgrades Table */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8">
          <div className="text-center space-y-2 max-w-lg mx-auto">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Upgrade Your Plan</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Unlock database scalability, AI assistants, WhatsApp communication channels, and rich resource limits by switching to standard platform plans.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {COMPARISON_PLANS.map((plan) => {
              const isCurrent = subscription.plan_name === plan.name
              const btnLabel = isCurrent 
                ? 'Current Active Plan' 
                : upgradingTo === plan.name 
                ? 'Processing Switch...' 
                : `Upgrade to ${plan.name}`

              return (
                <div 
                  key={plan.name}
                  className={`border rounded-3xl p-6 space-y-6 flex flex-col justify-between transition-all duration-300 relative ${
                    isCurrent 
                      ? 'border-indigo-650 ring-2 ring-indigo-500/10 shadow-lg' 
                      : 'border-slate-200 hover:border-indigo-300 shadow-sm'
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white font-black uppercase text-[8px] tracking-wider px-3 py-1 rounded-full border border-indigo-750">
                      Active Plan
                    </span>
                  )}

                  <div className="space-y-4">
                    <div className="text-center">
                      <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wide block">{plan.name}</span>
                      <h4 className="text-3xl font-black text-slate-900 mt-1 tracking-tight">{plan.price}</h4>
                    </div>

                    <ul className="space-y-3 pt-4 border-t border-slate-100">
                      <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <span>👥</span>
                        <span>{plan.students}</span>
                      </li>
                      <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <span>💼</span>
                        <span>{plan.teachers}</span>
                      </li>
                      <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <span>💾</span>
                        <span>{plan.storage} Storage Limit</span>
                      </li>
                      <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <span>⚡</span>
                        <span>{plan.ai}</span>
                      </li>
                    </ul>

                    <div className="pt-4 border-t border-slate-100 space-y-2">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Features Included:</span>
                      {plan.features.map((feat, index) => (
                        <div key={index} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                          <span className="text-emerald-500 text-xs">✓</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={isCurrent || upgradingTo !== null}
                    onClick={() => handleUpgrade(plan.name as any)}
                    className={`w-full font-bold text-xs py-3 rounded-xl transition active:scale-95 cursor-pointer text-center mt-6 block ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow shadow-indigo-650/15'
                    }`}
                  >
                    {btnLabel}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
