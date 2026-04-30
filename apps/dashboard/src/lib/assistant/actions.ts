import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase-admin'
import type { AssistantOperation, AssistantOrigin, AssistantPlan, AssistantRunStatus, AssistantUser } from './types'

const SERVICIOS = ['lena', 'cerco', 'pergola', 'fogonero', 'bancos', 'madera'] as const
const SERVICIO_LABELS: Record<string, string> = {
  lena: 'Leña',
  cerco: 'Cercos',
  pergola: 'Pérgolas',
  fogonero: 'Sector Fogonero',
  bancos: 'Bancos',
  madera: 'Madera',
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function detectService(message: string): string | null {
  const normalized = normalizeText(message)
  if (/\blena|leña|kg|tonelada/.test(normalized)) return 'lena'
  if (/\bcerco|cercos|metro lineal/.test(normalized)) return 'cerco'
  if (/\bpergola|pergolas|pergolado/.test(normalized)) return 'pergola'
  if (/\bfogonero|fogatero/.test(normalized)) return 'fogonero'
  if (/\bbanco|bancos/.test(normalized)) return 'bancos'
  if (/\bmadera|maderas/.test(normalized)) return 'madera'
  return null
}

function extractMoney(message: string): number | null {
  const matches = [...message.matchAll(/(?:\$|\bprecio\b|\ba\b)\s*([0-9][0-9.,]{2,})/gi)]
  const raw = matches.at(-1)?.[1]
  if (!raw) return null
  const value = Number(raw.replace(/\./g, '').replace(/,/g, '.'))
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

function todayAr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Cordoba' }).format(new Date())
}

function slug(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || 'cambio'
}

function shortId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function targetWords(message: string): string[] {
  return normalizeText(message)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['precio', 'servicio', 'cambiar', 'actualizar', 'poner', 'para'].includes(w))
}

async function buildServicePriceOperation(message: string, serviceId: string, price: number): Promise<AssistantOperation | null> {
  const db = getAdminDb()
  const snap = await db.doc(`servicios/${serviceId}`).get()
  const current = snap.exists ? snap.data() : null
  const precios = Array.isArray(current?.precios) ? current.precios as Array<Record<string, unknown>> : []
  if (!precios.length) return null

  const words = targetWords(message)
  let index = precios.findIndex((item) => {
    const desc = normalizeText(String(item.descripcion || ''))
    return words.some((word) => desc.includes(word))
  })
  if (index < 0 && precios.length === 1) index = 0
  if (index < 0) return null

  const nextPrecios = precios.map((item, i) => i === index ? { ...item, precio: price } : item)
  return {
    id: shortId('op_precio'),
    type: 'updateServicePrice',
    target: `servicios/${serviceId}`,
    path: `servicios/${serviceId}`,
    description: `Actualizar precio de ${SERVICIO_LABELS[serviceId] || serviceId}: "${String(precios[index].descripcion || 'item')}" a $${price}.`,
    data: { serviceId, priceIndex: index, precio: price },
    before: current,
    after: { ...(current || {}), precios: nextPrecios },
    requiresBotReload: true,
    requiresDeploy: true,
  }
}

async function buildOperations(message: string): Promise<{ operations: AssistantOperation[]; warnings: string[] }> {
  const normalized = normalizeText(message)
  const operations: AssistantOperation[] = []
  const warnings: string[] = []
  const serviceId = detectService(message)
  const money = extractMoney(message)

  if (/\b(apagar|desactivar|silenciar)\b.*\b(vicky|bot|whatsapp)\b/.test(normalized)) {
    operations.push({
      id: shortId('op_general'),
      type: 'mergeDoc',
      target: 'config/general',
      path: 'config/general',
      description: 'Desactivar Vicky globalmente desde config/general.',
      data: { botActivo: false },
      after: { botActivo: false },
      requiresBotReload: true,
    })
  }

  if (/\b(activar|encender|prender)\b.*\b(vicky|bot|whatsapp)\b/.test(normalized)) {
    operations.push({
      id: shortId('op_general'),
      type: 'mergeDoc',
      target: 'config/general',
      path: 'config/general',
      description: 'Activar Vicky globalmente desde config/general.',
      data: { botActivo: true },
      after: { botActivo: true },
      requiresBotReload: true,
    })
  }

  const delayMatch = normalized.match(/delay|minimo|min(?:\s|_)?seg|max(?:imo)?/)
  const numbers = [...message.matchAll(/\b([0-9]{1,3})\b/g)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n))
  if (delayMatch && numbers.length >= 2) {
    const delayMinSeg = Math.min(numbers[0], numbers[1])
    const delayMaxSeg = Math.max(numbers[0], numbers[1])
    operations.push({
      id: shortId('op_delay'),
      type: 'mergeDoc',
      target: 'config/general',
      path: 'config/general',
      description: `Ajustar delay de respuesta a ${delayMinSeg}-${delayMaxSeg} segundos.`,
      data: { delayMinSeg, delayMaxSeg },
      after: { delayMinSeg, delayMaxSeg },
      requiresBotReload: true,
    })
  }

  if (serviceId && money && /\b(precio|sale|vale|aument|bajar|subir|actualiz|poner)\b/.test(normalized)) {
    const op = await buildServicePriceOperation(message, serviceId, money)
    if (op) operations.push(op)
    else warnings.push(`No pude identificar con seguridad qué item de ${SERVICIO_LABELS[serviceId]} cambiar; pedí descripción y precio exacto.`)
  }

  if (/\b(no ofrecer|no vender|restriccion|restricción|prohibir)\b/.test(normalized)) {
    const item = {
      id: `restriccion_${slug(message)}_${Date.now()}`,
      estado: 'vigente',
      textoParaVicky: message.trim(),
      origen: 'assistant',
    }
    operations.push({
      id: shortId('op_restriccion'),
      type: 'appendRestriction',
      target: 'config/promociones',
      path: 'config/promociones',
      description: 'Agregar restricción operativa para que Vicky la respete.',
      data: { item },
      after: { restricciones: [item] },
      requiresBotReload: true,
      requiresDeploy: true,
    })
  } else if (/\b(promo|promocion|promoción|descuento|oferta)\b/.test(normalized)) {
    const item = {
      id: `promo_${slug(message)}_${Date.now()}`,
      servicioId: serviceId || 'lena',
      titulo: message.trim().slice(0, 90),
      estado: 'requiere_confirmacion_humana',
      desde: todayAr(),
      hasta: '',
      textoParaVicky: message.trim(),
      reglas: ['Creada por el asistente; revisar vigencia y precio antes de activar masivamente.'],
      preciosPromocionales: [],
      origen: 'assistant',
    }
    operations.push({
      id: shortId('op_promo'),
      type: 'appendPromotion',
      target: 'config/promociones',
      path: 'config/promociones',
      description: `Agregar promoción pendiente de revisión para ${SERVICIO_LABELS[item.servicioId] || item.servicioId}.`,
      data: { item },
      after: { promociones: [item] },
      requiresBotReload: true,
      requiresDeploy: true,
    })
  }

  if (/\b(prompt|instruccion|instrucción|comportamiento|vicky debe|vicky no debe)\b/.test(normalized)) {
    const instruction = message.trim()
    operations.push({
      id: shortId('op_prompt'),
      type: 'appendPromptInstruction',
      target: 'config/prompts',
      path: 'config/prompts',
      description: 'Agregar instrucción al system prompt de Vicky y guardar versión previa.',
      data: { instruction },
      after: { appendInstruction: instruction },
      requiresBotReload: true,
      requiresDeploy: true,
    })
  }

  const telMatch = message.match(/\b(\+?54?9?\d{8,13})\b/)
  if (/\b(cliente|crm)\b/.test(normalized) && telMatch) {
    const tel = telMatch[1].replace(/\D/g, '')
    operations.push({
      id: shortId('op_cliente'),
      type: 'mergeDoc',
      target: `clientes/${tel}`,
      path: `clientes/${tel}`,
      description: `Agregar nota asistida al cliente ${tel}.`,
      data: { notaAsistente: message.trim(), actualizadoPorAsistente: true },
      after: { notaAsistente: message.trim(), actualizadoPorAsistente: true },
    })
  }

  if (/\b(agenda|entrega|programar)\b/.test(normalized)) {
    const fecha = message.match(/\b(20[0-9]{2}-[0-9]{2}-[0-9]{2})\b/)?.[1] || todayAr()
    operations.push({
      id: shortId('op_agenda'),
      type: 'createDoc',
      target: 'entregas_agenda',
      path: `entregas_agenda/${shortId('asistente_entrega')}`,
      description: `Crear borrador de agenda de entrega para ${fecha}.`,
      data: {
        fechaDia: fecha,
        titulo: message.trim().slice(0, 180),
        estado: 'pendiente',
        origen: 'assistant',
      },
      requiresBotReload: false,
    })
  }

  if (/\b(zona|ruta|logistica|logística)\b/.test(normalized)) {
    operations.push({
      id: shortId('op_logistica'),
      type: 'createDoc',
      target: 'consultasLena',
      path: `consultasLena/${shortId('asistente_logistica')}`,
      description: 'Crear consulta logística para revisar desde el panel.',
      data: {
        texto: message.trim(),
        estado: 'pendiente',
        origen: 'assistant',
      },
    })
  }

  if (!operations.length) {
    warnings.push('Necesito más detalle para aplicar un cambio seguro. Indicá pantalla/área, valor actual si lo sabés y valor nuevo.')
  }

  return { operations, warnings }
}

export async function createAssistantPlan(params: {
  message: string
  origin: AssistantOrigin
  user: AssistantUser
}): Promise<AssistantPlan> {
  const db = getAdminDb()
  const message = params.message.trim()
  const runRef = db.collection('assistant_runs').doc()
  const { operations, warnings } = await buildOperations(message)
  const status = operations.length ? 'planned' : 'needs_more_detail'
  const reply = operations.length
    ? `Preparé ${operations.length} cambio(s). Revisá el resumen y confirmá para aplicarlos.`
    : warnings[0]

  const runPayload = {
    id: runRef.id,
    message,
    origin: params.origin,
    user: params.user,
    status,
    operations,
    warnings,
    requiresConfirmation: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
  await runRef.set(runPayload)
  await db.collection('change_requests').doc(runRef.id).set({
    runId: runRef.id,
    message,
    origin: params.origin,
    status,
    operationCount: operations.length,
    createdBy: params.user,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return {
    runId: runRef.id,
    reply,
    status,
    operations,
    warnings,
    requiresConfirmation: true,
  }
}

function assertOperationData(op: AssistantOperation): Record<string, unknown> {
  if (!op.data || typeof op.data !== 'object') throw new Error(`Operación sin data: ${op.id}`)
  return op.data
}

async function applyOperation(op: AssistantOperation): Promise<{ before: unknown; after: unknown }> {
  const db = getAdminDb()
  const ref = db.doc(op.path)
  const beforeSnap = await ref.get()
  const before = beforeSnap.exists ? beforeSnap.data() || null : null

  if (op.type === 'mergeDoc') {
    const data = assertOperationData(op)
    await ref.set({ ...data, ultimaActualizacion: FieldValue.serverTimestamp() }, { merge: true })
  } else if (op.type === 'setDoc') {
    const data = assertOperationData(op)
    await ref.set({ ...data, ultimaActualizacion: FieldValue.serverTimestamp() })
  } else if (op.type === 'createDoc') {
    const data = assertOperationData(op)
    await ref.set({ ...data, creadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp() }, { merge: false })
  } else if (op.type === 'appendPromotion' || op.type === 'appendRestriction') {
    const data = assertOperationData(op)
    const current = before && typeof before === 'object' ? before as Record<string, unknown> : {}
    const key = op.type === 'appendPromotion' ? 'promociones' : 'restricciones'
    const list = Array.isArray(current[key]) ? current[key] as unknown[] : []
    await ref.set({ [key]: [...list, data.item], actualizadoEn: FieldValue.serverTimestamp() }, { merge: true })
  } else if (op.type === 'appendPromptInstruction') {
    const data = assertOperationData(op)
    const instruction = String(data.instruction || '').trim()
    if (!instruction) throw new Error('Instrucción vacía')
    const current = before && typeof before === 'object' ? before as Record<string, unknown> : {}
    const currentVersion = Number(current.version || 0)
    await ref.collection('versiones').doc(`v${currentVersion}`).set({
      ...current,
      version: currentVersion,
      fecha: FieldValue.serverTimestamp(),
      origen: 'assistant_before_change',
    })
    const currentPrompt = String(current.sistemaPrompt || '')
    const suffix = `\n\n[INSTRUCCION_ASISTENTE ${new Date().toISOString()}]\n${instruction}`
    await ref.set({
      ...current,
      sistemaPrompt: `${currentPrompt}${suffix}`,
      version: currentVersion + 1,
      ultimaActualizacion: FieldValue.serverTimestamp(),
      recargarBotAt: FieldValue.serverTimestamp(),
    }, { merge: false })
  } else if (op.type === 'updateServicePrice') {
    const data = assertOperationData(op)
    const current = before && typeof before === 'object' ? before as Record<string, unknown> : {}
    const precios = Array.isArray(current.precios) ? current.precios as Array<Record<string, unknown>> : []
    const priceIndex = Number(data.priceIndex)
    if (!Number.isInteger(priceIndex) || priceIndex < 0 || priceIndex >= precios.length) {
      throw new Error('Indice de precio inválido')
    }
    const precio = Number(data.precio)
    if (!Number.isFinite(precio) || precio <= 0) throw new Error('Precio inválido')
    const nextPrecios = precios.map((item, i) => i === priceIndex ? { ...item, precio } : item)
    await ref.set({
      ...current,
      precios: nextPrecios,
      ultimaActualizacion: FieldValue.serverTimestamp(),
      recargarBotAt: FieldValue.serverTimestamp(),
    }, { merge: false })
  } else {
    throw new Error(`Tipo de operación no soportado: ${op.type}`)
  }

  const afterSnap = await ref.get()
  return { before, after: afterSnap.exists ? afterSnap.data() || null : null }
}

async function postJson(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`${response.status} ${text.slice(0, 200)}`)
  }
}

async function triggerPostApplySync(runId: string, operations: AssistantOperation[]) {
  const sync: Record<string, string> = {
    firestore: 'applied',
    git: 'not_configured',
    firebase: 'not_required',
    cloudRun: operations.some((op) => op.requiresDeploy) ? 'pending_deploy' : 'not_required',
    botReload: operations.some((op) => op.requiresBotReload) ? 'pending' : 'not_required',
  }

  const reloadUrl = process.env.VICKY_BOT_INTERNAL_RELOAD_URL
  const reloadSecret = process.env.VICKY_CRON_SECRET || process.env.VICKY_BOT_INTERNAL_RELOAD_SECRET
  if (reloadUrl && reloadSecret && operations.some((op) => op.requiresBotReload)) {
    try {
      await postJson(reloadUrl, { runId, source: 'dashboard_assistant' }, { Authorization: `Bearer ${reloadSecret}` })
      sync.botReload = 'triggered'
    } catch (error) {
      sync.botReload = `failed:${error instanceof Error ? error.message : String(error)}`
    }
  }

  const repoParts = String(process.env.GITHUB_REPOSITORY || '').split('/')
  const ghOwner = process.env.GITHUB_REPOSITORY_OWNER || repoParts[0]
  const ghRepo = process.env.GITHUB_REPOSITORY_NAME || repoParts[1]
  const ghToken = process.env.GITHUB_ACTIONS_DISPATCH_TOKEN
  const workflow = process.env.GITHUB_ASSISTANT_SYNC_WORKFLOW || 'assistant-sync.yml'
  if (ghOwner && ghRepo && ghToken && operations.some((op) => op.requiresDeploy)) {
    try {
      await postJson(
        `https://api.github.com/repos/${ghOwner}/${ghRepo}/actions/workflows/${workflow}/dispatches`,
        { ref: process.env.GITHUB_ASSISTANT_SYNC_REF || 'main', inputs: { run_id: runId } },
        {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        }
      )
      sync.git = 'dispatch_triggered'
      sync.cloudRun = 'dispatch_triggered'
    } catch (error) {
      sync.git = `dispatch_failed:${error instanceof Error ? error.message : String(error)}`
      sync.cloudRun = 'pending_deploy'
    }
  }

  return sync
}

export async function applyAssistantRun(runId: string, user: AssistantUser): Promise<{ status: AssistantRunStatus; applied: number }> {
  const db = getAdminDb()
  const runRef = db.collection('assistant_runs').doc(runId)
  const runSnap = await runRef.get()
  if (!runSnap.exists) throw new Error('RUN_NOT_FOUND')
  const run = runSnap.data() || {}
  if (run.status !== 'planned') throw new Error('RUN_NOT_PLANNED')

  const operations = Array.isArray(run.operations) ? run.operations as AssistantOperation[] : []
  await runRef.set({ status: 'applying', updatedAt: FieldValue.serverTimestamp(), appliedBy: user }, { merge: true })

  try {
    for (const op of operations) {
      const result = await applyOperation(op)
      await db.collection('assistant_changes').doc(op.id).set({
        runId,
        operation: op,
        before: result.before,
        after: result.after,
        appliedBy: user,
        appliedAt: FieldValue.serverTimestamp(),
        rollbackStatus: 'available',
      })
    }
    if (operations.some((op) => op.requiresBotReload)) {
      await db.doc('config/general').set({
        recargarBotAt: FieldValue.serverTimestamp(),
        recargarBotMotivo: `assistant_run:${runId}`,
      }, { merge: true })
    }
    const sync = await triggerPostApplySync(runId, operations)
    await runRef.set({
      status: 'applied',
      appliedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      appliedBy: user,
      sync,
    }, { merge: true })
    await db.collection('change_requests').doc(runId).set({
      status: 'applied',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return { status: 'applied', applied: operations.length }
  } catch (error) {
    await runRef.set({
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    throw error
  }
}

export async function rollbackAssistantRun(runId: string, user: AssistantUser): Promise<{ status: AssistantRunStatus; rolledBack: number }> {
  const db = getAdminDb()
  const runRef = db.collection('assistant_runs').doc(runId)
  const runSnap = await runRef.get()
  if (!runSnap.exists) throw new Error('RUN_NOT_FOUND')
  const run = runSnap.data() || {}
  if (run.status !== 'applied') throw new Error('RUN_NOT_APPLIED')

  const operations = Array.isArray(run.operations) ? run.operations as AssistantOperation[] : []
  let rolledBack = 0
  for (const op of [...operations].reverse()) {
    const changeRef = db.collection('assistant_changes').doc(op.id)
    const changeSnap = await changeRef.get()
    if (!changeSnap.exists) continue
    const change = changeSnap.data() || {}
    const ref = db.doc(op.path)
    if (change.before == null) {
      await ref.delete()
    } else {
      await ref.set(change.before as Record<string, unknown>, { merge: false })
    }
    await changeRef.set({
      rollbackStatus: 'rolled_back',
      rolledBackBy: user,
      rolledBackAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    rolledBack += 1
  }

  await runRef.set({
    status: 'rolled_back',
    rolledBackBy: user,
    rolledBackAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  await db.collection('change_requests').doc(runId).set({
    status: 'rolled_back',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  if (operations.some((op) => op.requiresBotReload)) {
    await db.doc('config/general').set({
      recargarBotAt: FieldValue.serverTimestamp(),
      recargarBotMotivo: `assistant_rollback:${runId}`,
    }, { merge: true })
  }

  return { status: 'rolled_back', rolledBack }
}
