export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { applyAssistantRun } from '@/lib/assistant/actions'
import { canApplyAssistantChanges, requireAssistantUser } from '@/lib/assistant/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAssistantUser(request)
    if (!canApplyAssistantChanges(user.role)) {
      return NextResponse.json({ error: 'Tu rol no permite aplicar cambios' }, { status: 403 })
    }

    const body = await request.json()
    const runId = typeof body.runId === 'string' ? body.runId.trim() : ''
    if (!runId) return NextResponse.json({ error: 'runId requerido' }, { status: 400 })

    const result = await applyAssistantRun(runId, user)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'NO_SESSION' ? 401 : message === 'RUN_NOT_FOUND' ? 404 : 500
    return NextResponse.json({ error: 'No se pudo aplicar el cambio', detail: message }, { status })
  }
}
