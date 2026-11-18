'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  StudentIcon,
  AttendanceIcon,
  HomeworkIcon,
  AIIcon,
  FeeIcon,
  PortalIcon,
  AnalyticsIcon,
  TransportIcon,
  LibraryIcon,
  InventoryIcon,
  CommunicationIcon,
  ChevronIcon,
  StarIcon,
  ArrowRightIcon,
  PlayIcon,
  ShieldIcon,
  SparklesIcon
} from '../components/landing/Icons'

export default function LandingPage() {
  // Interactive UI States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'teacher' | 'attendance' | 'homework' | 'mobile'>('dashboard')
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  // Features List Configuration
  const features = [
    {
      id: 'students',
      title: 'Student Directory',
      description: 'Manage rosters, admission records, parent associations, and complete academic profiles instantly.',
      icon: <StudentIcon className="w-5 h-5 text-indigo-400" />,
      tag: 'Core'
    },
    {
      id: 'attendance',
      title: 'Attendance Tracker',
      description: 'Record student daily attendance with automated notifications sent directly to parent portals.',
      icon: <AttendanceIcon className="w-5 h-5 text-emerald-400" />,
      tag: 'Real-time'
    },
    {
      id: 'homework',
      title: 'Homework Diaries',
      description: 'Publish assignments, attach references, and track student task completions in a unified workspace.',
      icon: <HomeworkIcon className="w-5 h-5 text-violet-400" />,
      tag: 'Sync'
    },
    {
      id: 'ai-assistant',
      title: 'AI Teacher Copilot',
      description: 'Auto-generate structured homework assignments, grade rubrics, and detailed lesson outlines with AI.',
      icon: <AIIcon className="w-5 h-5 text-fuchsia-400" />,
      tag: 'AI Power'
    },
    {
      id: 'billing',
      title: 'Fee Management',
      description: 'Configure fee structures, generate invoices, accept online gateway payments, and generate invoices.',
      icon: <FeeIcon className="w-5 h-5 text-amber-400" />,
      tag: 'Billing'
    },
    {
      id: 'parent',
      title: 'Parent Portal',
      description: 'Provide parents with a clean mobile-friendly interface to track homework, attendance, and billing.',
      icon: <PortalIcon className="w-5 h-5 text-sky-400" />,
      tag: 'Family Hub'
    },
    {
      id: 'analytics',
      title: 'Academic Analytics',
      description: 'Visualize score distributions, term averages, attendance logs, and student performance metrics.',
      icon: <AnalyticsIcon className="w-5 h-5 text-rose-400" />,
      tag: 'Reports'
    },
    {
      id: 'transport',
      title: 'Transport Registry',
      description: 'Coordinate school bus routes, driver details, and student assignments to transport directories.',
      icon: <TransportIcon className="w-5 h-5 text-teal-400" />,
      tag: 'Logistics'
    },
    {
      id: 'library',
      title: 'Library System',
      description: 'Maintain book inventory, catalog check-outs, issue dates, and return timelines for student libraries.',
      icon: <LibraryIcon className="w-5 h-5 text-cyan-400" />,
      tag: 'Resources'
    },
    {
      id: 'inventory',
      title: 'Asset Inventory',
      description: 'Track school assets, classroom supplies, stock levels, and procurement records dynamically.',
      icon: <InventoryIcon className="w-5 h-5 text-blue-400" />,
      tag: 'Assets'
    },
    {
      id: 'communication',
      title: 'Smart Messaging',
      description: 'Send circular notices, direct parent-teacher communications, and school-wide alerts.',
      icon: <CommunicationIcon className="w-5 h-5 text-purple-400" />,
      tag: 'Instant'
    }
  ]

  // Testimonials Configuration
  const testimonials = [
    {
      quote: "SchoolOS has completely transformed our administrative overhead. We cut enrollment processing times by 80% and parents are thrilled with the real-time homework updates.",
      name: "Dr. Aranya Sen",
      role: "Principal",
      institution: "Greenwood International School",
      rating: 5,
      avatar: "AS"
    },
    {
      quote: "The AI homework copilot alone saves me 5 hours every single week. I can draft lesson plans and publish homework assignments targeting specific students in less than 30 seconds.",
      name: "Meera Nair",
      role: "Science Head",
      institution: "Delhi Public School",
      rating: 5,
      avatar: "MN"
    },
    {
      quote: "Being able to verify my child's attendance log, check their homework deadlines, and pay school term fees directly from my phone has made parenting so much easier.",
      name: "Rohan Sharma",
      role: "Parent of Ayush Sharma",
      institution: "Modern Academy",
      rating: 5,
      avatar: "RS"
    },
    {
      quote: "Our billing process was a mess of spreadsheets and reminders. SchoolOS automated our monthly fee invoices and parent reminders, improving collections by 35% in just 2 months.",
      name: "Sunita Deshmukh",
      role: "Finance Officer",
      institution: "Springfield High",
      rating: 5,
      avatar: "SD"
    }
  ]

  // FAQ Configuration
  const faqs = [
    {
      q: "How long does it take to migrate our existing school data?",
      a: "Importing your rosters is instantaneous. You can upload student, class, parent, and subject directories using standard CSV spreadsheets. Our team handles complete end-to-end database onboarding for your school in less than 24 hours."
    },
    {
      q: "Can parents make online payments through the SchoolOS Parent Portal?",
      a: "Yes! SchoolOS integrates with secure local payment gateways. Parents can log into the Family Hub, select pending fee receipts, and pay instantly via card, netbanking, or mobile wallets with automatic invoice generation."
    },
    {
      q: "Is the AI Teacher Copilot secure and private?",
      a: "Absolutely. Our AI helpers operate strictly within the school context using sandbox API parameters. Your student records, homework instructions, and class timetables are encrypted and never shared with public model training logs."
    },
    {
      q: "Does SchoolOS support role-based dashboard access?",
      a: "Yes, SchoolOS has native support for granular tenant security roles: SuperAdmin, Admin, Teacher, Accountant, Receptionist, and Parents. Each profile is restricted by matching row-level database RLS controls."
    }
  ]

  return (
    <div className="relative w-full overflow-hidden min-h-screen bg-slate-950 text-slate-100 antialiased font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Cyber Grid Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0" />
      <div className="absolute top-[-10%] left-[50%] translate-x-[-50%] w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-[20%] left-[-10%] w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/5 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/40 h-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="text-lg font-black bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent tracking-tight">SchoolOS</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
            <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
            <a href="#showcase" className="hover:text-indigo-400 transition-colors">Showcase</a>
            <a href="#why" className="hover:text-indigo-400 transition-colors">Enterprise</a>
            <a href="#pricing" className="hover:text-indigo-400 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-indigo-400 transition-colors">Support</a>
          </nav>

          <div className="flex items-center gap-3.5">
            <Link
              href="/parent"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-xs font-bold text-slate-200 px-4.5 py-2.5 transition active:scale-[0.98]"
            >
              Parent Hub
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white px-4.5 py-2.5 transition shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              Staff Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-36 relative z-10">
        
        {/* ========================================================
            SECTION 1 — HERO
            ======================================================== */}
        <section className="text-center space-y-10 relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-950/65 px-4 py-1.5 text-xs font-bold text-indigo-300 border border-indigo-900/60 shadow-inner">
            <span className="inline-block h-2 w-2 rounded-full bg-indigo-455 animate-pulse" />
            <span className="flex items-center gap-1">
              <SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
              Introducing Autonomous AI Teacher Insights
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-4 max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight text-white">
              The AI Operating System for
              <span className="block bg-gradient-to-r from-indigo-450 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Modern School Systems
              </span>
            </h1>
            <p className="text-slate-400 text-base sm:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
              Unify student records, attendance logs, homework journals, parent billing portals, and classroom logistics under one lightning-fast SaaS command center.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-650 to-violet-650 text-sm font-bold text-white px-8 py-4 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:from-indigo-600 hover:to-violet-600 transition active:scale-[0.98]"
            >
              Start Free Trial
            </Link>
            <a
              href="#showcase"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-sm font-bold text-slate-300 px-8 py-4 transition active:scale-[0.98] backdrop-blur-sm"
            >
              Book Interactive Demo
            </a>
          </div>

          {/* SaaS Mockup with Overlay Analytics */}
          <div className="relative max-w-5xl mx-auto pt-6 group">
            {/* Soft Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent blur-3xl opacity-50 pointer-events-none" />

            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/20 p-3 sm:p-4 backdrop-blur-md shadow-2xl relative">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-inner flex flex-col h-[520px]">
                {/* Browser bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-900 bg-slate-950/60 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 block" />
                  </div>
                  <div className="bg-slate-900 border border-slate-850/80 text-[10px] text-slate-400 font-bold px-8 py-1 rounded-lg">
                    command.schoolos.com/dashboard
                  </div>
                  <span className="w-4 h-4" />
                </div>

                {/* Dashboard Inner Body */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Sidebar Mock */}
                  <div className="w-44 border-r border-slate-900 p-4 space-y-5 hidden sm:block bg-slate-950/20 text-left select-none">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-2">COMMAND</div>
                    <div className="space-y-1">
                      <div className="px-2 py-1.5 rounded-lg bg-indigo-950/40 text-indigo-400 text-[11px] font-extrabold flex items-center gap-2">
                        <span>📊</span> Overview
                      </div>
                      <div className="px-2 py-1.5 text-slate-400 text-[11px] font-bold flex items-center gap-2 hover:bg-slate-900/30">
                        <span>🧑‍🎓</span> Students
                      </div>
                      <div className="px-2 py-1.5 text-slate-400 text-[11px] font-bold flex items-center gap-2 hover:bg-slate-900/30">
                        <span>📝</span> Homework
                      </div>
                      <div className="px-2 py-1.5 text-slate-400 text-[11px] font-bold flex items-center gap-2 hover:bg-slate-900/30">
                        <span>💰</span> Billing
                      </div>
                      <div className="px-2 py-1.5 text-slate-450 text-[11px] font-bold flex items-center gap-2 hover:bg-slate-900/30">
                        <span>⚙️</span> Control Panel
                      </div>
                    </div>
                  </div>

                  {/* Mock content grid */}
                  <div className="flex-1 p-6 space-y-6 overflow-y-auto text-left select-none">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-base font-extrabold text-white">System Command Overview</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">Active Institution Metrics • Modern Academy Hub</p>
                      </div>
                      <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest bg-slate-900 px-2 py-1 rounded">V2.4 Active</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Roster Size</span>
                          <span className="text-xl font-black text-white mt-1 block">1,248</span>
                        </div>
                        <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg font-bold text-xs">🧑‍🎓</span>
                      </div>
                      <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Today's Attendance</span>
                          <span className="text-xl font-black text-emerald-400 mt-1 block">98.4%</span>
                        </div>
                        <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg font-bold text-xs">✓</span>
                      </div>
                      <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Fee Collections</span>
                          <span className="text-xl font-black text-amber-400 mt-1 block">$18,450</span>
                        </div>
                        <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg font-bold text-xs">💰</span>
                      </div>
                    </div>

                    {/* Lower grid splits */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Left: Homework logs */}
                      <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Recently Published Homework</span>
                          <span className="text-[9px] font-bold text-indigo-400">View All</span>
                        </div>
                        <div className="space-y-2">
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-850/60 flex items-center justify-between">
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-200">Intro to Calculus Derivatives</h5>
                              <span className="text-[8px] text-slate-500 mt-0.5 block">Mathematics • Grade 11A</span>
                            </div>
                            <span className="text-[8px] font-bold text-rose-400 bg-rose-950/40 border border-rose-900/30 px-2 py-0.5 rounded">High Priority</span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-850/60 flex items-center justify-between">
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-200">French Vocabulary Exercise 4</h5>
                              <span className="text-[8px] text-slate-500 mt-0.5 block">Languages • Grade 8B</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded">Low Priority</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: AI Activity logs */}
                      <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">AI Copilot Tasks</span>
                          <span className="text-[9px] font-bold text-fuchsia-455">Active</span>
                        </div>
                        <div className="space-y-2">
                          <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-850/40 flex items-center gap-2.5">
                            <span className="text-xs">🤖</span>
                            <div>
                              <p className="text-[10px] text-slate-350 leading-normal"><span className="text-white font-semibold">AI Assistant</span> auto-drafted homework worksheet: "French Vocabulary" for Class 8B.</p>
                              <span className="text-[8px] text-slate-500 block mt-0.5">2 minutes ago</span>
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-850/40 flex items-center gap-2.5">
                            <span className="text-xs">📈</span>
                            <div>
                              <p className="text-[10px] text-slate-350 leading-normal"><span className="text-white font-semibold">AI Analytics</span> detected a 4.2% spike in attendance averages this month.</p>
                              <span className="text-[8px] text-slate-500 block mt-0.5">1 hour ago</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Glassmorphic Cards */}
              <div className="absolute top-24 -left-12 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md w-44 text-left hidden lg:block animate-bounce [animation-duration:6s]">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-450 font-bold text-sm flex items-center justify-center">✓</span>
                  <div>
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Attendance</div>
                    <div className="text-xs font-extrabold text-white mt-0.5">1,124 Checked-In</div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-16 -right-16 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md w-48 text-left hidden lg:block animate-bounce [animation-duration:7s]">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-fuchsia-500/10 text-fuchsia-450 font-bold text-sm flex items-center justify-center">🤖</span>
                  <div>
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider">AI Copilot</div>
                    <div className="text-xs font-extrabold text-white mt-0.5">Grade 9A Marks Sync</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 2 — TRUST BAR & COUNTERS
            ======================================================== */}
        <section className="space-y-12 relative text-center border-y border-slate-900 py-12 bg-slate-950/20">
          <div className="space-y-2">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">TRUSTED WORLDWIDE</span>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-bold uppercase tracking-wider">Schools • Students • Teachers • Parents</p>
          </div>

          {/* Animated Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="space-y-1">
              <h3 className="text-3xl sm:text-4xl font-black text-white bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">150+</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Schools</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl sm:text-4xl font-black text-white bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">50k+</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enrolled Students</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl sm:text-4xl font-black text-white bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">1.5M+</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attendance Recorded</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl sm:text-4xl font-black text-white bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">800k+</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Homework Delivered</p>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 3 — PRODUCT FEATURES GRID
            ======================================================== */}
        <section id="features" className="space-y-16 text-center">
          <div className="space-y-3">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Core Ecosystem</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Full-Featured Management Infrastructure</h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto font-medium">Everything your school needs to operate autonomously, designed into a modular and clean experience.</p>
          </div>

          {/* Grid Container */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div 
                key={feature.id}
                className="bg-slate-900/20 border border-slate-850/65 rounded-3xl p-6 text-left hover:border-slate-800 hover:bg-slate-900/40 transition duration-300 flex flex-col justify-between group cursor-pointer"
              >
                <div className="space-y-4">
                  {/* Icon & Tag */}
                  <div className="flex justify-between items-center">
                    <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850 group-hover:border-slate-700 transition">
                      {feature.icon}
                    </div>
                    <span className="text-[8px] font-black text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded border border-slate-900/60 transition">
                      {feature.tag}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-white group-hover:text-indigo-455 transition uppercase tracking-wider">
                      {feature.title}
                    </h4>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-850/50 mt-5 pt-4 flex items-center justify-between text-[10px] font-bold text-slate-500 group-hover:text-white transition">
                  <span>Explore module features</span>
                  <span className="transform translate-x-0 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================
            SECTION 4 — DASHBOARD SHOWCASE
            ======================================================== */}
        <section id="showcase" className="space-y-12 text-center">
          <div className="space-y-3">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Interactive Showcase</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Experience the SchoolOS Interface</h2>
            <p className="text-xs text-slate-450 max-w-sm mx-auto font-medium">Click between modules to preview key administrative interfaces in high-fidelity.</p>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto bg-slate-950 p-2 rounded-2xl border border-slate-850/60 select-none">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'dashboard' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Overview Dashboard
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'students' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Student Directory
            </button>
            <button
              onClick={() => setActiveTab('teacher')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'teacher' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Teacher Workspace
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'attendance' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Attendance logs
            </button>
            <button
              onClick={() => setActiveTab('homework')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'homework' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Homework diaries
            </button>
            <button
              onClick={() => setActiveTab('mobile')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeTab === 'mobile' ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Parent Portal Mobile
            </button>
          </div>

          {/* Interactive Screen Preview */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl h-[480px] flex flex-col text-left">
            {/* Window bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-900 bg-slate-950/60 select-none">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 block" />
              </div>
              <div className="text-[10px] text-slate-450 font-bold uppercase tracking-widest">
                Active Module: {activeTab}
              </div>
              <span className="w-4 h-4" />
            </div>

            {/* Content Switcher */}
            <div className="flex-1 p-6 sm:p-8 overflow-y-auto bg-slate-950/30">
              {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex justify-between items-start border-b border-slate-900 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-white">General Administration Overview</h3>
                      <p className="text-xs text-slate-450 mt-1">Institutional comand and central data hub.</p>
                    </div>
                    <span className="text-[10px] font-black text-indigo-400 bg-indigo-950/50 border border-indigo-900/50 px-3 py-1 rounded-xl uppercase tracking-widest">System Online</span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Total Students</span>
                      <span className="text-xl font-black text-white mt-1 block">1,248</span>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Staff Members</span>
                      <span className="text-xl font-black text-white mt-1 block">84 Teachers</span>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Classrooms</span>
                      <span className="text-xl font-black text-white mt-1 block">42 Rooms</span>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Billing Status</span>
                      <span className="text-xl font-black text-emerald-450 mt-1 block">94.8% Collected</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-850 bg-slate-900/20 text-xs text-slate-400 leading-normal flex items-start gap-2.5">
                    <span className="text-base leading-none">ℹ️</span>
                    <p>Dashboard statistics refresh in real-time. Any update in homework postings, attendance marks, or fee processing is reflected instantly for school admins, class teachers, and parents.</p>
                  </div>
                </div>
              )}

              {activeTab === 'students' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <div>
                      <h3 className="text-lg font-black text-white">Student Directory Logs</h3>
                      <p className="text-xs text-slate-450 mt-0.5">Filter, query, and review records of enrolled students.</p>
                    </div>
                    <div className="text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 text-slate-350">
                      🔍 Search: "Ayush"
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-850/60 rounded-2xl">
                    <table className="w-full text-xs text-slate-300">
                      <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[8px] font-black border-b border-slate-850">
                        <tr>
                          <th className="px-4 py-3 text-left">Full Name</th>
                          <th className="px-4 py-3 text-left">Class Target</th>
                          <th className="px-4 py-3 text-left">Parent Name</th>
                          <th className="px-4 py-3 text-left">Roll Number</th>
                          <th className="px-4 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        <tr>
                          <td className="px-4 py-3 font-bold text-white">Ayush Sharma</td>
                          <td className="px-4 py-3">Class 1 (Section A)</td>
                          <td className="px-4 py-3">Rohan Sharma</td>
                          <td className="px-4 py-3">Roll No. 12</td>
                          <td className="px-4 py-3 text-right"><span className="px-2 py-0.5 text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-900/30 rounded">Active</span></td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-bold text-white">Neha Verma</td>
                          <td className="px-4 py-3">Class 3 (Section B)</td>
                          <td className="px-4 py-3">Vikas Verma</td>
                          <td className="px-4 py-3">Roll No. 04</td>
                          <td className="px-4 py-3 text-right"><span className="px-2 py-0.5 text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-900/30 rounded">Active</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'teacher' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <div>
                      <h3 className="text-lg font-black text-white">Teacher Command Workspace</h3>
                      <p className="text-xs text-slate-450 mt-0.5">Manage daily lectures, timetables, and class diagnostics.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-900 pb-2">Today's Lecture Schedule</span>
                      <div className="space-y-2">
                        <div className="p-2 bg-slate-950 border border-slate-850 rounded flex justify-between items-center">
                          <div>
                            <span className="text-[8px] font-black text-indigo-400 block uppercase">Period 1</span>
                            <span className="text-xs font-bold text-white">English Grammar</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold">Class 1A • 09:00 AM</span>
                        </div>
                        <div className="p-2 bg-slate-950 border border-slate-850 rounded flex justify-between items-center">
                          <div>
                            <span className="text-[8px] font-black text-indigo-400 block uppercase">Period 3</span>
                            <span className="text-xs font-bold text-white">Chemistry Basics</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold">Class 9B • 11:30 AM</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block border-b border-slate-900 pb-2">Quick Actions</span>
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                        <div className="p-3 bg-slate-950 border border-slate-850/60 rounded-xl text-center hover:border-slate-700 transition cursor-pointer">📝 Post Homework</div>
                        <div className="p-3 bg-slate-950 border border-slate-850/60 rounded-xl text-center hover:border-slate-700 transition cursor-pointer">✓ Mark Attendance</div>
                        <div className="p-3 bg-slate-950 border border-slate-850/60 rounded-xl text-center hover:border-slate-700 transition cursor-pointer">🤖 AI Lesson Draft</div>
                        <div className="p-3 bg-slate-950 border border-slate-850/60 rounded-xl text-center hover:border-slate-700 transition cursor-pointer">📈 View Analytics</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'attendance' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <div>
                      <h3 className="text-lg font-black text-white">Daily Attendance Register</h3>
                      <p className="text-xs text-slate-450 mt-0.5">Checked-in students logs and parent updates trigger.</p>
                    </div>
                  </div>

                  <div className="border border-slate-850 rounded-2xl overflow-hidden text-xs">
                    <div className="bg-slate-900 border-b border-slate-850 p-3 flex justify-between items-center font-bold text-slate-350">
                      <span>Roster: Class 1 - Sec A</span>
                      <span>Date: June 2026</span>
                    </div>
                    <div className="divide-y divide-slate-850">
                      <div className="p-3 flex justify-between items-center bg-slate-950/20">
                        <span className="font-bold text-white">Priyanshu Sharma</span>
                        <div className="flex gap-1.5">
                          <span className="w-6 h-6 bg-emerald-950 text-emerald-400 font-extrabold flex items-center justify-center rounded border border-emerald-900/30">P</span>
                          <span className="w-6 h-6 bg-emerald-950 text-emerald-400 font-extrabold flex items-center justify-center rounded border border-emerald-900/30">P</span>
                          <span className="w-6 h-6 bg-rose-950 text-rose-400 font-extrabold flex items-center justify-center rounded border border-rose-900/30">A</span>
                        </div>
                      </div>
                      <div className="p-3 flex justify-between items-center bg-slate-950/20">
                        <span className="font-bold text-white">Ayush K.</span>
                        <div className="flex gap-1.5">
                          <span className="w-6 h-6 bg-emerald-950 text-emerald-400 font-extrabold flex items-center justify-center rounded border border-emerald-900/30">P</span>
                          <span className="w-6 h-6 bg-emerald-950 text-emerald-400 font-extrabold flex items-center justify-center rounded border border-emerald-900/30">P</span>
                          <span className="w-6 h-6 bg-emerald-950 text-emerald-400 font-extrabold flex items-center justify-center rounded border border-emerald-900/30">P</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'homework' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                    <div>
                      <h3 className="text-lg font-black text-white">Homework Diaries</h3>
                      <p className="text-xs text-slate-450 mt-0.5">Assigned exercises, deadline targets, and attachment guides.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-800 transition">
                      <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-950 text-indigo-400 border border-indigo-900/40 inline-block w-fit">Mathematics</span>
                      <div>
                        <h4 className="text-xs font-black text-white">Calculus derivatives exercise</h4>
                        <span className="text-[9px] text-slate-500 mt-0.5 block">Due: June 30, 2026 • Teacher: Meera Nair</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">Complete textbook exercises on pages 144 to 148. Upload your handwritten draft copy in PDF format.</p>
                      <div className="border-t border-slate-850 pt-2 flex items-center justify-between text-[9px] font-bold text-slate-500">
                        <span>Status: Published</span>
                        <span className="text-rose-400">High Priority</span>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-800 transition">
                      <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-950 text-emerald-400 border border-emerald-900/40 inline-block w-fit">Biology</span>
                      <div>
                        <h4 className="text-xs font-black text-white">Plant Cell Structure diagrams</h4>
                        <span className="text-[9px] text-slate-500 mt-0.5 block">Due: July 02, 2026 • Teacher: Anil Kumar</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">Draw plant and animal cells structures. Identify core organelles. Reference video link attached below.</p>
                      <div className="border-t border-slate-850 pt-2 flex items-center justify-between text-[9px] font-bold text-slate-500">
                        <span>Status: Published</span>
                        <span className="text-slate-400">Low Priority</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'mobile' && (
                <div className="animate-fadeIn flex justify-center py-4">
                  {/* Portrait Mobile phone mockup frame */}
                  <div className="w-[280px] h-[360px] bg-slate-950 border-[5px] border-slate-900 rounded-[36px] shadow-2xl flex flex-col overflow-hidden relative">
                    {/* Status bar */}
                    <div className="h-6 bg-slate-900 flex justify-between items-center px-4 text-[8px] text-slate-400 font-bold select-none">
                      <span>9:41 AM</span>
                      <div className="flex gap-1">
                        <span>📶</span>
                        <span>🔋</span>
                      </div>
                    </div>
                    {/* App contents */}
                    <div className="flex-1 bg-slate-950 p-4 text-left space-y-4 overflow-y-auto">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block">Family Hub</span>
                          <h4 className="text-[10px] font-black text-white mt-0.5">Ayush Sharma • Class 1A</h4>
                        </div>
                        <span className="w-5 h-5 rounded-full bg-indigo-650 flex items-center justify-center text-[8px] font-bold text-white">AS</span>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-850 p-3 rounded-2xl flex justify-between items-center">
                        <div>
                          <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest block">Recent Attendance</span>
                          <span className="text-[9px] font-black text-emerald-400 mt-0.5 block">Checked In • 08:45 AM</span>
                        </div>
                        <span className="text-xs">✓</span>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest block">Pending Homework</span>
                        <div className="bg-slate-900/40 border border-slate-850 p-3 rounded-2xl space-y-2">
                          <span className="px-2 py-0.5 bg-slate-950 border border-indigo-900/40 text-indigo-400 rounded-full text-[6px] font-black uppercase">Maths</span>
                          <h5 className="text-[9px] font-black text-white mt-1 leading-snug">Calculus derivatives exercise</h5>
                          <span className="text-[7px] text-slate-500 block">Due: Tomorrow • Teacher: Meera Nair</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 5 — WHY SCHOOLOS
            ======================================================== */}
        <section id="why" className="space-y-16 text-center">
          <div className="space-y-3">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Operational Metrics</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Why Modern Schools Upgrade to SchoolOS</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">A side-by-side diagnostic comparison against traditional legacy ERP frameworks.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Legacy Card */}
            <div className="bg-slate-900/10 border border-slate-900 rounded-3xl p-8 text-left space-y-6">
              <h3 className="text-lg font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" />
                Traditional Systems
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Older administrative systems were built on legacy databases, leading to bloated workflows, server outages, and slow feedback loops.
              </p>
              <div className="space-y-4 border-t border-slate-900/60 pt-6">
                <div className="flex gap-3.5">
                  <span className="text-rose-500 font-bold text-xs mt-0.5">✗</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-300">Fragmented Data Islands</h4>
                    <p className="text-xs text-slate-500 leading-normal mt-0.5">Attendance logs, homework entries, and billing sheets exist in separate offline files.</p>
                  </div>
                </div>
                <div className="flex gap-3.5">
                  <span className="text-rose-500 font-bold text-xs mt-0.5">✗</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-300">Manual Parent Notifications</h4>
                    <p className="text-xs text-slate-500 leading-normal mt-0.5">Teachers must manually message or email parents, leading to delayed feedback loops.</p>
                  </div>
                </div>
                <div className="flex gap-3.5">
                  <span className="text-rose-500 font-bold text-xs mt-0.5">✗</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-300">Complex, Bloated Spreadsheets</h4>
                    <p className="text-xs text-slate-500 leading-normal mt-0.5">Requires specialized training to perform simple student updates or roster exports.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* SchoolOS Card */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8 text-left space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-indigo-500/10 border-b border-l border-indigo-900/60 text-indigo-400 text-[8px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-bl-2xl">Modern Standard</div>
              <h3 className="text-lg font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 block animate-pulse" />
                SchoolOS Command
              </h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                A unified, cloud-native command center powered by modern security RLS controls, real-time sync, and intelligent helper modules.
              </p>
              <div className="space-y-4 border-t border-slate-850 pt-6">
                <div className="flex gap-3.5">
                  <span className="text-indigo-400 font-bold text-xs mt-0.5">✓</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Unified Database Core</h4>
                    <p className="text-xs text-slate-400 leading-normal mt-0.5">Attendance logs, student metrics, and billing records update dynamically on a single source of truth.</p>
                  </div>
                </div>
                <div className="flex gap-3.5">
                  <span className="text-indigo-400 font-bold text-xs mt-0.5">✓</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Instant Portal Synchronization</h4>
                    <p className="text-xs text-slate-400 leading-normal mt-0.5">Real-time database triggers update parents immediately about assigned homework and attendance logs.</p>
                  </div>
                </div>
                <div className="flex gap-3.5">
                  <span className="text-indigo-400 font-bold text-xs mt-0.5">✓</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">AI Automation Integrations</h4>
                    <p className="text-xs text-slate-400 leading-normal mt-0.5">Auto-generate worksheets, grade metrics, and class summaries without spreadsheet bloat.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 6 — AI CAPABILITIES
            ======================================================== */}
        <section className="space-y-16 relative">
          {/* Subtle Glow */}
          <div className="absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] w-[350px] h-[350px] bg-fuchsia-600/5 rounded-full blur-[140px] pointer-events-none z-0" />
          
          <div className="text-center space-y-3">
            <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest block flex items-center justify-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5" />
              INTELLIGENCE COMMAND
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Next-Gen Intelligent Automation</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">Empower school administrators and teachers with production-grade AI co-pilots.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto relative z-10">
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl space-y-3 hover:border-fuchsia-500/20 transition">
              <span className="text-lg">✍️</span>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">AI Homework Creator</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Draft lesson assignments, reference materials suggestions, and score marks directly inside the posting portal.</p>
            </div>
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl space-y-3 hover:border-fuchsia-500/20 transition">
              <span className="text-lg">📊</span>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">AI Attendance Insights</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Trace school-wide attendance averages, flag repeating absences patterns, and notify student coordinators automatically.</p>
            </div>
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl space-y-3 hover:border-fuchsia-500/20 transition">
              <span className="text-lg">📝</span>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">AI Report Card Generator</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Formulate qualitative teacher remarks, student evaluations summaries, and term reviews based on score records.</p>
            </div>
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl space-y-3 hover:border-fuchsia-500/20 transition">
              <span className="text-lg">🤖</span>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">AI Parent Support Bot</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">Answer recurring parent inquiries on school regulations, timetable changes, and fee deadlines instantly.</p>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 7 — TESTIMONIALS CAROUSEL
            ======================================================== */}
        <section className="space-y-12 text-center max-w-4xl mx-auto">
          <div className="space-y-3">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">TESTIMONIALS</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Recommended by Institutional Leaders</h2>
          </div>

          <div className="bg-slate-900/20 border border-slate-850 rounded-3xl p-8 text-left space-y-8 relative overflow-hidden">
            {/* Rating Stars */}
            <div className="flex gap-1 text-amber-500 select-none">
              {[...Array(testimonials[activeTestimonial].rating)].map((_, i) => (
                <StarIcon key={i} className="w-4 h-4" />
              ))}
            </div>

            {/* Testimonial Quote */}
            <blockquote className="text-base sm:text-lg font-medium text-slate-200 leading-relaxed animate-fadeIn">
              "{testimonials[activeTestimonial].quote}"
            </blockquote>

            {/* User Profile */}
            <div className="flex items-center justify-between border-t border-slate-850/60 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-900/60 text-indigo-400 font-extrabold flex items-center justify-center text-xs select-none">
                  {testimonials[activeTestimonial].avatar}
                </div>
                <div className="leading-none text-left">
                  <h4 className="text-xs font-black text-white">{testimonials[activeTestimonial].name}</h4>
                  <span className="text-[10px] text-slate-500 font-bold block mt-1">{testimonials[activeTestimonial].role} • {testimonials[activeTestimonial].institution}</span>
                </div>
              </div>

              {/* Selector Buttons */}
              <div className="flex gap-1.5 select-none">
                {testimonials.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveTestimonial(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${activeTestimonial === idx ? 'bg-indigo-555 w-6' : 'bg-slate-800'}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 8 — SAAS PRICING MATRIX
            ======================================================== */}
        <section id="pricing" className="space-y-16 text-center">
          <div className="space-y-4">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Flexible Licensing</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Transparent, Tiered Billing</h2>
            <p className="text-xs text-slate-450 max-w-sm mx-auto font-medium">Select a license tier to support your institution size. Scale modules as you grow.</p>

            {/* Monthly / Yearly Toggle */}
            <div className="inline-flex items-center gap-2.5 bg-slate-950 p-1.5 rounded-xl border border-slate-850/65 select-none">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${billingPeriod === 'monthly' ? 'bg-indigo-650 text-white' : 'text-slate-500 hover:text-slate-350'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${billingPeriod === 'yearly' ? 'bg-indigo-650 text-white' : 'text-slate-500 hover:text-slate-350'}`}
              >
                Yearly
                <span className="text-[8px] bg-emerald-950 border border-emerald-900/30 text-emerald-400 px-1 py-0.5 rounded uppercase font-black tracking-widest">Save 20%</span>
              </button>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter tier */}
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl text-left space-y-6 flex flex-col justify-between hover:border-slate-800 transition">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Starter</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">
                      ${billingPeriod === 'yearly' ? '39' : '49'}
                    </span>
                    <span className="text-[10px] text-slate-550 font-bold">/ school / month</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">For primary schools up to 250 students requiring basic database command.</p>
                </div>
                <div className="border-t border-slate-850/60 pt-6 space-y-3.5 text-xs text-slate-350">
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Up to 250 Student Profiles</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Student & Staff Directory</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Attendance logs & Homework</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Basic Parent Portal</span>
                  </div>
                </div>
              </div>
              <Link href="/login" className="w-full text-center bg-slate-900 border border-slate-800 text-slate-200 py-3 rounded-2xl hover:bg-slate-850 hover:border-slate-700 font-bold text-xs transition active:scale-[0.98]">
                Get Started
              </Link>
            </div>

            {/* Professional tier (Most Popular) */}
            <div className="bg-slate-900/40 border border-indigo-900/50 p-6 rounded-3xl text-left space-y-6 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-850 transition">
              <div className="absolute top-0 right-0 bg-indigo-500/10 border-b border-l border-indigo-900/60 text-indigo-400 text-[8px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-bl-2xl">Most Popular</div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-indigo-455 uppercase tracking-widest">Professional</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">
                      ${billingPeriod === 'yearly' ? '79' : '99'}
                    </span>
                    <span className="text-[10px] text-slate-550 font-bold">/ school / month</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">For medium size institutions up to 1,000 students looking for complete database and billing sync.</p>
                </div>
                <div className="border-t border-slate-850/60 pt-6 space-y-3.5 text-xs text-slate-300">
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Up to 1,000 Student Profiles</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Granular Staff Security Roles</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Fee structure & Billing gateway</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-455 font-bold">✓</span>
                    <span>AI Homework drafts co-pilot</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Real-time parent notifications</span>
                  </div>
                </div>
              </div>
              <Link href="/login" className="w-full text-center bg-gradient-to-r from-indigo-650 to-violet-650 text-white py-3 rounded-2xl hover:from-indigo-600 hover:to-violet-600 font-bold text-xs transition active:scale-[0.98] shadow-md shadow-indigo-600/10">
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Enterprise tier */}
            <div className="bg-slate-900/20 border border-slate-850 p-6 rounded-3xl text-left space-y-6 flex flex-col justify-between hover:border-slate-800 transition">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Enterprise</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">Custom</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">For multi-campus international schools and universities requiring dedicated setups.</p>
                </div>
                <div className="border-t border-slate-850/60 pt-6 space-y-3.5 text-xs text-slate-350">
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Unlimited Enrolled Students</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Multi-campus aggregate view</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Custom database API schemas</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>Dedicated Support Officer</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-indigo-400 font-bold">✓</span>
                    <span>SLA Uptime Contracts</span>
                  </div>
                </div>
              </div>
              <a href="mailto:sales@schoolos.com" className="w-full text-center bg-slate-900 border border-slate-800 text-slate-200 py-3 rounded-2xl hover:bg-slate-850 hover:border-slate-700 font-bold text-xs transition active:scale-[0.98]">
                Contact Sales
              </a>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 9 — FAQ ACCORDION
            ======================================================== */}
        <section id="faq" className="space-y-12 max-w-3xl mx-auto">
          <div className="space-y-3 text-center">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Support</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3 select-none">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div key={idx} className="bg-slate-900/20 border border-slate-850/60 rounded-2xl overflow-hidden transition">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4.5 flex justify-between items-center text-left text-slate-200 hover:text-white font-bold text-xs cursor-pointer focus:outline-none"
                  >
                    <span>{faq.q}</span>
                    <ChevronIcon className={`w-4 h-4 text-slate-500 transform transition-transform ${isOpen ? 'rotate-180 text-white' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4.5 text-xs text-slate-400 leading-relaxed font-medium animate-fadeIn">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ========================================================
            SECTION 10 — CONVERSATIONAL CALL-TO-ACTION (CTA)
            ======================================================== */}
        <section className="relative text-center py-16 sm:py-20 rounded-[32px] overflow-hidden border border-slate-800 group shadow-2xl">
          {/* Radial glow background mesh */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(99,102,241,0.06),transparent_100%)]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[300px] h-[300px] bg-indigo-650/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 space-y-8 max-w-3xl mx-auto px-6">
            <div className="space-y-3">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">GET STARTED NOW</span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Start Managing Your School Today</h2>
              <p className="text-slate-400 text-xs sm:text-base font-medium max-w-lg mx-auto leading-relaxed">
                Onboard your classes, assign teachers and staff, and synchronize logs with parent portals in less than 24 hours.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3.5 justify-center items-center select-none">
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs px-8 py-4 shadow-xl shadow-white/5 transition active:scale-[0.98]"
              >
                Sign Up for Free Trial
              </Link>
              <a
                href="mailto:sales@schoolos.com"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs px-8 py-4 transition active:scale-[0.98]"
              >
                Contact Sales Office
              </a>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 11 — PREMIUM FOOTER
            ======================================================== */}
        <footer className="border-t border-slate-900 pt-16 pb-12 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 border-b border-slate-900 pb-12 text-left">
            
            {/* SchoolOS Branding */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-600 p-1.5 rounded-lg shadow shadow-indigo-500/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                </div>
                <span className="text-sm font-black text-white tracking-tight">SchoolOS ERP</span>
              </div>
              <p className="text-slate-500 max-w-xs leading-relaxed font-semibold">
                An intelligent, cloud-native command center built to digitize academics, directories, and billing for modern schools.
              </p>
              <div className="text-[10px] text-slate-550 flex items-center gap-2.5 select-none font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse" />
                All Cloud Services Operational
              </div>
            </div>

            {/* Column 2: Product */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</h4>
              <ul className="space-y-2.5 font-bold text-slate-500">
                <li><a href="#features" className="hover:text-indigo-400 transition-colors">Directory Modules</a></li>
                <li><a href="#features" className="hover:text-indigo-400 transition-colors">Real-time Attendance</a></li>
                <li><a href="#features" className="hover:text-indigo-400 transition-colors">Homework Sync</a></li>
                <li><a href="#features" className="hover:text-indigo-400 transition-colors">Billing & Gateway</a></li>
              </ul>
            </div>

            {/* Column 3: Resources */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resources</h4>
              <ul className="space-y-2.5 font-bold text-slate-500">
                <li><a href="#showcase" className="hover:text-indigo-400 transition-colors">System Showcase</a></li>
                <li><a href="#pricing" className="hover:text-indigo-400 transition-colors">Licensing plans</a></li>
                <li><a href="#faq" className="hover:text-indigo-400 transition-colors">FAQ database</a></li>
                <li><a href="mailto:support@schoolos.com" className="hover:text-indigo-400 transition-colors">Help desk</a></li>
              </ul>
            </div>

            {/* Column 4: Security Legal */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Legal</h4>
              <ul className="space-y-2.5 font-bold text-slate-500">
                <li><a href="#faq" className="hover:text-indigo-400 transition-colors">Data Privacy Policy</a></li>
                <li><a href="#faq" className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
                <li><a href="#faq" className="hover:text-indigo-400 transition-colors">SLA Contracts</a></li>
                <li><a href="#faq" className="hover:text-indigo-400 transition-colors">Compliance certifications</a></li>
              </ul>
            </div>
          </div>

          {/* Lower footer copyright */}
          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 gap-4 text-slate-550 font-bold text-[11px]">
            <span>© 2026 SchoolOS ERP Inc. All rights protected.</span>
            <div className="flex gap-4">
              <a href="#faq" className="hover:text-slate-400 transition-colors">Security Core</a>
              <span>•</span>
              <a href="#faq" className="hover:text-slate-400 transition-colors">Data Backups</a>
              <span>•</span>
              <a href="#faq" className="hover:text-slate-400 transition-colors">API Keys</a>
            </div>
          </div>
        </footer>

      </main>
    </div>
  )
}
