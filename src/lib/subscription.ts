import { supabase } from './supabase'

export type SubscriptionPlan = 'Trial' | 'Starter' | 'Professional' | 'Enterprise' | 'Custom'

export type SubscriptionStatus = 'trial' | 'active' | 'grace_period' | 'expired' | 'cancelled' | 'suspended'

export type SubscriptionDetails = {
  id: string
  school_id: string
  plan_name: SubscriptionPlan
  plan_id: string | null
  billing_cycle: 'monthly' | 'yearly'
  status: SubscriptionStatus
  trial_start: string
  trial_end: string
  subscription_start: string | null
  subscription_end: string | null
  days_remaining: number
  is_active: boolean
  grace_period_days: number
  grace_period_end: string
  payment_reference: string | null
  created_at: string
  updated_at: string
  max_students: number
  max_teachers: number
  max_admins: number

  // Dynamic limits and features loaded from DB
  limits: Record<string, number>
  features: Record<string, boolean>
  usage: Record<string, { used: number; limit: number; pct: number }>
}

// Client-side fallback limits mapping (used when database has not yet been migrated)
export const PLAN_LIMITS: Record<SubscriptionPlan, Record<string, number>> = {
  Trial: {
    students: 20,
    teachers: 5,
    admins: 1,
    parents: 40,
    classes: 5,
    branches: 1,
    file_storage: 0.1, // 100MB
    ai_credits: 100,
    whatsapp_messages: 50,
    homework_per_month: 30,
    email_notifications: 500,
    sms_notifications: 100
  },
  Starter: {
    students: 200,
    teachers: 20,
    admins: 3,
    parents: 400,
    classes: 10,
    branches: 1,
    file_storage: 2.0, // 2GB
    ai_credits: 2000,
    whatsapp_messages: 500,
    homework_per_month: -1, // Unlimited
    email_notifications: 5000,
    sms_notifications: 1000
  },
  Professional: {
    students: 1000,
    teachers: 100,
    admins: 10,
    parents: 2000,
    classes: -1,
    branches: 5,
    file_storage: 15.0, // 15GB
    ai_credits: 15000,
    whatsapp_messages: 5000,
    homework_per_month: -1,
    email_notifications: 50000,
    sms_notifications: 10000
  },
  Enterprise: {
    students: -1,
    teachers: -1,
    admins: -1,
    parents: -1,
    classes: -1,
    branches: 20,
    file_storage: 100.0, // 100GB
    ai_credits: -1,
    whatsapp_messages: -1,
    homework_per_month: -1,
    email_notifications: -1,
    sms_notifications: -1
  },
  Custom: {
    students: 500,
    teachers: 50,
    admins: 5,
    parents: 1000,
    classes: 20,
    branches: 3,
    file_storage: 10.0,
    ai_credits: 5000,
    whatsapp_messages: 1000,
    homework_per_month: -1,
    email_notifications: 10000,
    sms_notifications: 2000
  }
}

// Client-side fallback feature flags
export const PLAN_FEATURES: Record<SubscriptionPlan, Record<string, boolean>> = {
  Trial: {
    parent_portal: true,
    email: true,
    ai_assistant: true,
    library: false,
    transport: false,
    analytics: false,
    custom_reports: false,
    public_api: false,
    white_label_branding: false
  },
  Starter: {
    parent_portal: true,
    email: true,
    sms: true,
    ai_assistant: true,
    library: false,
    transport: false,
    analytics: false,
    custom_reports: false,
    public_api: false,
    white_label_branding: false
  },
  Professional: {
    parent_portal: true,
    email: true,
    sms: true,
    whatsapp_integration: true,
    ai_assistant: true,
    library: true,
    transport: true,
    analytics: true,
    custom_reports: true,
    public_api: false,
    white_label_branding: false
  },
  Enterprise: {
    parent_portal: true,
    email: true,
    sms: true,
    whatsapp_integration: true,
    ai_assistant: true,
    library: true,
    transport: true,
    analytics: true,
    custom_reports: true,
    public_api: true,
    white_label_branding: true
  },
  Custom: {
    parent_portal: true,
    email: true,
    sms: true,
    whatsapp_integration: true,
    ai_assistant: true,
    library: true,
    transport: true,
    analytics: true,
    custom_reports: true,
    public_api: true,
    white_label_branding: true
  }
}

/**
 * Fetch subscription status and automatically transition phases dynamically.
 * Aggregates database-configured limits, feature flags, overrides and current usage statistics.
 */
export async function checkAndGetSubscription(schoolId: string): Promise<SubscriptionDetails | null> {
  if (!schoolId) return null

  try {
    // 1. Fetch current subscription entry
    let { data: sub, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle()

    // 2. If no subscription exists, initialize a default 14-day Trial subscription
    if (!sub || error) {
      const trialStart = new Date()
      const trialEnd = new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000)
      const graceEnd = new Date(trialEnd.getTime() + 7 * 24 * 60 * 60 * 1000)

      // Look up Trial plan template ID in DB if tables are migrated
      let dbTrialPlanId: string | null = null
      try {
        const { data: trialPlan } = await supabase
          .from('subscription_plans')
          .select('id')
          .eq('name', 'Trial')
          .maybeSingle()
        if (trialPlan) {
          dbTrialPlanId = trialPlan.id
        }
      } catch (err) {}

      const { data: newSub, error: createError } = await supabase
        .from('subscriptions')
        .insert({
          school_id: schoolId,
          plan_name: 'Trial',
          plan_id: dbTrialPlanId,
          billing_cycle: 'monthly',
          status: 'trial',
          trial_start: trialStart.toISOString(),
          trial_end: trialEnd.toISOString(),
          days_remaining: 14,
          is_active: true,
          grace_period_days: 7,
          grace_period_end: graceEnd.toISOString(),
        })
        .select()
        .single()

      if (createError) throw createError
      sub = newSub

      // Log audit
      await logSubscriptionAudit(schoolId, 'subscription_created', null, 'Trial', null, 'trial', {
        details: 'Initial trial subscription created automatically.'
      })
    }

    // 3. Compute subscription state transitions dynamically
    const now = new Date()
    let computedStatus = sub.status as SubscriptionStatus
    let computedDays = 0

    const endDate = sub.subscription_end ? new Date(sub.subscription_end) : new Date(sub.trial_end)
    const graceDate = new Date(sub.grace_period_end)

    const diffMs = endDate.getTime() - now.getTime()
    computedDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

    // Automatically transition states if not suspended or cancelled
    if (sub.status !== 'suspended' && sub.status !== 'cancelled') {
      if (now <= endDate) {
        computedStatus = sub.subscription_end ? 'active' : 'trial'
      } else if (now <= graceDate) {
        computedStatus = 'grace_period'
      } else {
        computedStatus = 'expired'
      }
    }

    // Adjust days remaining for grace period if expired
    if (computedStatus === 'grace_period') {
      const graceDiff = graceDate.getTime() - now.getTime()
      computedDays = Math.max(0, Math.ceil(graceDiff / (1000 * 60 * 60 * 24)))
    }

    // 4. Update the DB row cache if status/days changed
    if (computedStatus !== sub.status || computedDays !== sub.days_remaining) {
      const { data: updatedSub } = await supabase
        .from('subscriptions')
        .update({
          status: computedStatus,
          days_remaining: computedDays,
          updated_at: new Date().toISOString()
        })
        .eq('id', sub.id)
        .select()
        .single()

      if (updatedSub) {
        // Log status change audit
        await logSubscriptionAudit(schoolId, 'plan_changed', sub.plan_name, sub.plan_name, sub.status, computedStatus, {
          details: 'Status transitioned automatically based on elapsed calendar dates.'
        })
        sub = updatedSub
      }
    }

    // 5. Fetch plan template configuration dynamically from Database
    const planName = sub.plan_name as SubscriptionPlan
    const planId = sub.plan_id

    // Initialize resolved limits/features with hardcoded client fallbacks
    const resolvedLimits = { ...PLAN_LIMITS[planName] }
    const resolvedFeatures = { ...PLAN_FEATURES[planName] }

    if (planId) {
      try {
        // A. Load plan template limits
        const { data: dbLimits } = await supabase
          .from('plan_limits')
          .select('limit_key, limit_value')
          .eq('plan_id', planId)
        
        if (dbLimits && dbLimits.length > 0) {
          dbLimits.forEach(dl => {
            resolvedLimits[dl.limit_key] = dl.limit_value
          })
        }

        // B. Load plan template features
        const { data: dbFeatures } = await supabase
          .from('plan_features')
          .select('feature_code, is_enabled')
          .eq('plan_id', planId)

        if (dbFeatures && dbFeatures.length > 0) {
          dbFeatures.forEach(df => {
            resolvedFeatures[df.feature_code] = df.is_enabled
          })
        }

        // C. Merge subscription limit overrides (specific to this school)
        const { data: limitOverrides } = await supabase
          .from('subscription_limit_overrides')
          .select('limit_key, limit_value')
          .eq('subscription_id', sub.id)

        if (limitOverrides && limitOverrides.length > 0) {
          limitOverrides.forEach(lo => {
            resolvedLimits[lo.limit_key] = lo.limit_value
          })
        }

        // D. Merge subscription feature overrides (specific to this school)
        const { data: featureOverrides } = await supabase
          .from('subscription_feature_overrides')
          .select('feature_code, is_enabled')
          .eq('subscription_id', sub.id)

        if (featureOverrides && featureOverrides.length > 0) {
          featureOverrides.forEach(fo => {
            resolvedFeatures[fo.feature_code] = fo.is_enabled
          })
        }
      } catch (dbErr) {
        console.warn('Failed to load dynamic subscription configurations from DB, using fallback defaults:', dbErr)
      }
    }

    // 6. Gather Usage Statistics (Try RPC first, otherwise query manually on client side)
    const usageStats: Record<string, number> = {
      students: 0,
      teachers: 0,
      admins: 0,
      parents: 0,
      classes: 0,
      file_storage: 0,
      ai_credits: 0,
      whatsapp_messages: 0,
      email_notifications: 0,
      sms_notifications: 0
    }

    let rpcSuccessful = false
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_school_usage_stats', { p_school_id: schoolId })
      if (!rpcErr && data && data.length > 0) {
        const stats = data[0]
        usageStats.students = stats.students_used || 0
        usageStats.teachers = stats.teachers_used || 0
        usageStats.admins = stats.admins_used || 0
        usageStats.parents = stats.parents_used || 0
        usageStats.classes = stats.classes_used || 0
        usageStats.file_storage = Number(stats.storage_used_gb || 0)
        usageStats.ai_credits = stats.ai_used || 0
        usageStats.whatsapp_messages = stats.whatsapp_used || 0
        usageStats.email_notifications = stats.email_used || 0
        usageStats.sms_notifications = stats.sms_used || 0
        rpcSuccessful = true
      }
    } catch (e) {}

    // Fallback: manual query resolution if DB triggers/RPC not available
    if (!rpcSuccessful) {
      try {
        const { count: studentCount } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
        usageStats.students = studentCount || 0

        const { count: teacherCount } = await supabase
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('role', 'Teacher')
        usageStats.teachers = teacherCount || 0

        const { count: adminCount } = await supabase
          .from('school_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('role', 'Admin')
        usageStats.admins = adminCount || 0

        const { count: parentCount } = await supabase
          .from('school_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('role', 'Parent')
        usageStats.parents = parentCount || 0

        const { count: classesCount } = await supabase
          .from('classes')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
        usageStats.classes = classesCount || 0

        const { data: docs } = await supabase
          .from('documents')
          .select('file_size')
          .eq('school_id', schoolId)
        const totalBytes = docs?.reduce((acc, doc) => acc + Number(doc.file_size || 0), 0) || 0
        usageStats.file_storage = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(3))

        const { data: usages } = await supabase
          .from('school_usage')
          .select('metric_key, current_value')
          .eq('school_id', schoolId)

        if (usages) {
          usages.forEach((u: any) => {
            if (u.metric_key in usageStats) {
              usageStats[u.metric_key] = Number(u.current_value)
            }
          })
        }
      } catch (fallbackErr) {
        console.warn('Fallback manual usage statistics query failed:', fallbackErr)
      }
    }

    // 7. Format structured usage map containing percentages
    const usageFormatted: Record<string, { used: number; limit: number; pct: number }> = {}
    Object.keys(resolvedLimits).forEach(key => {
      const used = usageStats[key] !== undefined ? usageStats[key] : 0
      const limit = resolvedLimits[key]
      let pct = 0
      if (limit > 0) {
        pct = Math.min(100, Math.round((used / limit) * 100))
      } else if (limit === 0) {
        pct = 100
      } else {
        pct = 0 // unlimited (-1)
      }
      usageFormatted[key] = { used, limit, pct }
    })

    return {
      ...sub,
      limits: resolvedLimits,
      features: resolvedFeatures,
      usage: usageFormatted
    } as SubscriptionDetails

  } catch (e: any) {
    console.error('Failed to resolve school subscription state:', e?.message || e)
    return null
  }
}

/**
 * Log subscription audit details
 */
export async function logSubscriptionAudit(
  schoolId: string,
  action: 'subscription_created' | 'renewed' | 'expired' | 'cancelled' | 'plan_changed' | 'payment_recorded',
  previousPlan: string | null,
  newPlan: string | null,
  previousStatus: string | null,
  newStatus: string | null,
  details: any = {}
) {
  try {
    await supabase
      .from('subscription_audit_logs')
      .insert({
        school_id: schoolId,
        action,
        previous_plan: previousPlan,
        new_plan: newPlan,
        previous_status: previousStatus,
        new_status: newStatus,
        details
      })
  } catch (e) {
    console.error('Audit log write failed:', e)
  }
}

/**
 * Perform server-side check of limits before registering resources.
 * Returns { blocked: boolean, reason: string, current: number, max: number }
 */
export async function verifyFeatureLimit(
  schoolId: string,
  limitKey: string
): Promise<{ blocked: boolean; reason: string; current: number; max: number }> {
  // 1. Fetch Subscription details
  const sub = await checkAndGetSubscription(schoolId)
  if (!sub) {
    return { blocked: false, reason: '', current: 0, max: -1 }
  }

  // Suspended or Expired states block additions
  if (sub.status === 'expired' || sub.status === 'suspended') {
    return { blocked: true, reason: 'Subscription is fully expired or suspended.', current: 0, max: 0 }
  }

  // Grace period blocks new admissions for students
  if (limitKey === 'students' && sub.status === 'grace_period') {
    return { blocked: true, reason: 'New admissions are blocked during subscription grace period.', current: 0, max: 0 }
  }

  const metricUsage = sub.usage[limitKey]
  if (!metricUsage) {
    // If limitKey is not tracked, allow by default
    return { blocked: false, reason: '', current: 0, max: -1 }
  }

  const maxLimit = metricUsage.limit
  const currentCount = metricUsage.used

  if (maxLimit === -1) {
    return { blocked: false, reason: '', current: currentCount, max: -1 }
  }

  return {
    blocked: currentCount >= maxLimit,
    reason: `Plan limits reached. Maximum allowed: ${maxLimit}.`,
    current: currentCount,
    max: maxLimit
  }
}

/**
 * Helper to check and increment usage dynamically for transactional metrics (AI credits, WhatsApp, etc.)
 */
export async function checkAndIncrementMetricUsage(
  schoolId: string,
  metricKey: string,
  increment: number = 1
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_and_increment_usage', {
      p_school_id: schoolId,
      p_metric_key: metricKey,
      p_increment: increment
    })
    
    if (!error && data !== null) {
      return data as boolean
    }
    
    // Client-side fallback if RPC fails
    const sub = await checkAndGetSubscription(schoolId)
    if (!sub) return true
    
    const usage = sub.usage[metricKey]
    if (!usage) return true
    
    if (usage.limit !== -1 && (usage.used + increment) > usage.limit) {
      return false
    }

    // Attempt direct insert
    await supabase.from('school_usage').upsert({
      school_id: schoolId,
      metric_key: metricKey,
      current_value: usage.used + increment,
      updated_at: new Date().toISOString()
    }, { onConflict: 'school_id,metric_key' })

    return true
  } catch (e) {
    console.error('Failed to increment metric usage:', e)
    return true // Allow as fallback
  }
}
