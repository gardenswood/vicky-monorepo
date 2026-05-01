export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { rollbackAssistantRun } from '@/lib/assistant/actions'
import { canApplyAssistantChanges, requireAssistantUser } from '@/lib/assistant/auth'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAssistantUser(request)
    if (!canApplyAssistantChanges(user.role)) {
      return NextResponse.json({ error: 'Tu rol no permite revertir cambios' }, { status: 403 })
    }
    const { id } = await context.params
    const result = await rollbackAssistantRun(id, user)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'NO_SESSION' ? 401 : message === 'RUN_NOT_FOUND' ? 404 : 500
    return NextResponse.json({ error: 'No se pudo revertir el run', detail: message }, { status })
  }
}
