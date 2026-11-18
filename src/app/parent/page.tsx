'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function ParentLoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password')
  
  // Account setup states
  const [isRegistering, setIsRegistering] = useState(false)
  const [registerName, setRegisterName] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  
  // General UI states
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [simulatedOtp, setSimulatedOtp] = useState('')
  const [forgotPasswordActive, setForgotPasswordActive] = useState(false)
  
  const router = useRouter()

  // Activate dark class on document for styling theme consistency
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const cleanPhone = (phone: string) => {
    return phone.trim().replace(/\s+/g, '')
  }

  const handlePhoneVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      setErrorMsg('Please enter a valid registered phone number.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const targetPhone = cleanPhone(phoneNumber)

      // 1. Check if the phone number is registered in students table
      const { data: students, error: studentError } = await supabase
        .from('students')
        .select('id, full_name, parent_name, parent_phone, school_id')
        .eq('parent_phone', targetPhone)

      if (studentError) throw studentError

      if (!students || students.length === 0) {
        setErrorMsg('This phone number is not registered to any student in our system. Please contact school administration.')
        setLoading(false)
        return
      }

      // 2. Check if a profile exists with this phone number
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('phone', targetPhone)
        .maybeSingle()

      if (profileError) {
        console.error('Error fetching profile:', profileError)
      }

      if (!profileData) {
        // Parent exists in student records, but hasn't activated their login yet
        setIsRegistering(true)
        setRegisterName(students[0].parent_name || 'Parent User')
        setSuccessMsg('Phone number verified! Please set up a password for your account below.')
      } else {
        // Profile exists, ready for login
        setIsRegistering(false)
        if (loginMethod === 'otp') {
          // Send Simulated OTP
          const mockOtp = String(Math.floor(100000 + Math.random() * 900000))
          setSimulatedOtp(mockOtp)
          setOtpSent(true)
          setSuccessMsg(`Simulated SMS Sent! Use code: ${mockOtp}`)
        } else {
          setSuccessMsg('Account verified. Please enter your password to log in.')
        }
      }
    } catch (e: any) {
      console.error('Phone verification error:', e)
      setErrorMsg(e.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (registerPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const targetPhone = cleanPhone(phoneNumber)

      // 1. Register parent account via server-side API to bypass email confirmation
      const res = await fetch('/api/register-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          password: registerPassword,
          fullName: registerName
        })
      })

      const resData = await res.json()
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to register parent account.')
      }

      setSuccessMsg('Account registered successfully! Logging you in...')
      
      // Auto Sign In
      await handlePasswordLogin(targetPhone, registerPassword)

    } catch (e: any) {
      console.error('Registration error:', e)
      setErrorMsg(e.message || 'Registration failed. Please try again.')
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (phone: string, pass: string) => {
    const targetPhone = cleanPhone(phone)
    const derivedEmail = `${targetPhone}@parent.schoolos.com`

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: derivedEmail,
      password: pass
    })

    if (signInError) throw signInError

    // Save session payload to local storage for backward compatibility with dashboard page
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name, parent_name, school_id')
      .eq('parent_phone', targetPhone)

    if (students && students.length > 0) {
      const matchedSchoolId = students[0].school_id
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', matchedSchoolId)
        .single()

      localStorage.setItem('schoolos_parent_session', JSON.stringify({
        parentPhone: targetPhone,
        parentName: students[0].parent_name || 'Parent User',
        schoolId: matchedSchoolId,
        schoolName: schoolData?.name || 'School-OS',
        studentIds: students.map(s => s.id)
      }))
    }

    router.push('/parent/dashboard')
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const targetPhone = cleanPhone(phoneNumber)

      if (loginMethod === 'password') {
        if (!password) {
          setErrorMsg('Please enter your password.')
          setLoading(false)
          return
        }
        await handlePasswordLogin(targetPhone, password)
      } else {
        // OTP Login
        if (otpCode !== simulatedOtp) {
          setErrorMsg('Invalid verification OTP code.')
          setLoading(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', targetPhone)
          .single()

        if (!profile) {
          throw new Error('Account profile not active.')
        }

        // Retrieve student information
        const { data: students } = await supabase
          .from('students')
          .select('id, parent_name, school_id')
          .eq('parent_phone', targetPhone)

        if (students && students.length > 0) {
          const matchedSchoolId = students[0].school_id
          const { data: schoolData } = await supabase
            .from('schools')
            .select('name')
            .eq('id', matchedSchoolId)
            .single()

          localStorage.setItem('schoolos_parent_session', JSON.stringify({
            parentPhone: targetPhone,
            parentName: students[0].parent_name || 'Parent User',
            schoolId: matchedSchoolId,
            schoolName: schoolData?.name || 'School-OS',
            studentIds: students.map(s => s.id)
          }))
          
          router.push('/parent/dashboard')
        } else {
          throw new Error('Associated student records not found.')
        }
      }
    } catch (e: any) {
      console.error('Login error:', e)
      setErrorMsg(e.message || 'Login failed. Please check credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    if (!phoneNumber) {
      setErrorMsg('Please input your phone number.')
      return
    }
    setSuccessMsg('If this number is registered, a password reset instruction has been sent (Simulated).')
    setForgotPasswordActive(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans select-none text-slate-100">
      {/* Background radial blurs */}
      <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-650/10 blur-[130px] pointer-events-none" />

      {/* Main Form container */}
      <div className="max-w-md w-full bg-slate-900/40 border border-slate-850 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6 backdrop-blur-md">
        
        {/* Brand Header layout */}
        <div className="text-center space-y-3">
          <div className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-650 via-indigo-600 to-blue-500 text-white font-black text-xl shadow shadow-indigo-600/35">
            ★
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-none">
              Student OS
            </h1>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">Personal Learning Hub</span>
          </div>
        </div>

        {/* Messaging Logs banners */}
        {errorMsg && (
          <div className="text-xs font-bold text-rose-400 bg-rose-950/20 border border-rose-900/30 rounded-2xl px-4.5 py-3 text-center leading-normal animate-fadeIn">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="text-xs font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl px-4.5 py-3 text-center leading-normal animate-fadeIn">
            ✓ {successMsg}
          </div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {forgotPasswordActive ? (
          <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
            <h2 className="text-sm font-black dark:text-white uppercase tracking-wider">Reset Password</h2>
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest pl-0.5">
                Registered Mobile Number
              </label>
              <input
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                className="w-full bg-slate-950/40 border border-slate-850 rounded-2xl px-4 py-3.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-slate-700 transition"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="flex gap-2 select-none">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl shadow transition active:scale-95 cursor-pointer text-center"
              >
                Send Code
              </button>
              <button
                type="button"
                onClick={() => setForgotPasswordActive(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-400 font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl transition cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : isRegistering ? (
          /* REGISTRATION / ACCOUNT SETUP FLOW */
          <form onSubmit={handleRegister} className="space-y-4 text-left">
            <div className="space-y-1 bg-slate-950/40 border border-slate-850 p-4 rounded-2xl text-xs">
              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Student Parent Record:</span>
              <span className="text-indigo-400 font-extrabold text-sm block">{registerName}</span>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">
                Create Portal Password
              </label>
              <input
                type="password"
                placeholder="Choose a strong password"
                className="w-full bg-slate-950/40 border border-slate-850 rounded-2xl px-4 py-3.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-slate-700 transition"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-black text-xs uppercase tracking-wider py-4 rounded-2xl shadow transition active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Processing...' : 'Activate Portal & Log In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(false)
                setSuccessMsg('')
              }}
              className="w-full text-[10px] font-black text-slate-500 hover:text-slate-400 uppercase tracking-widest text-center mt-2 cursor-pointer transition-colors"
            >
              Cancel Account Setup
            </button>
          </form>
        ) : (
          /* STANDARD LOGIN / INITIAL VERIFICATION FLOW */
          <div className="space-y-6">
            
            {/* Password vs OTP selection tabs */}
            <div className="flex border-b border-slate-850/80 select-none">
              <button
                type="button"
                className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  loginMethod === 'password' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-350'
                }`}
                onClick={() => {
                  setLoginMethod('password')
                  setOtpSent(false)
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
              >
                Password Login
              </button>
              <button
                type="button"
                className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  loginMethod === 'otp' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-350'
                }`}
                onClick={() => {
                  setLoginMethod('otp')
                  setErrorMsg('')
                  setSuccessMsg('')
                }}
              >
                OTP Verification
              </button>
            </div>

            {/* Input Phone Section */}
            <form onSubmit={handlePhoneVerification} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">
                  Registered Parent Phone Number
                </label>
                <div className="relative flex items-center bg-slate-950/40 border border-slate-850 rounded-2xl px-4 py-3.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-slate-700 transition">
                  <span className="text-sm font-semibold text-slate-500 mr-2 shrink-0">📱</span>
                  <input
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    className="bg-transparent border-none outline-none text-xs text-white w-full placeholder-slate-600 focus:outline-none font-bold"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="text-[10px] font-black text-indigo-400 hover:text-indigo-400 transition uppercase tracking-wider shrink-0 cursor-pointer"
                  >
                    Verify
                  </button>
                </div>
              </div>
            </form>

            {/* Input Credentials step */}
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
              {loginMethod === 'password' ? (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">
                    Account Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    className="w-full bg-slate-950/40 border border-slate-850 rounded-2xl px-4 py-3.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-slate-700 transition font-bold"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              ) : (
                otpSent && (
                  <div className="space-y-1.5 animate-fadeIn text-center">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5 text-left">
                      Enter Verification Code
                    </label>
                    <input
                      type="text"
                      placeholder="6-digit OTP"
                      className="w-full bg-slate-950/40 border border-slate-850 rounded-2xl px-4 py-3.5 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-slate-700 transition text-center tracking-widest font-black"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={6}
                    />
                  </div>
                )
              )}

              <button
                type="submit"
                disabled={loading || (loginMethod === 'otp' && !otpSent)}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-black text-xs uppercase tracking-wider py-4 rounded-2xl shadow transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Processing...' : 'Access Portal Hub'}
              </button>
            </form>

            <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest px-1.5 select-none">
              <button
                type="button"
                onClick={() => setForgotPasswordActive(true)}
                className="hover:text-slate-400 transition cursor-pointer"
              >
                Forgot Password?
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="hover:text-slate-400 transition cursor-pointer animate-pulse"
              >
                ← Public Site
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
