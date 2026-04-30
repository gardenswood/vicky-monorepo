export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { requireAssistantUser } from '@/lib/assistant/auth'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAssistantUser(request)
    const { id } = await context.params
    const db = getAdminDb()
    const runSnap = await db.collection('assistant_runs').doc(id).get()
    if (!runSnap.exists) return NextResponse.json({ error: 'Run no encontrado' }, { status: 404 })

    const changesSnap = await db.collection('assistant_changes').where('runId', '==', id).get()
    return NextResponse.json({
      run: { id: runSnap.id, ...runSnap.data() },
      changes: changesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'NO_SESSION' ? 401 : 500
    return NextResponse.json({ error: 'No se pudo leer el run' }, { status })
  }
}
