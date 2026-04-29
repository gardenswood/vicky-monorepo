export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

// POST /api/usuarios/claims - update user custom claims
export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value
  if (!sessionCookie) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admins pueden cambiar roles' }, { status: 403 })
    }

    const { uid, rol } = await request.json()
    await adminAuth.setCustomUserClaims(uid, { role: rol })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error al actualizar claims' }, { status: 500 })
  }
}
