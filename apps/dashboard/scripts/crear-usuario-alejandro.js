/**
 * Script one-shot para crear usuario alejandro@alenia.online como admin.
 * Ejecutar UNA sola vez desde la carpeta apps/dashboard/:
 *
 *   node scripts/crear-usuario-alejandro.js
 *
 * Requiere .env.local con FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const EMAIL = 'alejandro@alenia.online'
const PASSWORD = 'admin123'
const NOMBRE = 'Alejandro'

async function main() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Faltan variables de entorno. Completá .env.local primero.')
    process.exit(1)
  }

  const admin = require('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    })
  }

  try {
    const userRecord = await admin.auth().createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: NOMBRE,
    })

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' })

    await admin.firestore().collection('usuarios').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: EMAIL,
      nombre: NOMBRE,
      rol: 'admin',
      activo: true,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log('✅ Usuario creado:')
    console.log(`   Email: ${EMAIL}`)
    console.log(`   UID:   ${userRecord.uid}`)
    console.log(`   Rol:   admin`)
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      console.error('⚠️  El usuario ya existe. Podés resetear la contraseña desde Firebase Console.')
    } else {
      console.error('❌ Error:', err.message)
    }
  } finally {
    process.exit(0)
  }
}

main()
