export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

const BOT_URL = process.env.VICKY_BOT_URL || 'https://vicky-bot-uh3qtftq3q-uc.a.run.app'
const BOT_SECRET = process.env.VICKY_CRON_SECRET || ''

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value
  if (!sessionCookie) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    await adminAuth.verifySessionCookie(sessionCookie, true)
  } catch {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
  }

  const { jid } = await request.json()
  if (!jid || typeof jid !== 'string') {
    return NextResponse.json({ error: 'Falta jid' }, { status: 400 })
  }

  if (!BOT_SECRET) {
    return NextResponse.json({ error: 'VICKY_CRON_SECRET no configurado' }, { status: 500 })
  }

  try {
    const resp = await fetch(`${BOT_URL}/internal/asistencia-vicky`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jid, cronSecret: BOT_SECRET }),
    })

    const data = await resp.json()
    return NextResponse.json(data, { status: resp.ok ? 200 : 502 })
  } catch (err: any) {
    console.error('Error llamando al bot:', err?.message || err)
    return NextResponse.json(
      { error: 'No se pudo contactar al bot', detail: err?.message },
      { status: 502 }
    )
  }
}
