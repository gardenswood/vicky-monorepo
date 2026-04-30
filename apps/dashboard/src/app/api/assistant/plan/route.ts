export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAssistantPlan } from '@/lib/assistant/actions'
import { requireAssistantUser } from '@/lib/assistant/auth'
import type { AssistantOrigin } from '@/lib/assistant/types'

function normalizeOrigin(value: unknown): AssistantOrigin {
  return value === 'whatsapp_admin' || value === 'cursor_chat' || value === 'code' ? value : 'dashboard'
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAssistantUser(request)
    const body = await request.json()
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })

    const plan = await createAssistantPlan({
      message,
      origin: normalizeOrigin(body.origin),
      user,
    })
    return NextResponse.json(plan)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'NO_SESSION' ? 401 : 500
    return NextResponse.json({ error: 'No se pudo crear el plan del asistente' }, { status })
  }
}
