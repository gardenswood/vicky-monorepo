/**
 * Script para crear el primer usuario administrador del dashboard.
 * 
 * USO:
 *   node scripts/crear-admin.js
 * 
 * Requiere variables de entorno (o un archivo .env.local en la raíz del dashboard):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

async function main() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Faltan variables de entorno. Completá .env.local primero.')
    console.error('   Necesitás: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY')
    process.exit(1)
  }

  const admin = require('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    })
  }

  const readline = require('readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const question = (q) => new Promise((resolve) => rl.question(q, resolve))

  console.log('\n🌿 Crear usuario administrador del dashboard - Gardens Wood\n')

  const email = await question('Email del admin: ')
  const nombre = await question('Nombre completo: ')
  const password = await question('Contraseña (min 6 caracteres): ')

  if (!email || !nombre || password.length < 6) {
    console.error('❌ Datos incompletos o contraseña muy corta.')
    rl.close()
    process.exit(1)
  }

  try {
    // Crear en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
    })

    // Establecer custom claim de rol admin
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' })

    // Guardar en Firestore
    await admin.firestore().collection('usuarios').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      nombre,
      rol: 'admin',
      activo: true,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`\n✅ Usuario admin creado exitosamente:`)
    console.log(`   Email: ${email}`)
    console.log(`   Nombre: ${nombre}`)
    console.log(`   UID: ${userRecord.uid}`)
    console.log(`\n🚀 Ya podés hacer login en http://localhost:3000/login\n`)
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      console.error('❌ Ya existe un usuario con ese email.')
    } else {
      console.error('❌ Error:', err.message)
    }
  } finally {
    rl.close()
  }
}

main()
