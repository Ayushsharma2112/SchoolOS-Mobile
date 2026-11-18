'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from './supabase-client'
import { useSchool } from './SchoolContext'

export interface UploadTarget {
  page: string; // "documents" | "register" | "students" | "school-logo" | "settings-logo" | "superadmin-school-logo"
  studentId?: string;
  schoolId?: string;
  documentType?: string;
  [key: string]: any;
}

export interface UploadOptions {
  allowedTypes?: string[];
  maxSize?: number; // In bytes (e.g. 5 * 1024 * 1024)
  sessionData: UploadTarget;
  autoUpload?: boolean; // If true, handle Storage + DB automatically
}

interface UploadContextType {
  status: 'idle' | 'picking' | 'validating' | 'uploading' | 'saving' | 'success' | 'error';
  error: string | null;
  selectedFile: File | null;
  uploadTarget: UploadTarget | null;
  isRestorePromptVisible: boolean;
  openFilePicker: (options: UploadOptions) => void;
  clearSelection: () => void;
  uploadFileToStorage: (file: File, path: string) => Promise<string>;
  dismissRestore: () => void;
  reopenPicker: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined)

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { schoolId: contextSchoolId, refreshSchool } = useSchool()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [status, setStatus] = useState<UploadContextType['status']>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null)
  const [isRestorePromptVisible, setIsRestorePromptVisible] = useState(false)
  const [activeOptions, setActiveOptions] = useState<Omit<UploadOptions, 'sessionData'> | null>(null)

  // Restore check on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('edumanage_pending_upload')
      if (stored) {
        const parsed = JSON.parse(stored) as UploadOptions
        setUploadTarget(parsed.sessionData)
        setActiveOptions({
          allowedTypes: parsed.allowedTypes,
          maxSize: parsed.maxSize,
          autoUpload: parsed.autoUpload
        })
        
        // Show restore dialog since tab was recreated
        setIsRestorePromptVisible(true)
      }
    } catch (e) {
      console.warn('Failed to parse pending upload session:', e)
    }
  }, [])

  const openFilePicker = (options: UploadOptions) => {
    setStatus('picking')
    setError(null)
    setSelectedFile(null)
    setUploadTarget(options.sessionData)
    setActiveOptions({
      allowedTypes: options.allowedTypes,
      maxSize: options.maxSize,
      autoUpload: options.autoUpload
    })

    // Persist target details to sessionStorage before launching native file picker
    sessionStorage.setItem('edumanage_pending_upload', JSON.stringify(options))

    // Programmatically open native file selector
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const clearSelection = () => {
    setStatus('idle')
    setError(null)
    setSelectedFile(null)
    setUploadTarget(null)
    setActiveOptions(null)
    sessionStorage.removeItem('edumanage_pending_upload')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const dismissRestore = () => {
    setIsRestorePromptVisible(false)
    clearSelection()
  }

  const reopenPicker = () => {
    setIsRestorePromptVisible(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
    const { error: uploadError } = await supabase.storage
      .from('student-documents')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      throw uploadError
    }
    return path
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setStatus('idle')
      return
    }

    setStatus('validating')
    
    // Type Validation
    if (activeOptions?.allowedTypes && activeOptions.allowedTypes.length > 0) {
      const isAllowed = activeOptions.allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          const prefix = type.slice(0, -2)
          return file.type.startsWith(prefix)
        }
        return file.type === type
      })
      if (!isAllowed) {
        const errMsg = `Invalid file type: ${file.type}. Allowed: ${activeOptions.allowedTypes.join(', ')}`
        setError(errMsg)
        setStatus('error')
        return
      }
    }

    // Size Validation
    if (activeOptions?.maxSize && file.size > activeOptions.maxSize) {
      const errMsg = `File size exceeds limits. Max size: ${(activeOptions.maxSize / (1024 * 1024)).toFixed(1)}MB`
      setError(errMsg)
      setStatus('error')
      return
    }

    setSelectedFile(file)
    sessionStorage.removeItem('edumanage_pending_upload') // Safely consumed

    // Check if auto-upload is requested
    if (activeOptions?.autoUpload && uploadTarget) {
      await executeAutoUpload(file, uploadTarget)
    } else {
      setStatus('success')
    }
  }

  const executeAutoUpload = async (file: File, target: UploadTarget) => {
    setStatus('uploading')
    const activeSchoolId = target.schoolId || contextSchoolId
    
    if (!activeSchoolId && target.page !== 'register') {
      setError('School ID not found, deferring upload')
      setStatus('error')
      return
    }

    try {
      if (target.page === 'documents' || target.page === 'students') {
        const studentId = target.studentId
        const docType = target.documentType || 'Other'
        const filePath = `${activeSchoolId}/${studentId}/${Date.now()}_${file.name}`

        // 1. Storage Upload
        await uploadFileToStorage(file, filePath)
        
        // 2. Database Insert
        setStatus('saving')
        const { error: dbError } = await supabase
          .from('documents')
          .insert({
            school_id: activeSchoolId,
            student_id: studentId,
            document_type: docType,
            file_url: filePath
          })

        if (dbError) throw dbError
      } 
      else if (target.page === 'school-logo' || target.page === 'settings-logo' || target.page === 'superadmin-school-logo') {
        const filePath = `school-logos/${activeSchoolId}_${Date.now()}_${file.name}`
        
        // 1. Storage Upload
        await uploadFileToStorage(file, filePath)

        // 2. Database Update
        setStatus('saving')
        const { error: dbError } = await supabase
          .from('schools')
          .update({ logo_url: filePath })
          .eq('id', activeSchoolId)

        if (dbError) throw dbError
        
        // Refresh active school context state
        if (refreshSchool) {
          await refreshSchool()
        }
      } else if (target.page === 'add-student-draft') {
        const draftId = target.draftId
        const filePath = `drafts/${activeSchoolId}/${draftId}/${Date.now()}_${file.name}`
        
        await uploadFileToStorage(file, filePath)
        target.filePath = filePath
        target.fileName = file.name
      }

      setStatus('success')
      // Dispatch global upload success event to alert active pages
      window.dispatchEvent(new CustomEvent('edumanage_upload_success', { detail: target }))
      
      // Delay reset for UX animation visibility
      setTimeout(() => {
        clearSelection()
      }, 800)

    } catch (err: any) {
      console.error('Unified upload pipeline failed:', err?.message || err)
      setError(err.message || 'File upload failed')
      setStatus('error')
    }
  }

  return (
    <UploadContext.Provider
      value={{
        status,
        error,
        selectedFile,
        uploadTarget,
        isRestorePromptVisible,
        openFilePicker,
        clearSelection,
        uploadFileToStorage,
        dismissRestore,
        reopenPicker
      }}
    >
      {children}

      {/* Hidden input - permanently mounted at layouts root */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        style={{ display: 'none' }}
        accept={activeOptions?.allowedTypes?.join(',')}
      />

      {/* Android Process Recreation Restore Dialog Overlay */}
      {isRestorePromptVisible && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-5 text-center transform scale-95 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-650 mx-auto">
              <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Browser Process Restarted</h3>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Android restarted the app to reclaim memory while choosing your file. Please select the file again to continue.
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={dismissRestore}
                className="px-4 py-2 border border-slate-200 text-slate-655 text-xs font-bold rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={reopenPicker}
                className="px-5 py-2 bg-gradient-to-tr from-indigo-600 to-violet-650 text-white text-xs font-bold rounded-xl hover:from-indigo-770 hover:to-violet-700 active:scale-[0.98] transition-all cursor-pointer shadow-md"
              >
                Choose File
              </button>
            </div>
          </div>
        </div>
      )}
    </UploadContext.Provider>
  )
}

export function useUpload() {
  const context = useContext(UploadContext)
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider')
  }
  return context
}
