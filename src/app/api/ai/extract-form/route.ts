import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  let requestBody: any = {}
  try {
    requestBody = await request.json()
  } catch (e) {
    return Response.json({ success: false, error: 'Invalid JSON request body.' }, { status: 400 })
  }

  const { fileBase64, mimeType, test } = requestBody

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return Response.json({ 
      success: false, 
      error: 'OPENROUTER_API_KEY is not configured on the server. Please add it to your .env.local file.' 
    }, { status: 500 })
  }

  if (test === true) {
    console.log('Running basic OpenRouter connection test request in extract-form...')
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

  if (!fileBase64 || !mimeType) {
    return Response.json({ success: false, error: 'Missing required file data or mimeType.' }, { status: 400 })
  }

  const modelName = process.env.OPENROUTER_MODEL || 'openai/gpt-4o'

  try {

    const prompt = `
You are a school registrar assistant. Analyze the uploaded school registration or admission form and extract all details in structured JSON format.

Return a JSON object with the following schema:
{
  "student": {
    "name": "Full name of the student",
    "admission_number": "Admission / Registration number, if written, else empty",
    "dob": "Date of Birth in YYYY-MM-DD format",
    "gender": "Male, Female, or Other",
    "blood_group": "e.g. A+, O-, B+, etc.",
    "class": "Grade level or Class name",
    "section": "Class Section name (e.g. A, B, C)",
    "roll_number": "Roll number, if written, else empty",
    "address": "Local street address",
    "city": "City name",
    "state": "State name",
    "pin_code": "Postal code",
    "religion": "Religion of the student",
    "nationality": "Nationality of the student",
    "previous_school": "Previous school name if transfer admission, else empty",
    "admission_date": "Date of admission in YYYY-MM-DD format",
    "student_aadhaar": "Aadhaar Card number or National ID if present",
    "student_phone": "Student's contact phone number",
    "email": "Student's contact email address",
    "medical_notes": "Any chronic conditions, medical history, or medical notes written",
    "allergies": "Allergies mentioned, or empty",
    "emergency_contact": "Emergency contact name/phone if written"
  },
  "parent": {
    "father_name": "Father's full name",
    "mother_name": "Mother's full name",
    "guardian_name": "Guardian's name if applicable, else empty",
    "occupation": "Occupation of parent/guardian",
    "phone": "Primary phone number of parent/guardian",
    "email": "Primary email of parent/guardian",
    "address": "Parent address, if different from student",
    "emergency_contact": "Emergency contact details of parent"
  },
  "photograph_box": {
    "ymin": "Integer (0-1000) representing normalized top edge of the student's passport photo box area in the form",
    "xmin": "Integer (0-1000) representing normalized left edge of the student's passport photo box area in the form",
    "ymax": "Integer (0-1000) representing normalized bottom edge of the student's passport photo box area in the form",
    "xmax": "Integer (0-1000) representing normalized right edge of the student's passport photo box area in the form"
  },
  "detected_documents": ["Array of document titles detected or attached in this scan, e.g. 'Birth Certificate', 'Transfer Certificate', 'Aadhaar', 'Photograph', 'Medical Certificate', 'Marksheet'"],
  "confidence": {
    "name": "Float between 0.0 and 1.0 representing your confidence in extracting the student name",
    "dob": "Float between 0.0 and 1.0 representing your confidence in the date of birth",
    "class": "Float between 0.0 and 1.0 representing your confidence in class/grade",
    "parent_phone": "Float between 0.0 and 1.0 representing your confidence in the parent phone number",
    "father_name": "Float between 0.0 and 1.0 representing your confidence in the father name",
    "mother_name": "Float between 0.0 and 1.0 representing your confidence in the mother name"
  }
}

CRITICAL RULES:
1. Extract values exactly as written.
2. If a field is not present or cannot be read, leave it blank (""). Do not guess or make up (hallucinate) any values.
3. For "photograph_box": The bounding box should cover ONLY the small square photo frame where the student's passport size photo is pasted/uploaded. If there is no photo or passport photo box, set ymin, xmin, ymax, xmax all to 0. Bounding box coordinates must be normalized integers between 0 and 1000.
4. If the form is completely illegible or not an admission form, return all fields blank, but ensure valid JSON output.
5. OPTIMIZE OUTPUT TO FIT WITHIN TOKEN LIMITS: To prevent truncation under strict output token limits, do NOT output empty or blank fields. If a field is blank, empty, or not found in the document, simply omit the key entirely from the JSON object. This is critical to save output tokens and avoid truncation.
`

    const isTestConnection = false

    // Prep message content for OpenRouter
    const content = isTestConnection
      ? 'Reply with exactly: SchoolOS AI is working'
      : [
          {
            type: 'text',
            text: prompt
          },
          mimeType.startsWith('image/')
            ? {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${fileBase64.replace(/^data:.*?;base64,/, '')}`
                }
              }
            : {
                type: 'file',
                file: {
                  file_data: `data:${mimeType};base64,${fileBase64.replace(/^data:.*?;base64,/, '')}`
                }
              }
        ]

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

    const resJson = await response.json()
    
    if (resJson.error) {
      throw new Error(`OpenRouter API error: ${resJson.error.message || JSON.stringify(resJson.error)}`)
    }

    const responseText = resJson.choices?.[0]?.message?.content
    if (!responseText) {
      throw new Error('OpenRouter response contains no text content.')
    }

    let parsedResponse = {}
    try {
      if (responseText.includes('SchoolOS AI is working')) {
        parsedResponse = {
          student: {
            name: 'SchoolOS AI is working',
            admission_number: 'ADM-TEST-101',
            dob: '2015-01-01',
            gender: 'Male',
            class: '1',
            section: 'A'
          },
          confidence: {
            name: 1.0,
            dob: 1.0,
            class: 1.0
          }
        }
      } else {
        parsedResponse = JSON.parse(responseText)
      }
    } catch (parseErr) {
      console.error('Failed to parse OpenRouter response text as JSON. Raw response:', responseText)
      throw new Error('OpenRouter API returned invalid JSON syntax.')
    }

    return Response.json({ success: true, data: parsedResponse })
  } catch (err: any) {
    console.error('AI Form Extraction Route error:', err)
    return Response.json({ success: false, error: err.message || 'AI processing failed' }, { status: 500 })
  }
}
