export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// POST /api/usuarios - create new user
export async function POST(request: NextRequest) {
  // Verify admin session
  const sessionCookie = request.cookies.get('session')?.value
  if (!sessionCookie) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const callerDoc = await adminDb.collection('usuarios').doc(decoded.uid).get()
    if (!callerDoc.exists || callerDoc.data()?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo admins pueden crear usuarios' }, { status: 403 })
    }

    const { email, nombre, rol } = await request.json()
    if (!email || !nombre || !rol) {
      return NextResponse.json({ error: 'Email, nombre y rol son requeridos' }, { status: 400 })
    }

    // Generate temp password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '!'

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({ email, password: tempPassword, displayName: nombre })

    // Set custom claims
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: rol })

    // Save to Firestore
    await adminDb.collection('usuarios').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      nombre,
      rol,
      activo: true,
      creadoEn: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ success: true, uid: userRecord.uid, tempPassword })
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string; message?: string }
    if (firebaseErr.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
