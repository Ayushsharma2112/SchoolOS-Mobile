import { createClient } from '@supabase/supabase-js'

let adminClient: any = null

export function getSupabaseAdmin(): any {
  if (typeof window !== 'undefined') {
    throw new Error('Supabase Admin client can only be used on the server side.')
  }
  if (adminClient) return adminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY1MTU5MzYwMCwiZXhwIjoxOTY3MTY5NjAwfQ.placeholder'

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })

  return adminClient
}
