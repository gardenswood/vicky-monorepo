export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { requireAssistantUser } from '@/lib/assistant/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAssistantUser(request)
    const db = getAdminDb()
    const snap = await db.collection('assistant_runs').orderBy('createdAt', 'desc').limit(30).get()
    return NextResponse.json({
      runs: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message === 'NO_SESSION' ? 401 : 500
    return NextResponse.json({ error: 'No se pudieron listar los runs' }, { status })
  }
}
