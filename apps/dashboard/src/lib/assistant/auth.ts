import type { NextRequest } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import type { AssistantRole, AssistantUser } from './types'

function normalizeRole(value: unknown): AssistantRole {
  return value === 'admin' || value === 'operador' || value === 'viewer' ? value : 'viewer'
}

export async function requireAssistantUser(request: NextRequest): Promise<AssistantUser> {
  const sessionCookie = request.cookies.get('session')?.value
  if (!sessionCookie) throw new Error('NO_SESSION')

  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
  const userDoc = await adminDb.collection('usuarios').doc(decoded.uid).get()
  const userData = userDoc.exists ? userDoc.data() : {}
  const role = normalizeRole(userData?.rol || (decoded as { role?: unknown }).role)

  return {
    uid: decoded.uid,
    email: decoded.email || userData?.email || '',
    role,
    nombre: typeof userData?.nombre === 'string' ? userData.nombre : null,
  }
}

export function canApplyAssistantChanges(role: AssistantRole): boolean {
  return role === 'admin' || role === 'operador'
}

export function canApplySensitiveAssistantChanges(role: AssistantRole): boolean {
  return role === 'admin'
}
