'use client'

import { useState, useEffect, useRef } from 'react'
import AcademicHeader from '../../../components/academics/AcademicHeader'
import { generateSchoolCircular } from '../../../lib/services/ai'
import { supabase } from '../../../lib/supabase'

type Broadcast = {
  title: string
  content: string
  published_date: string
  category: string
  important: boolean
}

type StudentProfile = {
  id: string
  full_name: string
  class_name: string
  parent_name: string
  parent_phone: string
  school_id: string
}

type MessageItem = {
  id: string
  student_id: string
  sender_type: 'parent' | 'teacher'
  teacher_name: string
  message: string
  created_at: string
  students?: StudentProfile
}

export default function CommunicationPage() {
  const [subTab, setSubTab] = useState<'broadcast' | 'inbox'>('broadcast')

  // BROADCAST STATES
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [category, setCategory] = useState<'General' | 'Exam' | 'Event' | 'Holiday'>('General')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([
    { title: 'Academic Term 2 Examination Schedule', content: 'Timetables for term exams are out now.', published_date: '2026-07-26', category: 'Exam', important: true },
    { title: 'Annual Sports Meet 2026 Registration', content: 'Registrations are open for all athletic categories.', published_date: '2026-07-24', category: 'Event', important: false }
  ])

  // INBOX CHAT STATES
  const [rawMessages, setRawMessages] = useState<MessageItem[]>([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Fetch all parent-teacher message threads
  const fetchInboxMessages = async () => {
    try {
      setLoadingChats(true)
      const { data, error } = await supabase
        .from('teacher_messages')
        .select(`
          id,
          student_id,
          sender_type,
          teacher_name,
          message,
          created_at,
          students (
            id,
            full_name,
            class_name,
            parent_name,
            parent_phone,
            school_id
          )
        `)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data) {
        // Enforce types safely
        const formatted: MessageItem[] = data.map((m: any) => ({
          id: m.id,
          student_id: m.student_id,
          sender_type: m.sender_type,
          teacher_name: m.teacher_name,
          message: m.message,
          created_at: m.created_at,
          students: m.students ? (Array.isArray(m.students) ? m.students[0] : m.students) : undefined
        }))
        setRawMessages(formatted)
      }
    } catch (e) {
      console.error('Error loading parent message logs:', e)
    } finally {
      setLoadingChats(false)
    }
  }

  // Load chats on inbox mount
  useEffect(() => {
    if (subTab === 'inbox') {
      void fetchInboxMessages()
    }
  }, [subTab])

  // Real-time listener for incoming teacher messages
  useEffect(() => {
    if (subTab !== 'inbox') return
    const channel = supabase
      .channel('teacher_inbox_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teacher_messages' },
        () => {
          void fetchInboxMessages()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [subTab])

  // Scroll active chat panel to the bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [rawMessages, selectedStudentId])

  // Group messages into distinct student channels
  const activeChats = Object.values(
    rawMessages.reduce((acc: { [key: string]: { student: StudentProfile; messages: MessageItem[]; lastMessage: MessageItem } }, msg) => {
      const studentId = msg.student_id
      if (!studentId || !msg.students) return acc
      
      if (!acc[studentId]) {
        acc[studentId] = {
          student: msg.students,
          messages: [],
          lastMessage: msg
        }
      }
      acc[studentId].messages.push(msg)
      acc[studentId].lastMessage = msg
      return acc
    }, {})
  ).sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime())

  // Retrieve current active chat thread
  const selectedChat = activeChats.find(c => c.student.id === selectedStudentId)

  // Send reply message
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !selectedStudentId || !selectedChat) return

    setSendingReply(true)
    try {
      const student = selectedChat.student
      const { data, error } = await supabase
        .from('teacher_messages')
        .insert({
          school_id: student.school_id,
          student_id: student.id,
          sender_type: 'teacher',
          teacher_name: 'Class Teacher',
          message: replyText.trim()
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        const newMsg: MessageItem = {
          id: data.id,
          student_id: data.student_id,
          sender_type: data.sender_type,
          teacher_name: data.teacher_name,
          message: data.message,
          created_at: data.created_at,
          students: student
        }
        setRawMessages(prev => [...prev, newMsg])
        setReplyText('')
      }
    } catch (e) {
      console.error('Error replying parent message:', e)
      alert('Failed to send reply. Please try again.')
    } finally {
      setSendingReply(false)
    }
  }

  // Trigger AI circular notice assistant
  const handleTriggerAICircular = async () => {
    if (!aiPrompt.trim()) {
      alert('Please describe what notice you would like the AI Assistant to draft.')
      return
    }

    setAiLoading(true)
    try {
      const response = await generateSchoolCircular(aiPrompt.trim(), category)
      setDraftTitle(response.title)
      setDraftContent(response.content)
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  // Settle circular notice creation
  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draftTitle || !draftContent) return

    setBroadcasts(prev => [
      {
        title: draftTitle,
        content: draftContent,
        published_date: new Date().toISOString().split('T')[0],
        category,
        important: false
      },
      ...prev
    ])

    setDraftTitle('')
    setDraftContent('')
    alert('Notice broadcasted successfully!')
  }

  return (
    <div className="space-y-6">
      <AcademicHeader 
        title="School Communication HUB"
        description="Broadcast bulletins, publish circular announcements, and configure parent-teacher chat logs."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Communication' }
        ]}
      />

      {/* Tabs Menu Navigation */}
      <div className="flex border-b border-slate-200 select-none">
        <button
          onClick={() => setSubTab('broadcast')}
          className={`px-6 pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition ${
            subTab === 'broadcast' 
              ? 'border-indigo-600 text-indigo-650' 
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          Draft Announcements
        </button>
        <button
          onClick={() => setSubTab('inbox')}
          className={`px-6 pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
            subTab === 'inbox' 
              ? 'border-indigo-600 text-indigo-650' 
              : 'border-transparent text-slate-450 hover:text-slate-700'
          }`}
        >
          Parent Inbox 
          {activeChats.length > 0 && (
            <span className="w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-[9px]">
              {activeChats.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CIRCULAR Notice Drafts */}
      {subTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left animate-in fade-in duration-200">
          
          {/* Draft Form */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest border-b border-slate-100 pb-2">Draft Circular Notice</h3>
            
            {/* AI Assistant draftsman */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl space-y-2">
              <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block">✨ AI Circular Draftsman</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Notice about: e.g. parent teacher meet, holiday for Holi"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleTriggerAICircular}
                  disabled={aiLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl transition shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {aiLoading ? 'Drafting...' : 'AI Draft'}
                </button>
              </div>
            </div>

            <form onSubmit={handlePublish} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">Notice Title</label>
                <input
                  type="text"
                  placeholder="Title of circular..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-800 font-bold"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">Category</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-850 font-bold bg-white cursor-pointer"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="General">General Notice</option>
                  <option value="Exam">Exam Announcement</option>
                  <option value="Event">Event Registration</option>
                  <option value="Holiday">School Holiday</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black text-slate-450 uppercase tracking-widest pl-0.5">Notice Content Body</label>
                <textarea
                  placeholder="Detail notice announcement content here..."
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-800 font-medium resize-none"
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3.5 rounded-xl transition cursor-pointer text-center w-full block"
              >
                Broadcast Notice Board Announcement
              </button>
            </form>
          </div>

          {/* logs Feed */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest border-b border-slate-100 pb-2">Notice Broadcaster Log</h3>
            <div className="space-y-4 max-h-[420px] overflow-y-auto scrollbar-none pr-1">
              {broadcasts.map((b, idx) => (
                <div key={idx} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/20 text-left">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[8px] font-black bg-indigo-50 text-indigo-700 uppercase">{b.category}</span>
                    <span className="text-[9px] font-semibold text-slate-400">{b.published_date}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mt-2">{b.title}</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{b.content}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Parent Messenger Inbox Dashboard */}
      {subTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 bg-white border border-slate-200/60 rounded-3xl overflow-hidden min-h-[500px] shadow-sm animate-in fade-in duration-200 text-left leading-normal font-sans">
          
          {/* Left Column: Channels list */}
          <div className="lg:col-span-1 border-r border-slate-200 flex flex-col">
            <div className="p-4.5 border-b border-slate-100 select-none">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Student Chat Channels</span>
            </div>
            
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingChats && activeChats.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-450 font-bold animate-pulse">Syncing chat channels...</p>
              ) : activeChats.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400 italic">No message threads found in the system.</p>
              ) : (
                activeChats.map(chat => {
                  const isActive = chat.student.id === selectedStudentId
                  return (
                    <button
                      key={chat.student.id}
                      onClick={() => setSelectedStudentId(chat.student.id)}
                      className={`w-full p-4 flex items-start gap-3 transition text-left cursor-pointer ${
                        isActive ? 'bg-indigo-50/50' : 'hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-150 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0 select-none">
                        {chat.student.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 select-none">
                          <span className="text-xs font-black dark:text-slate-800 text-slate-800 block truncate">{chat.student.full_name}</span>
                          <span className="text-[8px] font-black text-slate-400 whitespace-nowrap">
                            {new Date(chat.lastMessage.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 block select-none uppercase truncate">{chat.student.class_name} • Parent: {chat.student.parent_name}</span>
                        <p className="text-[11px] text-slate-550 truncate font-medium mt-1">
                          {chat.lastMessage.sender_type === 'teacher' ? 'You: ' : ''}
                          {chat.lastMessage.message}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Chat thread dialog pane */}
          <div className="lg:col-span-2 flex flex-col justify-between bg-slate-50/20 h-[550px]">
            
            {selectedChat ? (
              <>
                {/* Active Chat Header */}
                <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between select-none">
                  <div>
                    <h4 className="text-xs font-black text-slate-800">{selectedChat.student.full_name} ({selectedChat.student.class_name})</h4>
                    <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Parent Contact: {selectedChat.student.parent_name} ({selectedChat.student.parent_phone})</span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-650 border border-emerald-200/50 rounded-lg text-[9px] font-black uppercase tracking-wider animate-pulse">
                    Online Connection
                  </span>
                </div>

                {/* Messages dialogue history */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
                  {selectedChat.messages.map(msg => (
                    <div 
                      key={msg.id}
                      className={`flex flex-col max-w-[75%] ${
                        msg.sender_type === 'teacher' ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <span className="text-[8px] text-slate-400 font-bold mb-1 pl-1 pr-1 select-none">
                        {msg.sender_type === 'teacher' ? 'You (Class Teacher)' : `Parent of ${selectedChat.student.full_name}`}
                      </span>
                      <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed ${
                        msg.sender_type === 'teacher'
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm'
                          : 'bg-white border border-slate-200/60 text-slate-800 rounded-tl-none shadow-sm'
                      }`}>
                        {msg.message}
                      </div>
                      <span className="text-[8px] text-slate-400 font-bold mt-1 pl-1 pr-1 select-none">
                        {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Reply Submit input bar */}
                <form onSubmit={handleSendReply} className="p-4 border-t border-slate-200 bg-white flex gap-2.5 select-none">
                  <input
                    type="text"
                    placeholder={`Reply to parent of ${selectedChat.student.full_name}...`}
                    className="flex-1 bg-slate-100 border border-slate-200/50 rounded-2xl px-4 py-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-2xl transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {sendingReply ? '...' : 'Reply'}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
                <span className="text-4xl block mb-2">💬</span>
                <h4 className="text-xs font-black text-slate-700">No Chat Selected</h4>
                <p className="text-[10px] text-slate-450 mt-1 font-semibold max-w-xs">Select any student chat channel in the list on the left to see the message dialog feed.</p>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
