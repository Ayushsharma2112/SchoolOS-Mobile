import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { level, args } = await request.json()
    const prefix = `[CLIENT-${(level || 'log').toUpperCase()}]`
    
    // Log directly to the server terminal
    if (level === 'error') {
      console.error(prefix, ...args)
    } else if (level === 'warn') {
      console.warn(prefix, ...args)
    } else if (level === 'info') {
      console.info(prefix, ...args)
    } else if (level === 'debug') {
      console.debug(prefix, ...args)
    } else {
      console.log(prefix, ...args)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
