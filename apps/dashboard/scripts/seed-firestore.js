/**
 * seed-firestore.js
 * ──────────────────────────────────────────────────────────────────
 * Inicializa Firestore con toda la configuración real del bot Vicky:
 *   • config/general    → delays, modelo, flags
 *   • config/prompts    → sistemaPrompt = SYSTEM_PROMPT de Bot_WhatsApp_Lena/bot.js
 *   • servicios/{id}    → precios reales de cada servicio
 *
 * USO:
 *   node scripts/seed-firestore.js
 *
 * Requiere .env.local con las credenciales de Firebase Admin.
 * Si un documento ya existe, lo ACTUALIZA (no sobreescribe clientes ni chats).
 * ──────────────────────────────────────────────────────────────────
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

/** systemPrompt en Firestore = mismo texto que `SYSTEM_PROMPT` en apps/bot/bot.js */
function loadSystemPromptFromBot() {
  const botPath = path.join(__dirname, '..', '..', 'bot', 'bot.js')
  if (!fs.existsSync(botPath)) {
    throw new Error(`No se encontró bot.js en ${botPath}`)
  }
  const raw = fs.readFileSync(botPath, 'utf8')
  const m = raw.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;\s*\r?\n\r?\n\/\/ --- SESIONES/)
  if (!m) throw new Error('No se pudo extraer SYSTEM_PROMPT de bot.js (¿cambió el archivo?)')
  return m[1]
}

async function main() {
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Faltan variables de entorno en .env.local')
    console.error('   Necesitás: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY')
    process.exit(1)
  }

  const admin = require('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) })
  }
  const db = admin.firestore()
  const FieldValue = admin.firestore.FieldValue

  console.log('\n🌱 Iniciando seed de Firestore para Gardens Wood...\n')

  // ──────────────────────────────────────────────────────────────
  // 1. CONFIG GENERAL
  // ──────────────────────────────────────────────────────────────
  await db.collection('config').doc('general').set({
    delayMinSeg: 26,
    delayMaxSeg: 34,
    modeloGemini: 'gemini-3.1-flash-lite-preview',
    frecuenciaAudioFidelizacion: 0,
    tiempoSilencioHumanoHoras: 24,
    botActivo: true,
    adminPhone: '',
    horaAtencionDesde: '09:00',
    horaAtencionHasta: '18:00',
    whatsappAtencionCliente: '3515576639',
    datosEntregaNotifyPhone: '5493512956376',
    whatsappGrupoJidAgendaEntregas: '',
    notificarAgendaEntregasGrupoActivo: true,
    campanaDelayMinSeg: 15,
    campanaDelayMaxSeg: 20,
    campanaMaxDestinatarios: 40,
    campanaDescuentoPct: 10,
    campanaRutaFechaTexto: 'esta semana',
    campanaRutaPlantilla: 'Hola {nombre}! Te escribo de Gardens Wood: {fechaTexto} tenemos novedades en *{zona}* sobre *{producto}*. Si querés más info, respondeme este mensaje.',
    ultimaActualizacion: FieldValue.serverTimestamp(),
  }, { merge: true })
  console.log('✅ config/general → OK')

  // ──────────────────────────────────────────────────────────────
  // 2. SYSTEM PROMPT COMPLETO (fuente: Bot_WhatsApp_Lena/bot.js)
  // ──────────────────────────────────────────────────────────────
  const SYSTEM_PROMPT = loadSystemPromptFromBot()

  const SYSTEM_PROMPT_ADMIN = `Sos el asistente interno de Vicky, el bot de Gardens Wood.
El dueño del negocio te manda instrucciones por audio o texto para enviarle un mensaje puntual a un cliente.
Tu trabajo es interpretar la instrucción y extraer:
1. El nombre del cliente destinatario
2. El mensaje exacto que hay que enviarle (redactado de forma natural, como si lo escribiera Vicky)

Respondé SIEMPRE con este formato exacto, sin texto adicional:
[ENVIAR_A:NombreONumero|mensaje para el cliente]

Donde NombreONumero puede ser:
- El nombre del cliente: "Juan", "María García"
- Un número completo: "3512956376"
- Los ÚLTIMOS 4 dígitos: "*XXXX"

Reglas:
- Si el destinatario es un número, extraelo limpio (solo dígitos).
- Si el admin dice "termina en", "finalizado en" → usá formato *XXXX.
- El mensaje debe sonar natural, cálido, de parte de Gardens Wood.
- Si la instrucción no es clara: [ERROR:no entendí la instrucción, repetila más claro]
- Si hay múltiples destinatarios, generá un [ENVIAR_A:...] por cada uno.`

  const currentSnap = await db.collection('config').doc('prompts').get()
  const currentVersion = currentSnap.exists ? (currentSnap.data().version || 0) : 0

  await db.collection('config').doc('prompts').set({
    sistemaPrompt: SYSTEM_PROMPT,
    sistemaPromptAdmin: SYSTEM_PROMPT_ADMIN,
    mensajeBienvenidaTexto: '¿En qué te puedo ayudar? Escribime porfa que me es más fácil responder 😊',
    version: currentVersion + 1,
    ultimaActualizacion: FieldValue.serverTimestamp(),
  }, { merge: true })
  console.log('✅ config/prompts → OK (versión ' + (currentVersion + 1) + ')')

  // ──────────────────────────────────────────────────────────────
  // 3. SERVICIOS CON PRECIOS REALES
  // ──────────────────────────────────────────────────────────────
  const servicios = [
    {
      id: 'lena',
      nombre: 'Leña',
      activo: true,
      tieneEnvio: true,
      marcador: '[IMG:lena]',
      infoEnvio: 'Villa Allende: envío sin cargo desde 200 kg. Mendiolaza: envío sin cargo comprando 1 tonelada; para menos cantidad, flete de referencia $40.000. Unquillo, Río Ceballos y zonas de distancia similar hasta 35 km: flete de referencia $50.000, con pedido mínimo sugerido de 300 kg. Otras zonas: cotizar según ubicación exacta.',
      descripcion: 'Leña de Quebracho Blanco y Colorado, mezcla versátil para hogar, salamandra y parrilla. Precio por tonelada (1000 kg).',
      precios: [
        { descripcion: 'Hogar / Grande', precio: 290000, unidad: 'tonelada' },
        { descripcion: 'Salamandra / Mediana', precio: 300000, unidad: 'tonelada' },
        { descripcion: 'Parrilla / Fino (Quebracho Blanco)', precio: 320000, unidad: 'tonelada' },
      ],
    },
    {
      id: 'cerco',
      nombre: 'Cercos de madera',
      activo: true,
      tieneEnvio: false,
      marcador: '[IMG:cerco]',
      descripcion: 'Eucalipto Impregnado CCA (más de 15 años sin mantenimiento). Material + mano de obra. Seña: $200.000 a $300.000. Saldo en efectivo al finalizar.',
      precios: [
        { descripcion: '1.80m de alto', precio: 140000, unidad: 'metro lineal' },
        { descripcion: '2.00m a 2.50m de alto', precio: 170000, unidad: 'metro lineal' },
        { descripcion: 'Hasta 3.00m de alto (medida especial)', precio: 185000, unidad: 'metro lineal' },
        { descripcion: 'Revestimiento con palo fino', precio: 150000, unidad: 'metro lineal' },
      ],
    },
    {
      id: 'pergola',
      nombre: 'Pérgolas',
      activo: true,
      tieneEnvio: false,
      marcador: '[IMG:pergola]',
      descripcion: 'Material + mano de obra por metro cuadrado. Flete sin cargo en zonas cercanas a Villa Allende.',
      precios: [
        { descripcion: 'Caña Tacuara', precio: 110000, unidad: 'm²' },
        { descripcion: 'Caña Tacuara + Chapa Policarbonato', precio: 130000, unidad: 'm²' },
        { descripcion: 'Palos Pergoleros eucalipto CCA', precio: 130000, unidad: 'm²' },
        { descripcion: 'Palos Pergoleros + Policarbonato', precio: 150000, unidad: 'm²' },
      ],
    },
    {
      id: 'fogonero',
      nombre: 'Sector Fogonero',
      activo: true,
      tieneEnvio: false,
      marcador: '[IMG:fogonero]',
      descripcion: 'Incluye Geotextil + Piedra blanca. Precio por metro cuadrado.',
      precios: [
        { descripcion: 'Base (Geotextil + Piedra blanca)', precio: 57000, unidad: 'm²' },
      ],
    },
    {
      id: 'bancos',
      nombre: 'Bancos de Quebracho Blanco',
      activo: true,
      tieneEnvio: false,
      marcador: '[IMG:bancos]',
      descripcion: 'Quebracho Blanco macizo con respaldo. 60cm de profundidad × el largo deseado (máx 2.70m). Material + mano de obra.',
      precios: [
        { descripcion: 'Banco con respaldo (Quebracho Blanco)', precio: 355000, unidad: 'metro lineal' },
      ],
    },
    {
      id: 'madera',
      nombre: 'Productos de madera',
      activo: true,
      tieneEnvio: true,
      marcador: '',
      infoEnvio: 'Pedidos de 1 unidad en Villa Allende: $20.000. Otros casos se cotiza.',
      descripcion: 'Venta por unidad/metro. Todos los precios son + IVA. Retiro en local o envío a domicilio.',
      precios: [
        // Tablas QC
        { descripcion: 'Tabla QC 2,54×12,7cm × 2m', precio: 10574.85, unidad: 'unidad' },
        { descripcion: 'Tabla QC 2,54×12,7cm × 2,7m', precio: 14273.84, unidad: 'unidad' },
        { descripcion: 'Tabla QC 2,54×12,7cm × 3m', precio: 15859.52, unidad: 'unidad' },
        { descripcion: 'Tabla QC 2,54×15,24cm × 2m', precio: 12690.93, unidad: 'unidad' },
        { descripcion: 'Tabla QC 2,54×15,24cm × 2,7m', precio: 17133.03, unidad: 'unidad' },
        { descripcion: 'Tabla QC 2,54×15,24cm × 3m', precio: 19036.39, unidad: 'unidad' },
        { descripcion: 'Tabla QC 2,54×20,32cm × 2m', precio: 16920.32, unidad: 'unidad' },
        { descripcion: 'Tabla QC 2,54×20,32cm × 2,7m', precio: 22840.35, unidad: 'unidad' },
        { descripcion: 'Tabla QC 2,54×20,32cm × 3m', precio: 25381.85, unidad: 'unidad' },
        // Tirantes QC
        { descripcion: 'Tirante QC 5,08×10,16cm × 2,7m', precio: 22840.35, unidad: 'unidad' },
        { descripcion: 'Tirante QC 5,08×10,16cm × 3m', precio: 25381.85, unidad: 'unidad' },
        { descripcion: 'Tirante QC 5,08×15,24cm × 2,7m', precio: 34260.53, unidad: 'unidad' },
        // Tablones
        { descripcion: 'Tablón QC 3,81×22,86cm × 1m', precio: 14273.84, unidad: 'unidad' },
        { descripcion: 'Tablón QC 3,81×22,86cm × 0,5m', precio: 7138.30, unidad: 'unidad' },
        { descripcion: 'Tablón QC 2,7m', precio: 154700, unidad: 'unidad' },
        { descripcion: 'Tablón QB 2,7m', precio: 91162.50, unidad: 'unidad' },
        { descripcion: 'Tablón QB 1,5m', precio: 52487.50, unidad: 'unidad' },
        { descripcion: 'Tablón para barras QC', precio: 247000, unidad: 'metro lineal' },
        // Durmientes
        { descripcion: 'Durmiente QC 12,7×25,4cm × 2,7m', precio: 104975, unidad: 'unidad' },
        { descripcion: 'Durmiente QC 12,7×25,4cm × 2m', precio: 69062.50, unidad: 'unidad' },
        { descripcion: 'Durmiente QC 2da 12,7×25,4cm × 2,7m', precio: 91000, unidad: 'unidad' },
        { descripcion: 'Durmiente QB 10,16×20,32cm × 2,7m', precio: 110500, unidad: 'unidad' },
        { descripcion: 'Durmiente QB 10,16×20,32cm × 2m', precio: 81900, unidad: 'unidad' },
        { descripcion: 'Durmiente QB 10,16×20,32cm × 1,5m', precio: 57980, unidad: 'unidad' },
        { descripcion: 'Durmiente recuperado', precio: 84500, unidad: 'unidad' },
        // Postes QC
        { descripcion: 'Poste QC 7,62×7,62cm × 3m', precio: 28550.44, unidad: 'unidad' },
        { descripcion: 'Poste QC 7,62×7,62cm × 2,7m', precio: 25696.78, unidad: 'unidad' },
        { descripcion: 'Poste QC 7,62×7,62cm × 2,2m', precio: 20936.99, unidad: 'unidad' },
        { descripcion: 'Poste QC 7,62×7,62cm × 2m', precio: 18895.50, unidad: 'unidad' },
        { descripcion: 'Poste QC 10,16×10,16cm × 3m', precio: 50752.65, unidad: 'unidad' },
        { descripcion: 'Poste QC 10,16×10,16cm × 2,7m', precio: 45677.94, unidad: 'unidad' },
        { descripcion: 'Poste QC 10,16×10,16cm × 2,4m', precio: 40603.23, unidad: 'unidad' },
        { descripcion: 'Poste QC 10,16×10,16cm × 2,2m', precio: 37219.17, unidad: 'unidad' },
        { descripcion: 'Poste QC 10,16×10,16cm × 2m', precio: 33835.10, unidad: 'unidad' },
        { descripcion: 'Poste QC 3m', precio: 28161.90, unidad: 'unidad' },
        // Eucalipto
        { descripcion: 'Poste eucalipto 7,5m', precio: 101790, unidad: 'unidad' },
        { descripcion: 'Poste eucalipto 9m', precio: 113100, unidad: 'unidad' },
        { descripcion: 'Postecito eucalipto 2,5m', precio: 12874.55, unidad: 'unidad' },
        // Varillas
        { descripcion: 'Varilla QB 3,81×5,08cm × 1,2m', precio: 1519.38, unidad: 'unidad' },
        { descripcion: 'Varilla QC 3,81×5,08cm × 1,2m', precio: 2624.38, unidad: 'unidad' },
        // Vigas y tijeras
        { descripcion: 'Viga 12,7×40,64cm × 3,5m', precio: 226525, unidad: 'unidad' },
        { descripcion: 'Tijera eucalipto 4m', precio: 42836.63, unidad: 'unidad' },
        { descripcion: 'Tijera eucalipto 5m', precio: 50541.57, unidad: 'unidad' },
        { descripcion: 'Tijera eucalipto 6m', precio: 64938.25, unidad: 'unidad' },
        { descripcion: 'Tijera eucalipto 7m', precio: 77426.38, unidad: 'unidad' },
        // Tutores y boyeros
        { descripcion: 'Tutor eucalipto 3/5 — 2,5m', precio: 5655, unidad: 'unidad' },
        { descripcion: 'Tutor eucalipto 5/7 — 2,5m', precio: 6833.13, unidad: 'unidad' },
        { descripcion: 'Boyero 1,8m', precio: 9896.25, unidad: 'unidad' },
        // Otros
        { descripcion: 'Tranquera 2m', precio: 303875, unidad: 'unidad' },
        { descripcion: 'Tranquera 3m', precio: 497250, unidad: 'unidad' },
        { descripcion: 'Mesa de jardín 2m', precio: 511062.50, unidad: 'unidad' },
        { descripcion: 'Hamaca', precio: 635375, unidad: 'unidad' },
        { descripcion: 'Muelitas', precio: 52000, unidad: 'unidad' },
        { descripcion: 'Cañizo criollo', precio: 14300, unidad: 'm²' },
        { descripcion: 'Cañizo tacuara', precio: 11700, unidad: 'm²' },
        { descripcion: 'Costaneros (por carga)', precio: 13812.50, unidad: 'carga' },
      ],
    },
  ]

  for (const svc of servicios) {
    await db.collection('servicios').doc(svc.id).set({
      ...svc,
      ultimaActualizacion: FieldValue.serverTimestamp(),
    }, { merge: true })
    console.log(`✅ servicios/${svc.id} → ${svc.precios.length} precios`)
  }

  // ──────────────────────────────────────────────────────────────
  // 4. RESUMEN FINAL
  // ──────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed completado exitosamente!')
  console.log('   Colecciones creadas/actualizadas:')
  console.log('   • config/general')
  console.log('   • config/prompts')
  console.log('   • servicios/lena, cerco, pergola, fogonero, bancos, madera')
  console.log('\n   ℹ️  Próximos pasos:')
  console.log('   1. Desplegá las reglas: firebase deploy --only firestore:rules')
  console.log('   2. Desplegá los índices: firebase deploy --only firestore:indexes')
  console.log('   3. Creá el primer admin: npm run crear-admin')
  console.log('')
}

main().catch((err) => {
  console.error('❌ Error en seed:', err.message)
  process.exit(1)
})
