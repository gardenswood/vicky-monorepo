import { getApps, initializeApp, cert, getApp, applicationDefault, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let adminApp: App | null = null

function getAdminApp(): App {
  if (adminApp) return adminApp

  if (getApps().find((a) => a.name === 'admin')) {
    adminApp = getApp('admin')
    return adminApp
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    adminApp = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'admin')
    return adminApp
  }

  // Fallback para desarrollo local: permite usar Application Default Credentials (gcloud auth application-default login)
  // o GOOGLE_APPLICATION_CREDENTIALS, sin necesidad de pegar una private key en .env.local.
  const inferredProjectId = projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!inferredProjectId) {
    throw new Error(
      'Firebase Admin: faltan FIREBASE_ADMIN_PROJECT_ID (o NEXT_PUBLIC_FIREBASE_PROJECT_ID) para inicializar con ADC'
    )
  }

  adminApp = initializeApp({ credential: applicationDefault(), projectId: inferredProjectId }, 'admin')
  return adminApp
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp())
}

// Backward-compat exports used in route handlers
export const adminAuth = {
  createSessionCookie: (...args: Parameters<Auth['createSessionCookie']>) =>
    getAdminAuth().createSessionCookie(...args),
  verifySessionCookie: (...args: Parameters<Auth['verifySessionCookie']>) =>
    getAdminAuth().verifySessionCookie(...args),
  createUser: (...args: Parameters<Auth['createUser']>) =>
    getAdminAuth().createUser(...args),
  setCustomUserClaims: (...args: Parameters<Auth['setCustomUserClaims']>) =>
    getAdminAuth().setCustomUserClaims(...args),
}

export const adminDb = {
  collection: (path: string) => getAdminDb().collection(path),
}
