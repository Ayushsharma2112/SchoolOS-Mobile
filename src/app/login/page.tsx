'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Validation & Error States
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [shouldShake, setShouldShake] = useState(false)
  const [successRing, setSuccessRing] = useState(false)

  // Client-side Rate Limiting (Brute force protection)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutTime, setLockoutTime] = useState<number | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState(0)

  const router = useRouter()

  // Handle countdown for lockout
  useEffect(() => {
    if (!lockoutTime) return
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutTime - Date.now()) / 1000))
      setSecondsRemaining(remaining)
      if (remaining === 0) {
        setLockoutTime(null)
        setFailedAttempts(0)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lockoutTime])

  // Email Regex Validator
  const validateEmail = (val: string) => {
    setEmail(val)
    if (!val) {
      setEmailError('Email address is required')
      return false
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!regex.test(val)) {
      setEmailError('Please enter a valid email address')
      return false
    }
    setEmailError('')
    return true
  }

  // Password Length Validator
  const validatePassword = (val: string) => {
    setPassword(val)
    if (!val) {
      setPasswordError('Password is required')
      return false
    }
    if (val.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      return false
    }
    setPasswordError('')
    return true
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    
    // Check Lockout
    if (lockoutTime && Date.now() < lockoutTime) {
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 500)
      return
    }

    // Run Validations
    const isEmailValid = validateEmail(email)
    const isPasswordValid = validatePassword(password)
    if (!isEmailValid || !isPasswordValid) {
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 500)
      return
    }

    setLoading(true)
    setGeneralError('')

    try {
      if (!isSupabaseConfigured) {
        setGeneralError('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.')
        setLoading(false)
        setShouldShake(true)
        setTimeout(() => setShouldShake(false), 500)
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        // Increment brute-force limiter
        const nextAttempts = failedAttempts + 1
        setFailedAttempts(nextAttempts)
        
        if (nextAttempts >= 5) {
          const blockUntil = Date.now() + 30 * 1000 // 30 seconds block
          setLockoutTime(blockUntil)
          setSecondsRemaining(30)
          setGeneralError('Too many failed attempts. Access locked for 30 seconds.')
        } else {
          setGeneralError(error.message || 'Invalid email or password.')
        }

        setLoading(false)
        setShouldShake(true)
        setTimeout(() => setShouldShake(false), 500)
        return
      }

      if (data?.user) {
        // Trigger success animation
        setSuccessRing(true)
        setTimeout(() => {
          router.push('/dashboard')
        }, 800)
      }
    } catch (e: any) {
      console.error('Login error:', e)
      const isFetchError = e?.message?.includes('Failed to fetch') || e?.name === 'TypeError' || String(e).includes('Failed to fetch')
      setGeneralError(
        isFetchError
          ? 'Network error: Failed to connect to Supabase backend. Please check your internet connection and .env.local configuration.'
          : (e?.message || 'An unexpected server error occurred.')
      )
      setLoading(false)
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 500)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* ========================================================
          LEFT SIDE — Premium SaaS Illustration & Spotlights
          ======================================================== */}
      <div className="hidden lg:flex w-1/2 bg-slate-950 border-r border-slate-900 flex-col justify-between p-12 relative overflow-hidden select-none">
        {/* Background Gradients & Grids */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_80%,transparent_100%)] pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[380px] h-[380px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none z-0" />
        <div className="absolute top-[10%] left-[-10%] w-[300px] h-[300px] bg-violet-600/5 rounded-full blur-[120px] pointer-events-none z-0" />

        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
          <span className="text-lg font-black bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent tracking-tight">SchoolOS</span>
        </div>

        {/* Dynamic Mockup Widgets */}
        <div className="space-y-6 relative z-10 max-w-md mx-auto w-full my-auto">
          {/* Card 1: Roster Analytics Graph */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-3xl backdrop-blur-md space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-900 pb-2">
              <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">Weekly Student Check-ins</span>
              <span className="text-[9px] font-extrabold text-emerald-450 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">98.4% Average</span>
            </div>
            
            {/* Inline SVG Chart */}
            <div className="h-16 flex items-end justify-between gap-2.5 pt-2 select-none">
              <div className="w-full bg-slate-950 rounded-lg border border-slate-900 h-10 relative overflow-hidden flex flex-col justify-end group">
                <div className="w-full bg-indigo-550/80 rounded-t h-[82%] group-hover:bg-indigo-500 transition duration-300" />
                <span className="text-[7px] text-slate-550 absolute bottom-1.5 left-1/2 transform -translate-x-1/2 font-bold">M</span>
              </div>
              <div className="w-full bg-slate-950 rounded-lg border border-slate-900 h-12 relative overflow-hidden flex flex-col justify-end group">
                <div className="w-full bg-indigo-550/80 rounded-t h-[94%] group-hover:bg-indigo-500 transition duration-300" />
                <span className="text-[7px] text-slate-550 absolute bottom-1.5 left-1/2 transform -translate-x-1/2 font-bold">T</span>
              </div>
              <div className="w-full bg-slate-950 rounded-lg border border-slate-900 h-14 relative overflow-hidden flex flex-col justify-end group">
                <div className="w-full bg-indigo-550/80 rounded-t h-[88%] group-hover:bg-indigo-500 transition duration-300" />
                <span className="text-[7px] text-slate-550 absolute bottom-1.5 left-1/2 transform -translate-x-1/2 font-bold">W</span>
              </div>
              <div className="w-full bg-slate-950 rounded-lg border border-slate-900 h-16 relative overflow-hidden flex flex-col justify-end group">
                <div className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t h-[98%] shadow-[0_-2px_10px_rgba(99,102,241,0.15)]" />
                <span className="text-[7px] text-indigo-300 absolute bottom-1.5 left-1/2 transform -translate-x-1/2 font-bold">T</span>
              </div>
              <div className="w-full bg-slate-950 rounded-lg border border-slate-900 h-12 relative overflow-hidden flex flex-col justify-end group">
                <div className="w-full bg-indigo-550/80 rounded-t h-[90%] group-hover:bg-indigo-500 transition duration-300" />
                <span className="text-[7px] text-slate-550 absolute bottom-1.5 left-1/2 transform -translate-x-1/2 font-bold">F</span>
              </div>
            </div>
          </div>

          {/* Card 2: AI Teacher Assistant notification */}
          <div className="bg-slate-900/40 border border-slate-850 p-4.5 rounded-3xl backdrop-blur-md flex items-start gap-3 shadow-lg">
            <span className="text-base bg-indigo-500/10 p-2 rounded-xl text-indigo-400">🤖</span>
            <div className="leading-normal">
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block">AI Copilot</span>
              <p className="text-xs text-slate-300 font-medium mt-1">Class 9A Calculus homework worksheet auto-drafted and synced successfully.</p>
              <span className="text-[8px] text-slate-550 block mt-1">Today at 10:42 AM</span>
            </div>
          </div>

          {/* Card 3: Basic Statistics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-2xl">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Operational Status</span>
              <span className="text-xs font-black text-emerald-450 mt-1 block flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse" />
                Secure Systems Active
              </span>
            </div>
            <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-2xl">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Cloud Sync Latency</span>
              <span className="text-xs font-black text-white mt-1 block">12ms Response</span>
            </div>
          </div>
        </div>

        {/* Footer Tagline */}
        <div className="text-left relative z-10 select-none">
          <p className="text-xs text-slate-500 font-semibold tracking-wide">
            "The AI Operating System for Modern Schools"
          </p>
        </div>
      </div>

      {/* ========================================================
          RIGHT SIDE — Modern Authentication Card
          ======================================================== */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 sm:p-12 relative bg-slate-950">
        
        {/* Back to website button */}
        <div className="flex justify-between lg:justify-end items-center select-none z-10">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="text-xs font-black text-white tracking-tight">SchoolOS</span>
          </div>
          <Link
            href="/"
            className="text-[10px] font-black text-slate-450 hover:text-white uppercase tracking-widest border border-slate-850 rounded-xl px-4.5 py-2 hover:border-slate-700 transition"
          >
            ← Back to Web
          </Link>
        </div>

        {/* Centered login form box */}
        <div className="max-w-md w-full mx-auto my-auto z-10 py-8">
          <div className={`space-y-6 transition-transform duration-300 ${shouldShake ? 'animate-shake' : ''}`}>
            
            {/* Form Headers */}
            <div className="space-y-1 text-center lg:text-left">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Welcome Back</h2>
              <p className="text-xs text-slate-450 font-medium">Use your school administrator or teacher email to continue.</p>
            </div>

            {/* General Errors banner */}
            {generalError && (
              <div className="bg-rose-950/40 border border-rose-900/40 rounded-2xl p-4 text-xs font-semibold text-rose-300 flex items-start gap-2.5 animate-fadeIn">
                <span className="text-sm leading-none">⚠️</span>
                <p className="leading-relaxed">{generalError}</p>
              </div>
            )}

            {/* Standard Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">Email Address</label>
                <input
                  type="email"
                  placeholder="name@school.com"
                  disabled={loading || !!lockoutTime}
                  className={`w-full bg-slate-900 border text-xs text-slate-200 font-bold rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500/20 transition ${
                    emailError ? 'border-rose-900 focus:border-rose-700 focus:ring-rose-500/10' : 'border-slate-800 focus:border-slate-600'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  value={email}
                  onChange={(e) => validateEmail(e.target.value)}
                />
                {emailError && <span className="text-[10px] text-rose-455 font-bold pl-0.5 block">{emailError}</span>}
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center pl-0.5">
                  <label className="block text-[9px] font-black text-slate-455 uppercase tracking-widest">Password</label>
                  <a href="#support" className="text-[9px] font-black text-slate-500 hover:text-indigo-400 uppercase tracking-widest">Forgot?</a>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    disabled={loading || !!lockoutTime}
                    className={`w-full bg-slate-900 border text-xs text-slate-200 font-bold rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500/20 transition pr-12 ${
                      passwordError ? 'border-rose-900 focus:border-rose-700 focus:ring-rose-500/10' : 'border-slate-800 focus:border-slate-600'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                    value={password}
                    onChange={(e) => validatePassword(e.target.value)}
                  />
                  {/* Eye Toggle Icon */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none select-none cursor-pointer"
                  >
                    {showPassword ? (
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordError && <span className="text-[10px] text-rose-455 font-bold pl-0.5 block">{passwordError}</span>}
              </div>

              {/* Remember Me Toggle */}
              <div className="flex items-center gap-2.5 py-1.5 select-none">
                <input
                  type="checkbox"
                  id="remember-me"
                  className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-650 focus:ring-indigo-500/20"
                />
                <label htmlFor="remember-me" className="text-[10px] font-black text-slate-450 uppercase tracking-widest cursor-pointer">
                  Remember session credentials
                </label>
              </div>

              {/* Login CTA Button */}
              <button
                type="submit"
                disabled={loading || !!lockoutTime}
                className={`w-full py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest text-center cursor-pointer transition-all active:scale-[0.98] ${
                  successRing 
                    ? 'bg-emerald-650 text-white ring-4 ring-emerald-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating Session
                  </span>
                ) : successRing ? (
                  'Verification Successful'
                ) : lockoutTime ? (
                  `Access Locked (${secondsRemaining}s)`
                ) : (
                  'Login'
                )}
              </button>
            </form>



            {/* Help / Need help box */}
            <div className="p-4.5 rounded-2xl border border-slate-900 bg-slate-900/20 text-center select-none text-[10px] font-medium leading-relaxed text-slate-450">
              Need an institution administrator account? <br />
              <a href="mailto:admin@schoolos.com" className="text-indigo-400 hover:underline font-bold">Contact Management Office</a>
            </div>

          </div>
        </div>

        {/* Legal Link Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold text-slate-500 pt-8 gap-3 select-none">
          <span>© 2026 SchoolOS ERP Inc.</span>
          <div id="support" className="flex gap-4">
            <a href="#support" onClick={() => alert('SchoolOS Terms of Service')} className="hover:text-slate-300 transition">Terms</a>
            <a href="#support" onClick={() => alert('SchoolOS Privacy Policy')} className="hover:text-slate-300 transition">Privacy</a>
            <a href="mailto:support@schoolos.com" className="hover:text-slate-300 transition">Support</a>
          </div>
        </div>

      </div>
    </div>
  )
}
