'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../../../lib/supabase'
import { useSchool } from '../../../../../../lib/SchoolContext'
import ClientAuth from '../../../../ClientAuth'

type SchoolDetails = {
  id: string
  name: string
  logo_url: string | null
  theme_color: string | null
  address: string | null
  phone: string | null
  email: string | null
  academic_session: string | null
  status: 'pending' | 'approved' | 'suspended'
  subscription_status: 'trial' | 'active' | 'inactive'
  created_at: string
}

type PlanTemplate = {
  id: string
  name: string
  description: string | null
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

export default function SuperAdminSchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { userRole } = useSchool()

  const [school, setSchool] = useState<SchoolDetails | null>(null)
  const [plans, setPlans] = useState<PlanTemplate[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [academicSession, setAcademicSession] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [themeColor, setThemeColor] = useState('#6366f1')
  const [status, setStatus] = useState<'pending' | 'approved' | 'suspended'>('approved')

  // Subscription Form States
  const [subId, setSubId] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string>('')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [subStatusText, setSubStatusText] = useState<'trial' | 'active' | 'grace_period' | 'expired' | 'cancelled' | 'suspended'>('trial')
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(7)
  const [daysRemaining, setDaysRemaining] = useState<number>(14)
  const [expiryDate, setExpiryDate] = useState<string>('')

  // Overrides States
  const [limitOverrides, setLimitOverrides] = useState<Record<string, number>>({})
  const [limitEnabled, setLimitEnabled] = useState<Record<string, boolean>>({}) // track which overrides are active
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, boolean>>({})
  const [featureEnabled, setFeatureEnabled] = useState<Record<string, boolean>>({}) // track which overrides are active

  // Guard routing for non-SuperAdmins
  useEffect(() => {
    if (userRole && userRole !== 'SuperAdmin') {
      router.push('/dashboard')
    }
  }, [userRole, router])

  async function loadSchoolData() {
    if (!id) return
    try {
      setLoading(true)

      // 1. Fetch Plans list
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('name', { ascending: true })
      setPlans(plansData || [])

      // 2. Fetch School Details
      const { data: schoolData, error: schoolErr } = await supabase
        .from('schools')
        .select('*')
        .eq('id', id)
        .single()

      if (schoolErr) throw schoolErr
      if (schoolData) {
        setSchool(schoolData)
        setName(schoolData.name || '')
        setAcademicSession(schoolData.academic_session || '')
        setPhone(schoolData.phone || '')
        setEmail(schoolData.email || '')
        setAddress(schoolData.address || '')
        setThemeColor(schoolData.theme_color || '#6366f1')
        setStatus(schoolData.status || 'approved')

        // Logo preview
        if (schoolData.logo_url) {
          if (schoolData.logo_url.startsWith('http')) {
            setLogoPreview(schoolData.logo_url)
          } else {
            const { data: urlData } = await supabase.storage
              .from('student-documents')
              .createSignedUrl(schoolData.logo_url, 3600)
            if (urlData?.signedUrl) {
              setLogoPreview(urlData.signedUrl)
            }
          }
        } else {
          setLogoPreview(null)
        }

        // 3. Fetch Subscription Details
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('school_id', id)
          .maybeSingle()

        if (subData) {
          setSubId(subData.id)
          setPlanId(subData.plan_id || '')
          setBillingCycle(subData.billing_cycle)
          setSubStatusText(subData.status)
          setGracePeriodDays(subData.grace_period_days)
          setDaysRemaining(subData.days_remaining)
          
          const rawEnd = subData.subscription_end || subData.trial_end
          if (rawEnd) {
            setExpiryDate(new Date(rawEnd).toISOString().split('T')[0])
          }

          // 4. Fetch Limit Overrides
          const { data: dbLimitOverrides } = await supabase
            .from('subscription_limit_overrides')
            .select('*')
            .eq('subscription_id', subData.id)

          const limOvs: Record<string, number> = {}
          const limEns: Record<string, boolean> = {}
          LIMIT_KEYS.forEach(k => {
            const row = dbLimitOverrides?.find(o => o.limit_key === k.key)
            if (row) {
              limOvs[k.key] = row.limit_value
              limEns[k.key] = true
            } else {
              limOvs[k.key] = -1 // Default -1 / cleared
              limEns[k.key] = false
            }
          })
          setLimitOverrides(limOvs)
          setLimitEnabled(limEns)

          // 5. Fetch Feature Overrides
          const { data: dbFeatureOverrides } = await supabase
            .from('subscription_feature_overrides')
            .select('*')
            .eq('subscription_id', subData.id)

          const featOvs: Record<string, boolean> = {}
          const featEns: Record<string, boolean> = {}
          FEATURE_KEYS.forEach(f => {
            const row = dbFeatureOverrides?.find(o => o.feature_code === f.code)
            if (row) {
              featOvs[f.code] = row.is_enabled
              featEns[f.code] = true
            } else {
              featOvs[f.code] = false
              featEns[f.code] = false
            }
          })
          setFeatureOverrides(featOvs)
          setFeatureEnabled(featEns)
        }
      }

    } catch (e: any) {
      console.error('Failed to load school details:', e)
      showNotification('error', `Failed to load details: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userRole === 'SuperAdmin') {
      void loadSchoolData()
    }
  }, [id, userRole])

  function showNotification(type: 'success' | 'error', message: string) {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      let uploadedLogoUrl = school?.logo_url || null

      if (logoFile) {
        const logoPath = `school-logos/${id}_${Date.now()}_${logoFile.name}`
        const { error: uploadErr } = await supabase.storage
          .from('student-documents')
          .upload(logoPath, logoFile, { upsert: true })

        if (uploadErr) {
          throw new Error(`Logo upload failed: ${uploadErr.message}`)
        }
        uploadedLogoUrl = logoPath
      }

      // 1. Update School Info
      const { error: updateErr } = await supabase
        .from('schools')
        .update({
          name,
          logo_url: uploadedLogoUrl,
          theme_color: themeColor,
          address: address || null,
          phone: phone || null,
          email: email || null,
          academic_session: academicSession || null,
          status,
          subscription_status: subStatusText === 'active' || subStatusText === 'trial' ? 'active' : 'inactive'
        })
        .eq('id', id)

      if (updateErr) throw updateErr

      // Resolve Selected Plan Name
      const selectedPlan = plans.find(p => p.id === planId)
      const selectedPlanName = selectedPlan ? selectedPlan.name : 'Trial'

      // 2. Update Subscription Details
      const subPayload = {
        plan_name: selectedPlanName,
        plan_id: planId || null,
        billing_cycle: billingCycle,
        status: subStatusText,
        grace_period_days: Number(gracePeriodDays),
        days_remaining: Number(daysRemaining),
        subscription_end: expiryDate ? new Date(expiryDate).toISOString() : null,
        updated_at: new Date().toISOString()
      }

      let activeSubId = subId

      if (subId) {
        const { error: subErr } = await supabase
          .from('subscriptions')
          .update(subPayload)
          .eq('id', subId)
        if (subErr) throw subErr
      } else {
        const { data: newSub, error: subErr } = await supabase
          .from('subscriptions')
          .insert({
            school_id: id,
            ...subPayload
          })
          .select()
          .single()
        if (subErr) throw subErr
        if (newSub) {
          activeSubId = newSub.id
          setSubId(newSub.id)
        }
      }

      if (activeSubId) {
        // 3. Save/Update Limit Overrides
        for (const limit of LIMIT_KEYS) {
          const overrideActive = limitEnabled[limit.key]
          const overrideValue = limitOverrides[limit.key]

          if (overrideActive) {
            await supabase
              .from('subscription_limit_overrides')
              .upsert({
                subscription_id: activeSubId,
                limit_key: limit.key,
                limit_value: Number(overrideValue),
                updated_at: new Date().toISOString()
              }, { onConflict: 'subscription_id,limit_key' })
          } else {
            // Delete if unchecked
            await supabase
              .from('subscription_limit_overrides')
              .delete()
              .eq('subscription_id', activeSubId)
              .eq('limit_key', limit.key)
          }
        }

        // 4. Save/Update Feature Overrides
        for (const feat of FEATURE_KEYS) {
          const overrideActive = featureEnabled[feat.code]
          const overrideValue = featureOverrides[feat.code]

          if (overrideActive) {
            await supabase
              .from('subscription_feature_overrides')
              .upsert({
                subscription_id: activeSubId,
                feature_code: feat.code,
                is_enabled: overrideValue,
                updated_at: new Date().toISOString()
              }, { onConflict: 'subscription_id,feature_code' })
          } else {
            // Delete override if unchecked
            await supabase
              .from('subscription_feature_overrides')
              .delete()
              .eq('subscription_id', activeSubId)
              .eq('feature_code', feat.code)
          }
        }
      }

      // Log plan modification audit
      await supabase.from('subscription_audit_logs').insert({
        school_id: id,
        action: 'plan_changed',
        new_plan: selectedPlanName,
        new_status: subStatusText,
        details: { modifier: 'Super Admin UI Panel override - Dynamic Schema' }
      })

      showNotification('success', 'School & Subscription settings updated successfully!')
      void loadSchoolData()
    } catch (err: any) {
      console.error('Failed to save settings:', err)
      showNotification('error', `Error updating settings: ${err.message}`)
    } finally {
      setSaving(false)
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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="h-24 bg-slate-100 rounded-3xl" />
          <div className="h-24 bg-slate-100 rounded-3xl" />
          <div className="h-24 bg-slate-100 rounded-3xl" />
          <div className="h-24 bg-slate-100 rounded-3xl" />
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl p-8 space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/3" />
          <div className="h-44 bg-slate-100 rounded-2xl w-full" />
        </div>
      </div>
    )
  }

  if (!school) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h2 className="text-xl font-black text-slate-800">School Tenant Not Found</h2>
        <p className="text-slate-500 max-w-sm mx-auto text-xs leading-relaxed font-semibold">The school identifier provided in the URL does not exist or has been deleted from the database.</p>
        <Link
          href="/dashboard/superadmin/schools"
          className="inline-flex items-center justify-center font-bold px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-xs cursor-pointer text-slate-700"
        >
          Return to Schools Directory
        </Link>
      </div>
    )
  }

  return (
    <>
      <ClientAuth />

      <div className="max-w-5xl mx-auto space-y-8 relative">
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

        {/* Navigation & Actions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5 flex-1 text-left">
            <Link
              href="/dashboard/superadmin/schools"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer group"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:-translate-x-0.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              Back to directory
            </Link>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span>{school.name}</span>
              <span className={`text-[10px] font-black uppercase border tracking-wider px-2 py-0.5 rounded-lg shrink-0 ${
                school.status === 'approved' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : school.status === 'pending'
                  ? 'bg-amber-50 border-amber-200 text-amber-700' 
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                {school.status}
              </span>
            </h1>
          </div>
        </div>

        {/* Detailed Configuration Grid */}
        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Edit Form */}
          <div className="lg:col-span-2 space-y-8">
            {/* Demographics Card */}
            <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 sm:p-8 text-left space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">School Demographics</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Edit this tenant's public configuration profiles. These details populate dynamic reports and receipt structures.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* School Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                  />
                </div>

                {/* Session */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Active Academic Session *</label>
                  <input
                    type="text"
                    required
                    value={academicSession}
                    onChange={e => setAcademicSession(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Office Contact Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Official Office Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white font-medium"
                  />
                </div>

                {/* Theme Color */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Theme Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={e => setThemeColor(e.target.value)}
                      className="w-9 h-9 border-0 outline-none cursor-pointer p-0 bg-transparent rounded"
                    />
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase">{themeColor}</span>
                  </div>
                </div>

                {/* Logo Uploader */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">School Insignia / Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-250 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {logoPreview ? (
                        <img src={logoPreview} alt="School Logo" className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-lg font-black text-slate-350">★</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <input
                        type="file"
                        accept="image/*"
                        id="logo-upload"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="inline-flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-xl text-[10px] transition-all cursor-pointer border border-indigo-150 shadow-sm active:scale-98"
                      >
                        Change Logo
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Physical Campus Address</label>
                <textarea
                  rows={3}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white resize-none font-medium"
                />
              </div>
            </div>

            {/* Limits Overrides Card */}
            <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 sm:p-8 text-left space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">SaaS Limits Overrides</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Customize individual resource limits specifically for this school. Check "Override" to specify a custom limit (value -1 represents unlimited).</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {LIMIT_KEYS.map(limit => {
                  const active = limitEnabled[limit.key] || false
                  const value = limitOverrides[limit.key] !== undefined ? limitOverrides[limit.key] : -1

                  return (
                    <div key={limit.key} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/20 flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-700">{limit.label}</span>
                        <div className="flex items-center gap-1.5 select-none">
                          <input
                            type="checkbox"
                            id={`ov-check-${limit.key}`}
                            checked={active}
                            onChange={e => setLimitEnabled(prev => ({ ...prev, [limit.key]: e.target.checked }))}
                            className="cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor={`ov-check-${limit.key}`} className="text-[10px] font-black text-slate-400 uppercase tracking-wider cursor-pointer">Override</label>
                        </div>
                      </div>

                      {active ? (
                        <input
                          type="number"
                          value={value}
                          onChange={e => setLimitOverrides(prev => ({ ...prev, [limit.key]: Number(e.target.value) }))}
                          className="w-full px-3.5 py-1.5 border border-indigo-200 text-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold block bg-slate-50 border border-slate-150 p-2 rounded-lg text-center">Inherited from Plan Template</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Feature Overrides Card */}
            <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 sm:p-8 text-left space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 tracking-tight">SaaS Feature Overrides</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Override feature locks specifically for this school. Check "Override" to force-enable or force-disable a feature.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {FEATURE_KEYS.map(feat => {
                  const active = featureEnabled[feat.code] || false
                  const value = featureOverrides[feat.code] || false

                  return (
                    <div 
                      key={feat.code}
                      className={`p-3 border rounded-2xl text-xs font-bold transition-all flex flex-col justify-between gap-3 ${
                        active 
                          ? 'border-indigo-250 bg-indigo-50/10' 
                          : 'border-slate-150 bg-slate-50/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-650 tracking-tight text-[11px] truncate" title={feat.label}>{feat.label}</span>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={e => setFeatureEnabled(prev => ({ ...prev, [feat.code]: e.target.checked }))}
                          className="cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </div>

                      {active ? (
                        <div className="flex items-center gap-2 select-none justify-center">
                          <button
                            type="button"
                            onClick={() => setFeatureOverrides(prev => ({ ...prev, [feat.code]: true }))}
                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                              value 
                                ? 'bg-emerald-500 text-white shadow' 
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            Enabled
                          </button>
                          <button
                            type="button"
                            onClick={() => setFeatureOverrides(prev => ({ ...prev, [feat.code]: false }))}
                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                              !value 
                                ? 'bg-rose-500 text-white shadow' 
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            Disabled
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-bold block bg-slate-100/50 p-1.5 rounded-lg text-center">Inherit</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Operational & Subscription Controls */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-5 text-left">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Access & Status Control</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Verify operational tags and configure SaaS plan subscription details.</p>
              </div>

              <div className="space-y-4 select-none">
                {/* Verification flag */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Verification Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-850 font-bold text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="approved">Approved (Active Access)</option>
                    <option value="pending">Pending Review</option>
                    <option value="suspended">Suspended (Blocked Access)</option>
                  </select>
                </div>

                {/* Plan select */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">SaaS Subscription Plan Template</label>
                  <select
                    value={planId}
                    onChange={e => setPlanId(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-850 font-bold text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="">-- Select Plan Template --</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} Plan</option>
                    ))}
                  </select>
                </div>

                {/* Billing Cycle select */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Billing Cycle</label>
                  <select
                    value={billingCycle}
                    onChange={e => setBillingCycle(e.target.value as any)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-850 font-bold text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="monthly">Monthly Cycle</option>
                    <option value="yearly">Yearly Cycle</option>
                  </select>
                </div>

                {/* Sub Status Select */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Subscription Billing Status</label>
                  <select
                    value={subStatusText}
                    onChange={e => setSubStatusText(e.target.value as any)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-850 font-bold text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="trial">Trialing</option>
                    <option value="active">Active Plan</option>
                    <option value="grace_period">Grace Period</option>
                    <option value="expired">Expired Access</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                {/* Days remaining & Grace days */}
                <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Days Remaining</label>
                    <input
                      type="number"
                      value={daysRemaining}
                      onChange={e => setDaysRemaining(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Grace Days</label>
                    <input
                      type="number"
                      value={gracePeriodDays}
                      onChange={e => setGracePeriodDays(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 bg-white"
                    />
                  </div>
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Subscription Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 bg-white"
                  />
                </div>

                {/* Submit action buttons */}
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition active:scale-95 shadow cursor-pointer text-center"
                  >
                    {saving ? 'Saving Panel...' : 'Save Configuration'}
                  </button>
                  <Link
                    href="/dashboard/superadmin/schools"
                    className="w-full border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold text-xs py-3 rounded-xl transition cursor-pointer text-center"
                  >
                    Cancel Changes
                  </Link>
                </div>
              </div>
            </div>

            {/* School Metadata card */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-3xl p-6 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant Registration Info</h3>
              </div>
              <div className="space-y-3.5 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Tenant Identifier</span>
                  <span className="font-mono text-[10px] text-slate-700 bg-white border border-slate-150 px-1.5 py-0.5 rounded select-all">{school.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Created Date</span>
                  <span className="font-semibold text-slate-700">{new Date(school.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Workspace Accent</span>
                  <span className="font-mono font-semibold text-slate-700 uppercase" style={{ color: themeColor }}>{themeColor}</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
