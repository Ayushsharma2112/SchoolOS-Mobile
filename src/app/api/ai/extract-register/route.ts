import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

const SCHEMA_PROMPTS: Record<string, { prompt: string; schema: string }> = {
  student: {
    schema: `
{
  "records": [
    {
      "page_index": number (0-indexed matching the order of input files),
      "admission_number": { "value": "string", "confidence": number (0-100) },
      "roll_number": { "value": "string", "confidence": number (0-100) },
      "student_name": { "value": "string", "confidence": number (0-100) },
      "father_name": { "value": "string", "confidence": number (0-100) },
      "mother_name": { "value": "string", "confidence": number (0-100) },
      "gender": { "value": "string (Male/Female/Other)", "confidence": number (0-100) },
      "date_of_birth": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "class": { "value": "string", "confidence": number (0-100) },
      "section": { "value": "string", "confidence": number (0-100) },
      "phone": { "value": "string", "confidence": number (0-100) },
      "address": { "value": "string", "confidence": number (0-100) },
      "blood_group": { "value": "string", "confidence": number (0-100) },
      "admission_date": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "religion": { "value": "string", "confidence": number (0-100) },
      "nationality": { "value": "string", "confidence": number (0-100) },
      "email": { "value": "string", "confidence": number (0-100) },
      "guardian_name": { "value": "string", "confidence": number (0-100) },
      "remarks": { "value": "string", "confidence": number (0-100) }
    }
  ]
}
`,
    prompt: `You are a school registry archivist. Analyze the uploaded school registration or student register pages. 
The pages contain rows of students in a tabular format, which may be printed or handwritten.
Understand the table structure, including columns, rows, headers, and any merged cells. Do NOT perform simple raw OCR. Understand the context of each cell.
Extract every student row separately. For fields that are missing or illegible, set the "value" to "" and "confidence" to 0. Do NOT hallucinate or guess any values.
For dates, try to format them as YYYY-MM-DD. For classes, extract them exactly as written (e.g. "V", "5", "Class Five", "Grade 5").
For each record, include a "page_index" indicating which input page/file it was found on (0-indexed matching the order of input files).
For each extracted field, provide a confidence score from 0 to 100 based on handwriting legibility and clarity.
`
  },
  teacher: {
    schema: `
{
  "records": [
    {
      "page_index": number (0-indexed),
      "teacher_id": { "value": "string", "confidence": number (0-100) },
      "full_name": { "value": "string", "confidence": number (0-100) },
      "email": { "value": "string", "confidence": number (0-100) },
      "phone": { "value": "string", "confidence": number (0-100) },
      "gender": { "value": "string (Male/Female/Other)", "confidence": number (0-100) },
      "date_of_birth": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "joining_date": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "qualification": { "value": "string", "confidence": number (0-100) },
      "designation": { "value": "string", "confidence": number (0-100) },
      "department": { "value": "string", "confidence": number (0-100) },
      "address": { "value": "string", "confidence": number (0-100) },
      "blood_group": { "value": "string", "confidence": number (0-100) },
      "emergency_contact": { "value": "string", "confidence": number (0-100) },
      "remarks": { "value": "string", "confidence": number (0-100) }
    }
  ]
}
`,
    prompt: `You are a school HR coordinator. Analyze the uploaded teacher register pages.
The pages contain teacher profiles in a tabular format. Understand columns, rows, and headers.
Extract every teacher row separately. For fields that are missing or illegible, set the "value" to "" and "confidence" to 0. Do NOT hallucinate.
Include a "page_index" (0-indexed) for each record.
Provide a confidence score from 0 to 100 for each field based on clarity and legibility.
`
  },
  attendance: {
    schema: `
{
  "records": [
    {
      "page_index": number (0-indexed),
      "student_name": { "value": "string", "confidence": number (0-100) },
      "admission_number": { "value": "string", "confidence": number (0-100) },
      "roll_number": { "value": "string", "confidence": number (0-100) },
      "class": { "value": "string", "confidence": number (0-100) },
      "section": { "value": "string", "confidence": number (0-100) },
      "date": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "status": { "value": "string (Present/Absent)", "confidence": number (0-100) },
      "remarks": { "value": "string", "confidence": number (0-100) }
    }
  ]
}
`,
    prompt: `You are a school administrator. Analyze the uploaded attendance register pages.
The pages contain attendance logs for students in a tabular format.
Extract every attendance record. For fields that are missing or illegible, set the "value" to "" and "confidence" to 0.
Include a "page_index" (0-indexed) for each record.
Provide a confidence score from 0 to 100 for each field.
`
  },
  fee: {
    schema: `
{
  "records": [
    {
      "page_index": number (0-indexed),
      "student_name": { "value": "string", "confidence": number (0-100) },
      "admission_number": { "value": "string", "confidence": number (0-100) },
      "class": { "value": "string", "confidence": number (0-100) },
      "section": { "value": "string", "confidence": number (0-100) },
      "amount": { "value": "string", "confidence": number (0-100) },
      "payment_date": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "payment_method": { "value": "string (Cash/Bank/Card/etc)", "confidence": number (0-100) },
      "month": { "value": "string", "confidence": number (0-100) },
      "status": { "value": "string (Paid/Unpaid)", "confidence": number (0-100) },
      "receipt_number": { "value": "string", "confidence": number (0-100) },
      "remarks": { "value": "string", "confidence": number (0-100) }
    }
  ]
}
`,
    prompt: `You are a school accounts accountant. Analyze the uploaded fee register pages.
The pages contain payment status records for students.
Extract every fee record row. For fields that are missing or illegible, set the "value" to "" and "confidence" to 0.
Include a "page_index" (0-indexed) for each record.
Provide a confidence score from 0 to 100 for each field.
`
  },
  exam: {
    schema: `
{
  "records": [
    {
      "page_index": number (0-indexed),
      "student_name": { "value": "string", "confidence": number (0-100) },
      "admission_number": { "value": "string", "confidence": number (0-100) },
      "class": { "value": "string", "confidence": number (0-100) },
      "section": { "value": "string", "confidence": number (0-100) },
      "subject": { "value": "string", "confidence": number (0-100) },
      "marks_obtained": { "value": "string", "confidence": number (0-100) },
      "max_marks": { "value": "string", "confidence": number (0-100) },
      "grade": { "value": "string", "confidence": number (0-100) },
      "exam_name": { "value": "string", "confidence": number (0-100) },
      "remarks": { "value": "string", "confidence": number (0-100) }
    }
  ]
}
`,
    prompt: `You are a school examinations officer. Analyze the uploaded exam results register pages or report cards.
The pages contain students' scores in subjects.
Extract every student result separately. For missing/illegible fields, set "value" to "" and "confidence" to 0.
Include a "page_index" (0-indexed) for each record.
Provide a confidence score from 0 to 100 for each field.
`
  },
  library: {
    schema: `
{
  "records": [
    {
      "page_index": number (0-indexed),
      "book_title": { "value": "string", "confidence": number (0-100) },
      "author": { "value": "string", "confidence": number (0-100) },
      "isbn": { "value": "string", "confidence": number (0-100) },
      "borrower_name": { "value": "string", "confidence": number (0-100) },
      "borrower_id": { "value": "string", "confidence": number (0-100) },
      "borrower_role": { "value": "string (Student/Teacher)", "confidence": number (0-100) },
      "issue_date": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "due_date": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "return_date": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "status": { "value": "string (Issued/Returned/Overdue)", "confidence": number (0-100) },
      "remarks": { "value": "string", "confidence": number (0-100) }
    }
  ]
}
`,
    prompt: `You are a school librarian. Analyze the uploaded library issue/return register pages.
The pages contain book logs.
Extract every library loan record. For missing/illegible fields, set "value" to "" and "confidence" to 0.
Include a "page_index" (0-indexed) for each record.
Provide a confidence score from 0 to 100 for each field.
`
  },
  inventory: {
    schema: `
{
  "records": [
    {
      "page_index": number (0-indexed),
      "item_name": { "value": "string", "confidence": number (0-100) },
      "category": { "value": "string", "confidence": number (0-100) },
      "quantity": { "value": "string", "confidence": number (0-100) },
      "unit_price": { "value": "string", "confidence": number (0-100) },
      "total_value": { "value": "string", "confidence": number (0-100) },
      "supplier_name": { "value": "string", "confidence": number (0-100) },
      "purchase_date": { "value": "string (YYYY-MM-DD)", "confidence": number (0-100) },
      "status": { "value": "string (Available/In Use/Damaged)", "confidence": number (0-100) },
      "remarks": { "value": "string", "confidence": number (0-100) }
    }
  ]
}
`,
    prompt: `You are a school inventory manager. Analyze the uploaded stock or asset register pages.
The pages contain inventory items.
Extract every inventory item row. For missing/illegible fields, set "value" to "" and "confidence" to 0.
Include a "page_index" (0-indexed) for each record.
Provide a confidence score from 0 to 100 for each field.
`
  }
}

async function generateOpenRouterContentWithRetry(apiKey: string, modelName: string, prompt: string, files: any[], logStep: (stepName: string) => void) {
  let lastError = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      logStep('Image conversion/base64 processing')
      console.log(`Querying OpenRouter with model ${modelName} (attempt ${attempt})...`)
      
      const isTestConnection = files.length === 0

      const content = isTestConnection
        ? 'Reply with exactly: SchoolOS AI is working'
        : [
            {
              type: 'text',
              text: prompt
            },
            ...files.map((file: any) => {
              const base64Raw = file.base64.replace(/^data:.*?;base64,/, '')
              if (file.mimeType.startsWith('image/')) {
                return {
                  type: 'image_url',
                  image_url: {
                    url: `data:${file.mimeType};base64,${base64Raw}`
                  }
                }
              } else {
                return {
                  type: 'file',
                  file: {
                    file_data: `data:${file.mimeType};base64,${base64Raw}`
                  }
                }
              }
            })
          ]

      logStep('OpenRouter API request START')

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://schoolos.com',
          'X-Title': 'School OS',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          ...(isTestConnection ? {} : { response_format: { type: 'json_object' } }),
          messages: [
            {
              role: 'user',
              content: content
            }
          ],
          max_tokens: isTestConnection ? 1000 : 4000
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`OpenRouter error response (Internal): status ${response.status} - ${errorText}`)
        throw new Error(`OpenRouter API error: status ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(`OpenRouter API error: ${data.error.message || JSON.stringify(data.error)}`)
      }

      logStep('OpenRouter API response RECEIVED')

      const text = data.choices?.[0]?.message?.content
      if (!text) {
        throw new Error('OpenRouter response contains no text content.')
      }

      return { text, model: modelName }
    } catch (err: any) {
      lastError = err
      console.error(`OpenRouter query error on attempt ${attempt}:`, err.message)
      
      if (attempt < 3 && (err.message.includes('503') || err.message.includes('429') || err.message.includes('limit') || err.message.includes('demand'))) {
        const delay = attempt * 1500
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError || new Error('All OpenRouter attempts failed')
}

export async function POST(request: NextRequest) {
  const start = Date.now()
  let lastTime = start

  const logStep = (stepName: string) => {
    const now = Date.now()
    const elapsed = now - lastTime
    const total = now - start
    console.log(`[AI REGISTER] ${stepName}: ${elapsed}ms (Total elapsed: ${total}ms)`)
    lastTime = now
  }

  console.log('[AI REGISTER] Request received')

  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch (e) {
      return Response.json({ success: false, error: 'Invalid JSON request body.' }, { status: 400 })
    }

    logStep('Image/file retrieval')

    const { registerType = 'student', files, schoolId, fileName, fileSize, test } = body

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return Response.json({ 
        success: false, 
        error: 'OPENROUTER_API_KEY is not configured on the server. Please add it to your .env.local file.' 
      }, { status: 500 })
    }

    if (test === true) {
      console.log('Running basic OpenRouter connection test request...')
      try {
        const testResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openrouter/free',
            messages: [
              {
                role: 'user',
                content: 'Reply with exactly: SchoolOS AI is working'
              }
            ],
            max_tokens: 1000
          })
        })

        if (!testResponse.ok) {
          const errText = await testResponse.text()
          console.error(`OpenRouter test connection failed (Internal): status ${testResponse.status} - ${errText}`)
          return Response.json({ success: false, error: `OpenRouter API error: status ${testResponse.status}` }, { status: testResponse.status })
        }

        const testData = await testResponse.json()
        const testText = testData.choices?.[0]?.message?.content || 'No response text'
        return Response.json({ success: true, message: testText })
      } catch (testErr: any) {
        console.error('OpenRouter test request threw exception (Internal):', testErr.message)
        return Response.json({ success: false, error: 'OpenRouter connection failed' }, { status: 500 })
      }
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return Response.json({ success: false, error: 'Missing required file data array.' }, { status: 400 })
    }

    const config = SCHEMA_PROMPTS[registerType]
    if (!config) {
      return Response.json({ success: false, error: `Unsupported register type: ${registerType}` }, { status: 400 })
    }

    const modelName = process.env.OPENROUTER_MODEL || 'openai/gpt-4o'

    const prompt = `
${config.prompt}

Return a JSON object containing the parsed rows matching this exact schema layout:
${config.schema}

CRITICAL RULES:
1. Return ONLY the requested JSON format. Do not return markdown, do not enclose it in \`\`\`json.
2. Under no circumstances should you hallucinate or make up values. If a cell is blank, return "" for its value.
3. Every record object MUST have a "page_index" integer key (starting at 0) corresponding to the index of the file in the files array it was read from.
4. OPTIMIZE OUTPUT TO FIT WITHIN TOKEN LIMITS: To prevent truncation under strict output token limits, you should return flat string values instead of the nested { value, confidence } objects for the record fields where possible. For example: "student_name": "Aarav Sharma" is completely acceptable and preferred over "student_name": { "value": "Aarav Sharma", "confidence": 100 }.
5. Do NOT output empty, blank, or null fields. If a field has a blank/empty value or is not found in the documents, simply omit the key entirely from the JSON object. This is critical to save output tokens and avoid truncation.
`

    // Execute OpenRouter analysis with robust retries
    const { text, model } = await generateOpenRouterContentWithRetry(apiKey, modelName, prompt, files, logStep)
    
    let parsed: any = {}
    try {
      if (text.includes('SchoolOS AI is working')) {
        parsed = {
          records: [
            {
              page_index: 0,
              student_name: { value: 'SchoolOS AI is working', confidence: 100 },
              admission_number: { value: 'ADM-TEST-101', confidence: 100 },
              class: { value: '1', confidence: 100 },
              phone: { value: '9999999999', confidence: 100 }
            }
          ]
        }
      } else {
        // Strip markdown code blocks if the model returned them despite rules
        const cleanText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
        parsed = JSON.parse(cleanText)
      }
      logStep('Response JSON parsing')
    } catch (parseErr) {
      console.error('Failed to parse OpenRouter response text as JSON. Raw text:', text)
      return Response.json({ 
        success: false, 
        error: 'OpenRouter API returned invalid JSON syntax.', 
        rawText: text 
      }, { status: 500 })
    }

    // Logging validation and duplicate check as 0ms since they are client-side operations
    logStep('Student-data validation/cleanup')
    logStep('Duplicate checking')

    // Try logging the import job in the database (gracefully degrades if table is missing)
    let jobId = null
    if (schoolId) {
      try {
        const supabase = getSupabaseAdmin()
        const { data: job } = await supabase
          .from('import_jobs')
          .insert({
            school_id: schoolId,
            register_type: registerType,
            status: 'processing',
            total_rows: parsed.records ? parsed.records.length : 0
          })
          .select()
          .single()

        if (job) {
          jobId = job.id
          if (fileName) {
            await supabase.from('import_files').insert({
              job_id: jobId,
              file_name: fileName,
              file_size: fileSize || 0
            })
          }
        }
      } catch (dbErr: any) {
        console.warn('Database logging skipped (import tables might not exist yet):', dbErr.message)
      }
    }
    logStep('Supabase database operations')

    logStep('Final response sent')
    console.log(`[AI REGISTER] TOTAL: ${Date.now() - start}ms`)

    return Response.json({
      success: true,
      records: parsed.records || [],
      modelUsed: model,
      jobId
    })
  } catch (err: any) {
    console.error('AI Register Extraction route error:', err)
    return Response.json({ success: false, error: err.message || 'AI extraction failed' }, { status: 500 })
  }
}
