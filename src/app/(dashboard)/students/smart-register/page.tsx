'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSchool } from '../../../../lib/SchoolContext'
import { supabase } from '../../../../lib/supabase'
import ClientAuth from '../../ClientAuth'

type ConfidenceField = {
  value: string
  confidence: number
}

type ExtractedRecord = {
  id: string // Client-side unique row ID
  page_index: number
  admission_number: ConfidenceField
  roll_number: ConfidenceField
  student_name: ConfidenceField
  father_name: ConfidenceField
  mother_name: ConfidenceField
  gender: ConfidenceField
  date_of_birth: ConfidenceField
  class: ConfidenceField
  section: ConfidenceField
  phone: ConfidenceField
  address: ConfidenceField
  blood_group: ConfidenceField
  admission_date: ConfidenceField
  religion: ConfidenceField
  nationality: ConfidenceField
  email: ConfidenceField
  guardian_name: ConfidenceField
  remarks: ConfidenceField
  
  // Validation and UI states
  isDuplicate?: boolean
  duplicateReason?: string
  existingStudentId?: string
  resolutionAction: 'create' | 'update' | 'replace' | 'skip'
  validationErrors: string[]
  isVerified: boolean
}

type ImportLog = {
  name: string
  action: string
  status: 'success' | 'failed' | 'skipped'
  message: string
}

export default function AIImportCenterPage() {
  const router = useRouter()
  const { schoolId, userRole } = useSchool()

  // Guard routing: restrict to Admins and SuperAdmins
  useEffect(() => {
    if (userRole && userRole !== 'Admin' && userRole !== 'SuperAdmin') {
      router.push('/students')
    }
  }, [userRole, router])

  // Wizard state: 1: Upload, 2: Reading, 3: Review, 4: Progress, 5: Summary
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [registerType, setRegisterType] = useState<string>('student')
  const [apiError, setApiError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')

  // Uploaded files list
  const [uploadedFiles, setUploadedFiles] = useState<{
    base64: string
    mimeType: string
    name: string
    size: number
  }[]>([])

  // Database lists for validation
  const [existingStudents, setExistingStudents] = useState<any[]>([])
  const [availableClasses, setAvailableClasses] = useState<string[]>([])
  const [availableSections, setAvailableSections] = useState<string[]>(['A', 'B', 'C', 'D'])

  // Web camera states
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Extracted rows state & Undo/Redo history
  const [records, setRecords] = useState<ExtractedRecord[]>([])
  const [undoStack, setUndoStack] = useState<ExtractedRecord[][]>([])
  const [redoStack, setRedoStack] = useState<ExtractedRecord[][]>([])

  // Search & Filters for Spreadsheet Grid
  const [searchTerm, setSearchTerm] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'duplicate', 'errors', 'unverified'
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  // Split-screen OCR Overlay state
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  // Import batch execution state
  const [isImporting, setIsImporting] = useState(false)
  const [currentImportIndex, setCurrentImportIndex] = useState(0)
  const [importStats, setImportStats] = useState({
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    total: 0
  })
  const [importLogs, setImportLogs] = useState<ImportLog[]>([])
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)

  // Fetch db lists for client-side matching & mapping validation
  const fetchDbMetaData = async () => {
    if (!schoolId) return
    try {
      // 1. Fetch existing students of the school
      const { data: studs } = await supabase
        .from('students')
        .select('id, full_name, parent_phone, class_name, section')
        .eq('school_id', schoolId)
      if (studs) setExistingStudents(studs)

      // 2. Fetch school classes list
      const { data: classes } = await supabase
        .from('classes')
        .select('name')
        .eq('school_id', schoolId)
      if (classes) {
        setAvailableClasses(classes.map(c => c.name))
      }
    } catch (e) {
      console.error('Failed to fetch DB meta data:', e)
    }
  }

  useEffect(() => {
    if (schoolId) {
      void fetchDbMetaData()
    }
  }, [schoolId])

  // Timer for Step 4 Import Progress
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isImporting && startTime !== null) {
      timer = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - startTime) / 1000))
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isImporting, startTime])

  // Helper: Save snapshot of current records for Undo
  const saveToHistory = (newRecords: ExtractedRecord[]) => {
    setUndoStack(prev => [...prev, records])
    setRedoStack([]) // Clear redo stack on new action
    setRecords(newRecords)
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(prevStack => prevStack.slice(0, prevStack.length - 1))
    setRedoStack(prevRedo => [...prevRedo, records])
    setRecords(prev)
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(prevRedo => prevRedo.slice(0, prevRedo.length - 1))
    setUndoStack(prevUndo => [...prevUndo, records])
    setRecords(next)
  }

  // Camera capture methods
  const startWebcam = async () => {
    try {
      setIsWebcamActive(true)
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        void videoRef.current.play()
      }
    } catch (err: any) {
      console.error('Webcam failed:', err)
      alert(`Could not start device camera: ${err.message || err}`)
      setIsWebcamActive(false)
    }
  }

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsWebcamActive(false)
  }

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.85)
        setUploadedFiles(prev => [
          ...prev,
          {
            base64,
            mimeType: 'image/jpeg',
            name: `snapshot_${Date.now()}.jpg`,
            size: Math.round(base64.length * 0.75)
          }
        ])
        stopWebcam()
      }
    }
  }

  // Handle uploaded files and compress images client-side
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => processUploadedFile(file))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(file => processUploadedFile(file))
    }
  }

  const processUploadedFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string

      // If it is CSV, we can parse it client-side directly
      if (file.name.endsWith('.csv')) {
        const text = atob(dataUrl.split(',')[1])
        parseAndPopulateCSV(text, file.name)
        return
      }

      if (file.type === 'application/pdf') {
        setUploadedFiles(prev => [
          ...prev,
          {
            base64: dataUrl,
            mimeType: file.type,
            name: file.name,
            size: file.size
          }
        ])
        return
      }

      // Image Compression
      const img = new Image()
      img.src = dataUrl
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1200
        const MAX_HEIGHT = 1200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
          setUploadedFiles(prev => [
            ...prev,
            {
              base64: compressedBase64,
              mimeType: 'image/jpeg',
              name: file.name,
              size: Math.round(compressedBase64.length * 0.75)
            }
          ])
        }
      }
    }
    reader.readAsDataURL(file)
  }

  // Parse CSV client-side and populate records without calling AI API
  const parseAndPopulateCSV = (text: string, filename: string) => {
    setStatusMessage('Parsing CSV file client-side...')
    setStep(2)
    
    setTimeout(() => {
      try {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length < 2) throw new Error('CSV is empty or lacks headers.')

        // Split by comma handling quotes
        const splitRow = (rowStr: string) => {
          const result = []
          let insideQuote = false
          let entry = ''
          for (let i = 0; i < rowStr.length; i++) {
            const char = rowStr[i]
            if (char === '"') insideQuote = !insideQuote
            else if (char === ',' && !insideQuote) {
              result.push(entry.trim())
              entry = ''
            } else entry += char
          }
          result.push(entry.trim())
          return result
        }

        const headers = splitRow(lines[0]).map(h => h.toLowerCase().replace(/[\s_]+/g, ''))
        const recordsParsed: ExtractedRecord[] = []

        // Map column indices dynamically
        const fieldMapping: Record<string, string[]> = {
          student_name: ['name', 'studentname', 'fullname', 'student'],
          admission_number: ['admissionno', 'admissionnumber', 'admno', 'regno', 'registrationnumber'],
          roll_number: ['rollno', 'rollnumber', 'roll'],
          father_name: ['fathername', 'fathersname', 'father'],
          mother_name: ['mothername', 'mothersname', 'mother'],
          gender: ['gender', 'sex'],
          date_of_birth: ['dob', 'dateofbirth', 'birthdate'],
          class: ['class', 'grade', 'standard'],
          section: ['section', 'sec'],
          phone: ['phone', 'contact', 'mobile', 'phonenumber'],
          address: ['address', 'residence'],
          blood_group: ['bloodgroup', 'blood'],
          admission_date: ['admissiondate', 'admitteddate'],
          religion: ['religion'],
          nationality: ['nationality', 'country'],
          email: ['email', 'emailaddress'],
          guardian_name: ['guardian', 'guardianname'],
          remarks: ['remarks', 'notes', 'comment']
        }

        const getIndexForField = (fieldKey: string) => {
          const matchTerms = fieldMapping[fieldKey]
          return headers.findIndex(h => matchTerms.some(term => h.includes(term)))
        }

        for (let i = 1; i < lines.length; i++) {
          const cols = splitRow(lines[i])
          if (cols.length < headers.length) continue

          const val = (fieldKey: string) => {
            const idx = getIndexForField(fieldKey)
            return idx !== -1 ? cols[idx] : ''
          }

          recordsParsed.push({
            id: `csv_${i}_${Date.now()}`,
            page_index: 0,
            admission_number: { value: val('admission_number'), confidence: 100 },
            roll_number: { value: val('roll_number'), confidence: 100 },
            student_name: { value: val('student_name'), confidence: 100 },
            father_name: { value: val('father_name'), confidence: 100 },
            mother_name: { value: val('mother_name'), confidence: 100 },
            gender: { value: val('gender'), confidence: 100 },
            date_of_birth: { value: val('date_of_birth'), confidence: 100 },
            class: { value: val('class'), confidence: 100 },
            section: { value: val('section'), confidence: 100 },
            phone: { value: val('phone'), confidence: 100 },
            address: { value: val('address'), confidence: 100 },
            blood_group: { value: val('blood_group'), confidence: 100 },
            admission_date: { value: val('admission_date'), confidence: 100 },
            religion: { value: val('religion'), confidence: 100 },
            nationality: { value: val('nationality'), confidence: 100 },
            email: { value: val('email'), confidence: 100 },
            guardian_name: { value: val('guardian_name'), confidence: 100 },
            remarks: { value: val('remarks'), confidence: 100 },
            resolutionAction: 'create',
            validationErrors: [],
            isVerified: true
          })
        }

        // Run validation engine
        const validated = validateExtractedRows(recordsParsed)
        setRecords(validated)
        if (validated.length > 0) setSelectedRowId(validated[0].id)
        setStep(3)
      } catch (err: any) {
        setApiError(`Failed to parse CSV: ${err.message}`)
        setStep(1)
      }
    }, 1000)
  }

  // Trigger Backend AI Extraction
  const triggerAIExtraction = async () => {
    if (uploadedFiles.length === 0) return
    setStep(2)
    setApiError(null)
    setStatusMessage('Transmitting pages to AI service...')

    try {
      const payloadFiles = uploadedFiles.map(f => ({
        base64: f.base64,
        mimeType: f.mimeType
      }))

      setStatusMessage('AI is detecting table columns and recognizing rows...')
      const res = await fetch('/api/ai/extract-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerType,
          files: payloadFiles,
          schoolId,
          fileName: uploadedFiles[0].name,
          fileSize: uploadedFiles.reduce((acc, cur) => acc + cur.size, 0)
        })
      })

      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || 'AI extraction failed.')
      }

      // Convert raw response records to ExtractedRecord type
      const parsedRecords: ExtractedRecord[] = (result.records || []).map((rec: any, idx: number) => {
        const getField = (key: string) => {
          const field = rec[key]
          return {
            value: field && typeof field === 'object' ? String(field.value || '') : String(field || ''),
            confidence: field && typeof field === 'object' ? Number(field.confidence ?? 100) : 100
          }
        }

        return {
          id: `extracted_${idx}_${Date.now()}`,
          page_index: Number(rec.page_index ?? 0),
          admission_number: getField('admission_number'),
          roll_number: getField('roll_number'),
          student_name: getField('student_name'),
          father_name: getField('father_name'),
          mother_name: getField('mother_name'),
          gender: getField('gender'),
          date_of_birth: getField('date_of_birth'),
          class: getField('class'),
          section: getField('section'),
          phone: getField('phone'),
          address: getField('address'),
          blood_group: getField('blood_group'),
          admission_date: getField('admission_date'),
          religion: getField('religion'),
          nationality: getField('nationality'),
          email: getField('email'),
          guardian_name: getField('guardian_name'),
          remarks: getField('remarks'),
          resolutionAction: 'create',
          validationErrors: [],
          isVerified: false
        }
      })

      // Run validation engine
      const validated = validateExtractedRows(parsedRecords)
      setRecords(validated)
      if (validated.length > 0) setSelectedRowId(validated[0].id)
      setStep(3)
    } catch (err: any) {
      console.error(err)
      setApiError(err.message || 'AI extraction failed. Please try again.')
      setStep(1)
    }
  }

  // Internal Validation Engine: highlights duplicate matching and mapping gaps
  const validateExtractedRows = (rowsList: ExtractedRecord[]): ExtractedRecord[] => {
    return rowsList.map(row => {
      const errors: string[] = []
      let isDuplicate = false
      let duplicateReason = ''
      let resolution: 'create' | 'update' | 'replace' | 'skip' = 'create'
      let matchingStudentId = ''

      // 1. Required fields
      if (!row.student_name.value || !row.student_name.value.trim()) {
        errors.push('Student name is required.')
      }

      // 2. Class mapping validation
      if (row.class.value) {
        // Clean class string e.g. Class 5 -> 5
        const normalizedClass = row.class.value.trim().toLowerCase().replace(/class\s+/i, '').replace(/grade\s+/i, '').trim()
        
        // Match against database classes if available
        if (availableClasses.length > 0) {
          const isMatched = availableClasses.some(c => 
            c.toLowerCase() === normalizedClass || 
            (c === '5' && normalizedClass === 'v') ||
            (c === '1' && normalizedClass === 'i')
          )
          if (!isMatched) {
            errors.push(`Class "${row.class.value}" does not match configured classes.`)
          }
        }
      } else {
        errors.push('Class is required.')
      }

      // 3. Email validation
      if (row.email.value && row.email.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(row.email.value.trim())) {
          errors.push('Email format is invalid.')
        }
      }

      // 4. Duplicate checks against database
      const phoneClean = (row.phone.value || '').trim().replace(/\s+/g, '')
      const nameClean = (row.student_name.value || '').trim().toLowerCase()
      const admClean = (row.admission_number.value || '').trim().toLowerCase()

      const match = existingStudents.find(exist => {
        // Match by admission number
        if (admClean && exist.admission_no && exist.admission_no.trim().toLowerCase() === admClean) {
          duplicateReason = `Admission Number "${row.admission_number.value}" already exists.`
          return true
        }
        // Match by name and parent phone
        if (nameClean && phoneClean && exist.full_name.trim().toLowerCase() === nameClean && exist.parent_phone?.replace(/\s+/g, '') === phoneClean) {
          duplicateReason = `Student "${row.student_name.value}" with parent phone "${row.phone.value}" already exists.`
          return true
        }
        return false
      })

      if (match) {
        isDuplicate = true
        matchingStudentId = match.id
        resolution = 'skip' // Default resolution for duplicates is Skip
      }

      return {
        ...row,
        isDuplicate,
        duplicateReason,
        existingStudentId: matchingStudentId,
        resolutionAction: resolution,
        validationErrors: errors,
        isVerified: errors.length === 0 && !isDuplicate
      }
    })
  }

  // Handle cell edit in the review grid
  const handleCellEdit = (rowId: string, fieldKey: keyof ExtractedRecord, newValue: string) => {
    const updated = records.map(r => {
      if (r.id === rowId) {
        const fieldVal = r[fieldKey] as ConfidenceField
        return {
          ...r,
          [fieldKey]: {
            ...fieldVal,
            value: newValue,
            confidence: 100 // edited fields have 100% confidence
          }
        }
      }
      return r
    })
    saveToHistory(validateExtractedRows(updated))
  }

  // Inline Actions
  const handleDeleteRow = (rowId: string) => {
    const filtered = records.filter(r => r.id !== rowId)
    saveToHistory(validateExtractedRows(filtered))
    if (selectedRowId === rowId) {
      setSelectedRowId(filtered.length > 0 ? filtered[0].id : null)
    }
  }

  const handleDuplicateRow = (rowId: string) => {
    const target = records.find(r => r.id === rowId)
    if (target) {
      const dup = {
        ...target,
        id: `dup_${Date.now()}_${Math.random()}`,
        isVerified: false
      }
      const idx = records.findIndex(r => r.id === rowId)
      const updated = [...records]
      updated.splice(idx + 1, 0, dup)
      saveToHistory(validateExtractedRows(updated))
    }
  }

  const handleInsertRow = () => {
    const newRow: ExtractedRecord = {
      id: `inserted_${Date.now()}`,
      page_index: 0,
      admission_number: { value: '', confidence: 100 },
      roll_number: { value: '', confidence: 100 },
      student_name: { value: '', confidence: 100 },
      father_name: { value: '', confidence: 100 },
      mother_name: { value: '', confidence: 100 },
      gender: { value: 'Male', confidence: 100 },
      date_of_birth: { value: '', confidence: 100 },
      class: { value: '1', confidence: 100 },
      section: { value: 'A', confidence: 100 },
      phone: { value: '', confidence: 100 },
      address: { value: '', confidence: 100 },
      blood_group: { value: '', confidence: 100 },
      admission_date: { value: '', confidence: 100 },
      religion: { value: '', confidence: 100 },
      nationality: { value: 'Indian', confidence: 100 },
      email: { value: '', confidence: 100 },
      guardian_name: { value: '', confidence: 100 },
      remarks: { value: '', confidence: 100 },
      resolutionAction: 'create',
      validationErrors: ['Student name is required.'],
      isVerified: false
    }
    const updated = [...records, newRow]
    saveToHistory(validateExtractedRows(updated))
    setSelectedRowId(newRow.id)
  }

  // Resolution Mode selectors
  const handleResolutionChange = (rowId: string, action: 'create' | 'update' | 'replace' | 'skip') => {
    const updated = records.map(r => {
      if (r.id === rowId) {
        return { ...r, resolutionAction: action }
      }
      return r
    })
    saveToHistory(updated)
  }

  // Filtered & Paginated records computation
  const filteredRecords = useMemo(() => {
    return records.filter(row => {
      const nameMatch = row.student_name.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        row.phone.value.includes(searchTerm) ||
                        row.admission_number.value.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesClass = classFilter === 'all' || row.class.value === classFilter
      const matchesSection = sectionFilter === 'all' || row.section.value === sectionFilter
      
      let matchesStatus = true
      if (statusFilter === 'duplicate') matchesStatus = !!row.isDuplicate
      if (statusFilter === 'errors') matchesStatus = row.validationErrors.length > 0
      if (statusFilter === 'unverified') matchesStatus = !row.isVerified

      return nameMatch && matchesClass && matchesSection && matchesStatus
    })
  }, [records, searchTerm, classFilter, sectionFilter, statusFilter])

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredRecords.slice(start, start + rowsPerPage)
  }, [filteredRecords, currentPage])

  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage)

  const activeSelectedRow = useMemo(() => {
    return records.find(r => r.id === selectedRowId) || null
  }, [records, selectedRowId])

  // Batch Execution Import Engine (Step 4)
  const triggerImportProcess = async () => {
    if (records.length === 0) return
    setStep(4)
    setIsImporting(true)
    setStartTime(Date.now())
    setElapsedTime(0)
    setImportLogs([])
    
    const stats = { imported: 0, updated: 0, skipped: 0, failed: 0, total: records.length }
    setImportStats(stats)

    // Execute row-by-row imports staggeredly to prevent rate limits
    for (let i = 0; i < records.length; i++) {
      setCurrentImportIndex(i)
      const row = records[i]

      if (row.resolutionAction === 'skip') {
        stats.skipped++
        setImportStats({ ...stats })
        setImportLogs(prev => [
          ...prev,
          {
            name: row.student_name.value || `Row ${i + 1}`,
            action: 'Skip',
            status: 'skipped',
            message: 'Excluded based on duplicate resolution rule.'
          }
        ])
        continue
      }

      try {
        const payload = {
          action: row.resolutionAction,
          schoolId,
          studentData: {
            student_name: row.student_name.value,
            admission_number: row.admission_number.value,
            roll_number: row.roll_number.value,
            gender: row.gender.value,
            date_of_birth: row.date_of_birth.value,
            class: row.class.value,
            section: row.section.value,
            blood_group: row.blood_group.value,
            admission_date: row.admission_date.value,
            religion: row.religion.value,
            nationality: row.nationality.value,
            remarks: row.remarks.value
          },
          parentData: {
            father_name: row.father_name.value,
            mother_name: row.mother_name.value,
            guardian_name: row.guardian_name.value,
            phone: row.phone.value,
            email: row.email.value
          },
          existingStudentId: row.existingStudentId
        }

        const res = await fetch('/api/ai/import-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        const resData = await res.json()
        if (!resData.success) throw new Error(resData.error || 'Failed to insert.')

        // Save local storage student extension if returned
        if (resData.studentId && resData.extraMetadata) {
          localStorage.setItem(`schoolos_student_ext_${resData.studentId}`, JSON.stringify(resData.extraMetadata))
        }

        if (row.resolutionAction === 'update' || row.resolutionAction === 'replace') {
          stats.updated++
        } else {
          stats.imported++
        }

        setImportStats({ ...stats })
        setImportLogs(prev => [
          ...prev,
          {
            name: row.student_name.value,
            action: row.resolutionAction === 'create' ? 'Create' : 'Update',
            status: 'success',
            message: `Successfully processed student profile in Supabase.`
          }
        ])
      } catch (err: any) {
        console.error(err)
        stats.failed++
        setImportStats({ ...stats })
        setImportLogs(prev => [
          ...prev,
          {
            name: row.student_name.value || `Row ${i + 1}`,
            action: row.resolutionAction === 'create' ? 'Create' : 'Update',
            status: 'failed',
            message: err.message || 'Database transaction error.'
          }
        ])
      }

      // Small pacing delay to respect AI & Supabase limits
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    setIsImporting(false)
    setStep(5)
  }

  // Estimated Time Remaining calculation
  const estTimeRemaining = useMemo(() => {
    if (!isImporting || currentImportIndex === 0) return 0
    const timeSpent = elapsedTime
    const avgTime = timeSpent / currentImportIndex
    const remaining = records.length - currentImportIndex
    return Math.round(avgTime * remaining)
  }, [isImporting, currentImportIndex, elapsedTime, records])

  // Download CSV summary report
  const downloadImportReport = () => {
    const csvRows = []
    csvRows.push('Student Name,Action,Status,Detail')
    importLogs.forEach(log => {
      const esc = (val: string) => `"${val.replace(/"/g, '""')}"`
      csvRows.push([esc(log.name), esc(log.action), esc(log.status), esc(log.message)].join(','))
    })
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `import_report_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Get field confidence color styling
  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500 bg-emerald-50 border-emerald-100'
    if (score >= 70) return 'text-amber-600 bg-amber-50 border-amber-100'
    return 'text-rose-600 bg-rose-50 border-rose-100 animate-pulse font-extrabold'
  }

  return (
    <>
      <ClientAuth />

      <div className="max-w-7xl mx-auto space-y-6 text-slate-800">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200/50">
          <div className="space-y-1 text-left">
            <Link
              href="/students"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors group cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:-translate-x-0.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              Back to directory
            </Link>
            <h1 className="text-3xl font-black text-slate-855 tracking-tight flex items-center gap-2.5">
              <span>🔮 AI Import Center</span>
              <span className="text-xs bg-indigo-50 border border-indigo-150 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase">v2.0</span>
            </h1>
            <p className="text-slate-450 text-sm font-semibold">Digitize paper classroom registers, transcripts, fee listings and sheet logs using Smart AI.</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={registerType}
              onChange={(e) => setRegisterType(e.target.value)}
              disabled={step > 1}
              className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-600 cursor-pointer shadow-sm outline-none disabled:opacity-50"
            >
              <option value="student">📖 Student Register</option>
              <option value="teacher">👨‍🏫 Teacher Register</option>
              <option value="attendance">📅 Attendance Register</option>
              <option value="fee">💰 Fee Register</option>
              <option value="exam">📝 Exam Result Register</option>
              <option value="library">📚 Library Register</option>
              <option value="inventory">📦 Inventory Register</option>
            </select>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="grid grid-cols-5 bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm text-center text-xs font-bold text-slate-400 select-none">
          {[
            { s: 1, label: 'Upload Source' },
            { s: 2, label: 'AI OCR Analysis' },
            { s: 3, label: 'Review & Verify' },
            { s: 4, label: 'Batch Import' },
            { s: 5, label: 'Import Completed' }
          ].map((item) => (
            <div 
              key={item.s} 
              className={`flex flex-col sm:flex-row items-center justify-center gap-2 ${step === item.s ? 'text-indigo-650 font-black' : ''}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === item.s ? 'bg-indigo-650 text-white' : step > item.s ? 'bg-indigo-50 text-indigo-700 border border-indigo-150' : 'bg-slate-100'}`}>
                {step > item.s ? '✓' : item.s}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Floating Error Box */}
        {apiError && (
          <div className="bg-rose-50 border border-rose-250 text-rose-800 px-4 py-3.5 rounded-2xl flex items-center justify-between text-xs font-bold shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>{apiError}</span>
            </div>
            <button onClick={() => setApiError(null)} className="text-rose-500 hover:text-rose-800 font-bold ml-4">✕</button>
          </div>
        )}

        {/* STEP 1: UPLOAD REGISTER */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Webcam Frame Column */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[400px]">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Camera / Webcam Capture</h3>
                <p className="text-xs text-slate-400 mt-1">Use the built-in webcam or camera device to snap a picture of a page.</p>
              </div>

              <div className="my-6 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center justify-center overflow-hidden h-60 relative shadow-inner">
                {isWebcamActive ? (
                  <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" />
                ) : (
                  <div className="text-slate-350 text-xs font-bold flex flex-col items-center gap-2">
                    <span className="text-2xl">📷</span>
                    <span>Camera Feed Off</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {isWebcamActive ? (
                  <>
                    <button
                      onClick={capturePhoto}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition active:scale-97 cursor-pointer"
                    >
                      Capture Photo
                    </button>
                    <button
                      onClick={stopWebcam}
                      className="border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs py-3 px-6 rounded-xl transition active:scale-97 cursor-pointer"
                    >
                      Stop
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startWebcam}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs py-3 rounded-xl transition active:scale-97 cursor-pointer"
                  >
                    ⚡ Activate Webcam Camera
                  </button>
                )}
              </div>
            </div>

            {/* Main Drag-and-Drop Area */}
            <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[400px]">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Scanned Document Upload</h3>
                <p className="text-xs text-slate-400 mt-1">Select scanned register pages. Formats supported: JPG, PNG, WEBP, PDF, CSV.</p>
              </div>

              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="my-6 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl flex flex-col items-center justify-center p-8 bg-slate-50/20 cursor-pointer h-60 text-center group transition"
                onClick={() => document.getElementById('register-file-input')?.click()}
              >
                <input
                  type="file"
                  id="register-file-input"
                  multiple
                  accept="image/*,application/pdf,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <span className="text-4xl mb-2 block group-hover:scale-110 transition-transform">📤</span>
                <span className="text-xs font-bold text-slate-600 block">Drag & Drop register documents here</span>
                <span className="text-[10px] text-slate-400 block font-semibold mt-1">or click to browse local files</span>
              </div>

              {/* Uploaded Files Queue */}
              {uploadedFiles.length > 0 && (
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-2 max-h-40 overflow-y-auto">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Uploaded Files Queue ({uploadedFiles.length})</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white border border-slate-200/50 p-2 rounded-xl">
                        <span className="truncate max-w-[150px] font-bold">{file.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">({Math.round(file.size / 1024)} KB)</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              setUploadedFiles(prev => prev.filter((_, i) => i !== idx))
                            }}
                            className="text-rose-500 font-bold hover:underline"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                disabled={uploadedFiles.length === 0}
                onClick={triggerAIExtraction}
                className={`w-full font-bold text-xs py-3.5 rounded-xl transition active:scale-97 cursor-pointer text-center ${
                  uploadedFiles.length > 0 
                    ? 'bg-indigo-650 hover:bg-indigo-700 text-white shadow shadow-indigo-600/10' 
                    : 'bg-slate-150 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                Analyze Registers with Smart AI 🔮
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: READING REGISTER ANIMATED SCREEN */}
        {step === 2 && (
          <div className="bg-white border border-slate-200/60 rounded-3xl p-12 text-center shadow-sm space-y-8 relative overflow-hidden">
            {/* Visual Scanning overlay */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
            
            <div className="relative mx-auto w-32 h-44 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden shadow">
              <span className="text-3xl">📄</span>
              {/* Glowing laser line scanning down */}
              <div className="absolute inset-x-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_#6366f1] animate-[bounce_2.5s_infinite]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">AI Admission Processing</h3>
              <p className="text-indigo-600 font-black text-sm animate-pulse">{statusMessage}</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto font-semibold">AI is processing the register structure, resolving rows, correcting formatting, and mapping headers.</p>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & EDIT GRID */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT: Split OCR preview panel */}
            <div className="lg:col-span-4 bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4 lg:sticky lg:top-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-800">Source Document Preview</h3>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Page {(activeSelectedRow?.page_index ?? 0) + 1} of {uploadedFiles.length || 1}
                </span>
              </div>

              <div className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-100 h-[480px] relative flex items-center justify-center">
                {uploadedFiles.length > 0 ? (
                  uploadedFiles[activeSelectedRow?.page_index ?? 0]?.mimeType === 'application/pdf' ? (
                    <embed 
                      src={uploadedFiles[activeSelectedRow?.page_index ?? 0].base64} 
                      type="application/pdf" 
                      className="w-full h-full" 
                    />
                  ) : (
                    <img 
                      src={uploadedFiles[activeSelectedRow?.page_index ?? 0].base64} 
                      alt="Source Page" 
                      className="w-full h-full object-contain" 
                    />
                  )
                ) : (
                  <span className="text-xs font-bold text-slate-400">CSV data imported directly. No preview available.</span>
                )}
                
                {/* Simulated Highlight Box on PDF/Image */}
                {uploadedFiles.length > 0 && (
                  <div className="absolute inset-x-0 h-10 bg-indigo-500/10 border-y border-indigo-500/30 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-black text-indigo-700 bg-white/90 border border-indigo-200 px-2 py-0.5 rounded-full shadow-sm">
                      Currently Selected: {activeSelectedRow?.student_name.value || 'Row'}
                    </span>
                  </div>
                )}
              </div>

              {/* Confidence color guide */}
              <div className="grid grid-cols-3 gap-2 text-[10px] font-extrabold text-center pt-2 select-none">
                <div className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg">High: 90-100%</div>
                <div className="px-2 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg">Medium: 70-89%</div>
                <div className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg">Low: &lt;70%</div>
              </div>
            </div>

            {/* RIGHT: Editable Spreadsheet Spreadsheet-like Grid */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Spreadsheet filters */}
              <div className="bg-white border border-slate-200/50 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search rows..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="pl-3 pr-8 py-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-44"
                  />
                  
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-650 cursor-pointer outline-none"
                  >
                    <option value="all">All Records</option>
                    <option value="duplicate">⚠️ Duplicates Only</option>
                    <option value="errors">❌ Errors Only</option>
                    <option value="unverified">📝 Unverified Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleUndo} 
                    disabled={undoStack.length === 0}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-95 disabled:opacity-40 cursor-pointer select-none text-slate-500 font-bold"
                    title="Undo Change"
                  >
                    ↩
                  </button>
                  <button 
                    onClick={handleRedo} 
                    disabled={redoStack.length === 0}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-95 disabled:opacity-40 cursor-pointer select-none text-slate-500 font-bold"
                    title="Redo Change"
                  >
                    ↪
                  </button>
                  <button
                    onClick={handleInsertRow}
                    className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    + Add Row
                  </button>
                </div>
              </div>

              {/* Records Spreadsheet Main Grid */}
              <div className="bg-white border border-slate-200/50 rounded-3xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider select-none">
                        <th className="py-3 px-4 w-12 text-center">No</th>
                        <th className="py-3 px-4 w-32">Status</th>
                        <th className="py-3 px-4 w-48">Student Name</th>
                        <th className="py-3 px-4 w-32">Adm No</th>
                        <th className="py-3 px-4 w-24">Class</th>
                        <th className="py-3 px-4 w-24">Sec</th>
                        <th className="py-3 px-4 w-36">Parent Phone</th>
                        <th className="py-3 px-4 w-40">Father Name</th>
                        <th className="py-3 px-4 w-36">DOB</th>
                        <th className="py-3 px-4 w-44">Gender</th>
                        <th className="py-3 px-4 text-right pr-6 w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                      {paginatedRecords.map((row, idx) => {
                        const globalIdx = (currentPage - 1) * rowsPerPage + idx
                        const isSelected = row.id === selectedRowId
                        
                        return (
                          <tr
                            key={row.id}
                            onClick={() => setSelectedRowId(row.id)}
                            className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                              isSelected ? 'bg-indigo-50/10 border-l-4 border-indigo-600' : ''
                            } ${row.validationErrors.length > 0 ? 'bg-rose-50/5' : ''}`}
                          >
                            <td className="py-3.5 px-4 text-slate-400 text-center font-black">{globalIdx + 1}</td>
                            
                            {/* Validation / Resolution cell */}
                            <td className="py-3.5 px-4">
                              {row.isDuplicate ? (
                                <div className="space-y-1">
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                                    Duplicate
                                  </span>
                                  <select
                                    value={row.resolutionAction}
                                    onChange={(e) => handleResolutionChange(row.id, e.target.value as any)}
                                    className="block bg-slate-50 border border-slate-200 text-[10px] rounded-lg p-1 outline-none font-bold"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <option value="skip">Skip Import</option>
                                    <option value="update">Update DB</option>
                                    <option value="replace">Replace DB</option>
                                  </select>
                                </div>
                              ) : row.validationErrors.length > 0 ? (
                                <span 
                                  className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100"
                                  title={row.validationErrors.join('\n')}
                                >
                                  Error
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  Ready
                                </span>
                              )}
                            </td>

                            {/* Student Name */}
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                value={row.student_name.value}
                                onChange={(e) => handleCellEdit(row.id, 'student_name', e.target.value)}
                                className={`w-full bg-transparent border-0 font-bold p-1 rounded focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none ${getConfidenceColor(row.student_name.confidence)}`}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>

                            {/* Admission Number */}
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                placeholder="Auto"
                                value={row.admission_number.value}
                                onChange={(e) => handleCellEdit(row.id, 'admission_number', e.target.value)}
                                className={`w-full bg-transparent border-0 p-1 rounded focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none ${getConfidenceColor(row.admission_number.confidence)}`}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>

                            {/* Class */}
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                value={row.class.value}
                                onChange={(e) => handleCellEdit(row.id, 'class', e.target.value)}
                                className={`w-full bg-transparent border-0 p-1 rounded focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none ${getConfidenceColor(row.class.confidence)}`}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>

                            {/* Section */}
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                value={row.section.value}
                                onChange={(e) => handleCellEdit(row.id, 'section', e.target.value)}
                                className={`w-full bg-transparent border-0 p-1 rounded focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none ${getConfidenceColor(row.section.confidence)}`}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>

                            {/* Parent Phone */}
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                value={row.phone.value}
                                onChange={(e) => handleCellEdit(row.id, 'phone', e.target.value)}
                                className={`w-full bg-transparent border-0 p-1 rounded focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none ${getConfidenceColor(row.phone.confidence)}`}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>

                            {/* Father Name */}
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                value={row.father_name.value}
                                onChange={(e) => handleCellEdit(row.id, 'father_name', e.target.value)}
                                className={`w-full bg-transparent border-0 p-1 rounded focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none ${getConfidenceColor(row.father_name.confidence)}`}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>

                            {/* DOB */}
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                placeholder="YYYY-MM-DD"
                                value={row.date_of_birth.value}
                                onChange={(e) => handleCellEdit(row.id, 'date_of_birth', e.target.value)}
                                className={`w-full bg-transparent border-0 p-1 rounded focus:ring-2 focus:ring-indigo-500/20 focus:bg-white outline-none ${getConfidenceColor(row.date_of_birth.confidence)}`}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>

                            {/* Gender */}
                            <td className="py-3.5 px-4">
                              <select
                                value={row.gender.value || 'Male'}
                                onChange={(e) => handleCellEdit(row.id, 'gender', e.target.value)}
                                className="bg-transparent border-0 outline-none w-full p-1 cursor-pointer focus:bg-white focus:ring-2 focus:ring-indigo-500/20 rounded"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>

                            {/* Row Action buttons */}
                            <td className="py-3.5 px-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2.5">
                                <button
                                  onClick={() => handleDuplicateRow(row.id)}
                                  className="text-slate-400 hover:text-indigo-600 font-bold"
                                  title="Duplicate Row"
                                >
                                  📄
                                </button>
                                <button
                                  onClick={() => handleDeleteRow(row.id)}
                                  className="text-slate-400 hover:text-rose-600 font-bold"
                                  title="Delete Row"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>

                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Spreadsheet Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 select-none">
                    <span>
                      Showing {currentPage * rowsPerPage - rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredRecords.length)} of {filteredRecords.length} records
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Validation Warning Summary Box */}
              {records.some(r => r.validationErrors.length > 0 || r.isDuplicate) && (
                <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-4 text-xs font-semibold text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>Action Required: Some rows contain duplicate records or formatting issues.</span>
                  </p>
                  <ul className="list-disc pl-5 font-medium space-y-0.5">
                    <li>Duplicate records are highlighted. Review their resolution rules (e.g., Update Database, Skip Import).</li>
                    <li>Missing or invalid formats are highlighted. You can correct them directly inside the table cells.</li>
                  </ul>
                </div>
              )}

              {/* Bottom save bar */}
              <div className="flex justify-end gap-3.5 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs py-3.5 px-6 rounded-xl transition active:scale-95 cursor-pointer shadow-sm"
                >
                  ✕ Clear All & Start Over
                </button>
                <button
                  onClick={triggerImportProcess}
                  className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs py-3.5 px-8 rounded-xl transition active:scale-95 cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  ✓ Approve and Import ({records.filter(r => r.resolutionAction !== 'skip').length} / {records.length} Students)
                </button>
              </div>

            </div>
          </div>
        )}

        {/* STEP 4: IMPORT BATCHES EXECUTION */}
        {step === 4 && (
          <div className="bg-white border border-slate-200/60 rounded-3xl p-8 shadow-sm space-y-8 text-center max-w-xl mx-auto">
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800">Importing Student Directory</h3>
              <p className="text-xs text-slate-400 font-semibold">Creating profiles, parent auth credentials, and memberships in Supabase...</p>
            </div>

            {/* Premium circular progress indicator */}
            <div className="relative w-36 h-36 mx-auto flex items-center justify-center select-none">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="72" cy="72" r="64" className="stroke-slate-100 fill-none" strokeWidth="8" />
                <circle
                  cx="72"
                  cy="72"
                  r="64"
                  className="stroke-indigo-600 fill-none transition-all duration-300"
                  strokeWidth="8"
                  strokeDasharray={402}
                  strokeDashoffset={402 - (402 * (currentImportIndex + 1)) / records.length}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-slate-800">
                  {Math.round(((currentImportIndex + 1) / records.length) * 100)}%
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {currentImportIndex + 1} / {records.length} Rows
                </span>
              </div>
            </div>

            {/* Batch status counters */}
            <div className="grid grid-cols-4 gap-2 text-xs font-black select-none">
              <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl p-3">
                <span className="text-lg block">{importStats.imported}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Created</span>
              </div>
              <div className="bg-indigo-50 text-indigo-600 border border-indigo-150 rounded-2xl p-3">
                <span className="text-lg block">{importStats.updated}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Updated</span>
              </div>
              <div className="bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl p-3">
                <span className="text-lg block">{importStats.skipped}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Skipped</span>
              </div>
              <div className="bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl p-3">
                <span className="text-lg block">{importStats.failed}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Failed</span>
              </div>
            </div>

            {/* Speed stats */}
            <div className="flex justify-between items-center text-xs font-bold text-slate-450 border-t border-b border-slate-100 py-3 px-2">
              <span>Time Elapsed: {elapsedTime}s</span>
              <span>Estimated Time: {estTimeRemaining}s remaining</span>
            </div>

            {/* Current row executing log */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left max-h-36 overflow-y-auto space-y-1 text-xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Real-time Batch Log</span>
              {importLogs.map((log, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="truncate font-semibold text-slate-700 max-w-[250px]">{log.name}</span>
                  <span className={`font-black uppercase text-[9px] ${
                    log.status === 'success' ? 'text-emerald-500' : log.status === 'skipped' ? 'text-amber-500' : 'text-rose-500'
                  }`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: COMPLETED SUMMARY */}
        {step === 5 && (
          <div className="bg-white border border-slate-200/60 rounded-3xl p-8 shadow-sm text-center max-w-xl mx-auto space-y-8">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 text-2xl flex items-center justify-center rounded-2xl mx-auto">
                ✓
              </div>
              <h3 className="text-xl font-black text-slate-805">Digitization Complete</h3>
              <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">The register has been successfully processed. The student directory database is fully synchronized.</p>
            </div>

            {/* Statistics box */}
            <div className="border border-slate-150 rounded-2xl p-4 bg-slate-55/30 grid grid-cols-2 gap-4 text-xs font-bold text-left text-slate-700 select-none">
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black">Total Processed Rows</span>
                <span className="text-base font-black text-slate-800">{importStats.total}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black">New Students Created</span>
                <span className="text-base font-black text-slate-800">{importStats.imported}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black">Existing Records Updated</span>
                <span className="text-base font-black text-slate-800">{importStats.updated}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-black">Records Skipped / Failed</span>
                <span className="text-base font-black text-slate-800">{importStats.skipped + importStats.failed}</span>
              </div>
            </div>

            {/* Final Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={downloadImportReport}
                className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs py-3.5 rounded-xl transition active:scale-95 cursor-pointer shadow-sm"
              >
                Download CSV Report
              </button>
              
              <Link
                href="/students"
                className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs py-3.5 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center shadow-md shadow-indigo-600/10"
              >
                View Imported Students
              </Link>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
