'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../../lib/supabase'
import { useSchool } from '../../../../../lib/SchoolContext'
import ClientAuth from '../../../ClientAuth'

type PlanTemplate = {
  id: string
  name: string
  description: string | null
  created_at: string
}

type LimitRow = {
  limit_key: string
  limit_value: number
}

type FeatureRow = {
  feature_code: string
  is_enabled: boolean
}

const LIMIT_KEYS = [
  { key: 'students', label: 'Max Students' },
  { key: 'teachers', label: 'Max Teachers' },
  { key: 'admins', label: 'Max Admins' },
  { key: 'parents', label: 'Max Parents' },
  { key: 'classes', label: 'Max Classes' },
  { key: 'branches', label: 'Max Branches' },
  { key: 'file_storage', label: 'Storage Limit (GB)' },
  { key: 'ai_credits', label: 'AI Credits' },
  { key: 'whatsapp_messages', label: 'WhatsApp Messages Limit' },
  { key: 'email_notifications', label: 'Email Notifications Limit' },
  { key: 'sms_notifications', label: 'SMS Notifications Limit' },
  { key: 'homework_per_month', label: 'Homework Assignments Per Month' }
]

const FEATURE_KEYS = [
  { code: 'ai_assistant', label: 'AI Assistant' },
  { code: 'parent_portal', label: 'Parent Portal' },
  { code: 'library', label: 'Library Module' },
  { code: 'transport', label: 'Transport Module' },
  { code: 'payroll', label: 'Payroll Module' },
  { code: 'inventory', label: 'Inventory Module' },
  { code: 'hostel', label: 'Hostel Module' },
  { code: 'online_classes', label: 'Online Classes' },
  { code: 'biometric_attendance', label: 'Biometric Attendance' },
  { code: 'whatsapp_integration', label: 'WhatsApp Integration' },
  { code: 'sms', label: 'SMS Services' },
  { code: 'email', label: 'Email Services' },
  { code: 'analytics', label: 'Analytics Dashboard' },
  { code: 'custom_reports', label: 'Custom Reports' },
  { code: 'public_api', label: 'Public API Support' },
  { code: 'white_label_branding', label: 'White Label Branding' }
]

export default function SuperAdminPlansPage() {
  const router = useRouter()
  const { userRole } = useSchool()

  const [plans, setPlans] = useState<PlanTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanTemplate | null>(null)
  
  // Editor States
  const [planName, setPlanName] = useState('')
  const [planDesc, setPlanDesc] = useState('')
  const [limitsMap, setLimitsMap] = useState<Record<string, number>>({})
  const [featuresMap, setFeaturesMap] = useState<Record<string, boolean>>({})

  // UI Modal toggles
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Guard routing for non-SuperAdmins
  useEffect(() => {
    if (userRole && userRole !== 'SuperAdmin') {
      router.push('/dashboard')
    }
  }, [userRole, router])

  async function loadPlans() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (e: any) {
      console.error(e)
      showNotification('error', `Failed to load plans: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userRole === 'SuperAdmin') {
      void loadPlans()
    }
  }, [userRole])

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleOpenEditor = async (plan: PlanTemplate) => {
    setSelectedPlan(plan)
    setPlanName(plan.name)
    setPlanDesc(plan.description || '')
    setIsCreatingNew(false)
    setIsEditorOpen(true)

    // Load limits & features
    try {
      const { data: dbLimits } = await supabase
        .from('plan_limits')
        .select('limit_key, limit_value')
        .eq('plan_id', plan.id)

      const lims: Record<string, number> = {}
      LIMIT_KEYS.forEach(k => {
        const found = dbLimits?.find((l: any) => l.limit_key === k.key)
        lims[k.key] = found ? found.limit_value : -1
      })
      setLimitsMap(lims)

      const { data: dbFeatures } = await supabase
        .from('plan_features')
        .select('feature_code, is_enabled')
        .eq('plan_id', plan.id)

      const feats: Record<string, boolean> = {}
      FEATURE_KEYS.forEach(f => {
        const found = dbFeatures?.find((ft: any) => ft.feature_code === f.code)
        feats[f.code] = found ? found.is_enabled : false
      })
      setFeaturesMap(feats)
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateNew = () => {
    setSelectedPlan(null)
    setPlanName('')
    setPlanDesc('')
    setIsCreatingNew(true)
    setIsEditorOpen(true)

    // Initialize blank configurations
    const lims: Record<string, number> = {}
    LIMIT_KEYS.forEach(k => {
      lims[k.key] = k.key === 'students' ? 100 : k.key === 'teachers' ? 10 : 0
    })
    setLimitsMap(lims)

    const feats: Record<string, boolean> = {}
    FEATURE_KEYS.forEach(f => {
      feats[f.code] = false
    })
    setFeaturesMap(feats)
  }

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      let activePlanId = selectedPlan?.id || null

      // 1. Create or Update Plan template row
      if (isCreatingNew) {
        const { data: newPlan, error } = await supabase
          .from('subscription_plans')
          .insert({ name: planName, description: planDesc })
          .select()
          .single()

        if (error) throw error
        if (newPlan) activePlanId = newPlan.id
      } else if (selectedPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update({ name: planName, description: planDesc })
          .eq('id', selectedPlan.id)

        if (error) throw error
      }

      if (activePlanId) {
        // 2. Save limits
        for (const limit of LIMIT_KEYS) {
          const value = limitsMap[limit.key] !== undefined ? limitsMap[limit.key] : -1
          await supabase
            .from('plan_limits')
            .upsert({
              plan_id: activePlanId,
              limit_key: limit.key,
              limit_value: Number(value),
              updated_at: new Date().toISOString()
            }, { onConflict: 'plan_id,limit_key' })
        }

        // 3. Save features
        for (const feat of FEATURE_KEYS) {
          const enabled = featuresMap[feat.code] || false
          await supabase
            .from('plan_features')
            .upsert({
              plan_id: activePlanId,
              feature_code: feat.code,
              is_enabled: enabled,
              updated_at: new Date().toISOString()
            }, { onConflict: 'plan_id,feature_code' })
        }
      }

      showNotification('success', isCreatingNew ? 'Plan template created successfully!' : 'Plan template updated successfully!')
      setIsEditorOpen(false)
      void loadPlans()
    } catch (e: any) {
      console.error(e)
      showNotification('error', `Failed to save plan: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicatePlan = async (plan: PlanTemplate) => {
    try {
      setLoading(true)
      const copyName = `${plan.name} Copy`

      // 1. Insert new plan template
      const { data: newPlan, error } = await supabase
        .from('subscription_plans')
        .insert({
          name: copyName,
          description: `Duplicate of ${plan.name} template.`
        })
        .select()
        .single()

      if (error) throw error
      if (newPlan) {
        // 2. Load existing limits and clone them
        const { data: existingLimits } = await supabase
          .from('plan_limits')
          .select('limit_key, limit_value')
          .eq('plan_id', plan.id)

        if (existingLimits && existingLimits.length > 0) {
          const newLimits = existingLimits.map(l => ({
            plan_id: newPlan.id,
            limit_key: l.limit_key,
            limit_value: l.limit_value
          }))
          await supabase.from('plan_limits').insert(newLimits)
        }

        // 3. Load existing features and clone them
        const { data: existingFeatures } = await supabase
          .from('plan_features')
          .select('feature_code, is_enabled')
          .eq('plan_id', plan.id)

        if (existingFeatures && existingFeatures.length > 0) {
          const newFeatures = existingFeatures.map(f => ({
            plan_id: newPlan.id,
            feature_code: f.feature_code,
            is_enabled: f.is_enabled
          }))
          await supabase.from('plan_features').insert(newFeatures)
        }

        showNotification('success', `Plan template '${plan.name}' successfully duplicated as '${copyName}'!`)
        void loadPlans()
      }
    } catch (e: any) {
      console.error(e)
      showNotification('error', `Failed to duplicate plan: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (userRole !== 'SuperAdmin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">This module is reserved for platform-wide Super Administrators.</p>
        </div>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-left">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Super Admin Plans Panel</h1>
            <p className="text-slate-550 mt-1 font-semibold text-sm">Define global subscription tiers, toggle feature scopes and configure default limit boundaries.</p>
          </div>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-md cursor-pointer shrink-0 active:scale-95 transition-all"
          >
            + Create Plan Template
          </button>
        </div>

        {/* Plans list */}
        {loading ? (
          <p className="text-center font-bold text-slate-450 animate-pulse py-8">Loading subscription templates...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div 
                key={p.id}
                className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all duration-300 text-left space-y-4"
              >
                <div>
                  <h3 className="text-lg font-extrabold text-slate-850 tracking-tight">{p.name} Template</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed min-h-[40px]">
                    {p.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => void handleOpenEditor(p)}
                    className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs py-2 rounded-xl text-center cursor-pointer transition active:scale-97 border border-indigo-150"
                  >
                    Edit Limits & Features
                  </button>
                  <button
                    onClick={() => void handleDuplicatePlan(p)}
                    className="p-2 hover:bg-slate-50 text-slate-450 hover:text-slate-700 border border-slate-200/60 rounded-xl cursor-pointer transition active:scale-97"
                    title="Duplicate Template"
                  >
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Global Plans limits/features editor modal */}
        {isEditorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none" onClick={() => setIsEditorOpen(false)}>
            <div 
              className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl relative border border-slate-200/50 animate-in fade-in zoom-in-95 duration-200 text-left flex flex-col justify-between"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">{isCreatingNew ? 'Create Plan Template' : `Edit ${planName} Template`}</h3>
                  <p className="text-xs text-slate-400 font-semibold mt-1">Configure global plan default capabilities.</p>
                </div>
                <button 
                  onClick={() => setIsEditorOpen(false)}
                  className="w-7 h-7 bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 rounded-xl flex items-center justify-center transition active:scale-90 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleSavePlan} className="space-y-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Plan Name *</label>
                    <input
                      type="text"
                      required
                      value={planName}
                      onChange={e => setPlanName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
                    <input
                      type="text"
                      value={planDesc}
                      onChange={e => setPlanDesc(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium"
                    />
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Grid limits editor */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Default Tier Limits</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {LIMIT_KEYS.map(limit => {
                      const value = limitsMap[limit.key] !== undefined ? limitsMap[limit.key] : -1
                      return (
                        <div key={limit.key} className="space-y-1">
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate" title={limit.label}>{limit.label}</label>
                          <input
                            type="number"
                            value={value}
                            onChange={e => setLimitsMap(prev => ({ ...prev, [limit.key]: Number(e.target.value) }))}
                            className="w-full px-3 py-2 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400 bg-white"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Feature gates editor */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Enabled Features Scope</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {FEATURE_KEYS.map(feat => {
                      const enabled = featuresMap[feat.code] || false
                      return (
                        <label 
                          key={feat.code}
                          className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer select-none text-[11px] font-bold transition-all ${
                            enabled 
                              ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
                              : 'bg-slate-50 border-slate-150 text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e => setFeaturesMap(prev => ({ ...prev, [feat.code]: e.target.checked }))}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                          />
                          <span className="truncate" title={feat.label}>{feat.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Footer Save Actions */}
                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="border border-slate-200 hover:bg-slate-55 text-slate-500 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer transition active:scale-97"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition active:scale-97 shadow"
                  >
                    {saving ? 'Saving Tier...' : 'Save Plan Config'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
