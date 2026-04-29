const admin = require('firebase-admin')

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'webgardens-8655d',
})

const db = admin.firestore()
const { FieldValue } = admin.firestore

const SYSTEM_PROMPT_ADMIN = `Sos el asistente interno de Vicky, el bot de Gardens Wood.
El dueno del negocio te manda instrucciones por audio o texto para enviarle un mensaje puntual a un cliente o para gestionar campanas permitidas del negocio.
Tu trabajo es interpretar la instruccion y devolver SOLO marcadores que el bot pueda ejecutar.

Marcadores permitidos:
1. [LISTAR_CLIENTES]
2. [ENVIAR_A:NombreONumero|mensaje para el cliente]
3. [ENVIAR_A:#N|mensaje para el cliente]
4. [ENVIAR_A:ULTIMO|mensaje para el cliente]
5. [ENVIAR_A:CAMPANA_TODOS|mensaje para clientes]
6. [ENVIAR_A:CAMPANA_LENA|mensaje para interesados en lena]
7. [ENVIAR_A:CAMPANA_CERCO|mensaje para interesados en cercos]
8. [ENVIAR_A:CAMPANA_PERGOLA|mensaje para interesados en pergolas]
9. [ENVIAR_A:CAMPANA_FOGONERO|mensaje para interesados en fogoneros]
10. [ENVIAR_A:CAMPANA_BANCOS|mensaje para interesados en bancos]

Reglas:
- Gardens Wood vende lena, cercos, pergolas, fogoneros, bancos y productos de madera.
- No uses ni menciones inmobiliaria, alquileres, tasaciones, ventas de propiedades ni administracion de consorcios.
- Si el destinatario es un numero, extraelo limpio, solo digitos.
- Si el admin dice "termina en" o "finalizado en", usa formato *XXXX.
- El mensaje debe sonar natural, calido y de parte de Vicky / Gardens Wood.
- Si la instruccion no es clara, responde exactamente: [ERROR:no entendi la instruccion, repetila mas claro]
- No agregues texto fuera de los marcadores.`

const CAMPANA_RUTA_PLANTILLA =
  'Hola {nombre}! Te escribo de Gardens Wood: {fechaTexto} vamos a estar por la zona *{zona}* con novedades sobre *{producto}*. Si queres mas info o queres aprovechar el viaje, respondeme este mensaje. - Vicky'

const SERVICIOS_INMOBILIARIA = ['administracion', 'alquiler', 'consultoria', 'tasacion', 'venta']

async function main() {
  const promptsRef = db.collection('config').doc('prompts')
  const promptsSnap = await promptsRef.get()
  const current = promptsSnap.exists ? promptsSnap.data() : {}
  const version = Number(current.version || 0) + 1

  await promptsRef.collection('versiones').doc(`v${version - 1}-backup-before-gardens-cleanup`).set(
    {
      ...current,
      version: version - 1,
      fecha: FieldValue.serverTimestamp(),
      motivo: 'backup antes de limpiar datos inmobiliarios heredados',
    },
    { merge: true },
  )

  await promptsRef.set(
    {
      sistemaPromptAdmin: SYSTEM_PROMPT_ADMIN,
      version,
      ultimaActualizacion: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  await db.collection('config').doc('general').set(
    {
      campanaRutaPlantilla: CAMPANA_RUTA_PLANTILLA,
      ultimaActualizacion: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  const batch = db.batch()
  for (const id of SERVICIOS_INMOBILIARIA) {
    batch.set(
      db.collection('servicios').doc(id),
      {
        activo: false,
        ocultoDashboard: true,
        noUsarEnVicky: true,
        notaOperacion: 'Servicio heredado de inmobiliaria. No usar en Gardens Wood / Vicky.',
        ultimaActualizacion: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }
  await batch.commit()

  console.log('Config Gardens Wood limpia en Firestore.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
