'use client'
export const dynamic = 'force-dynamic'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { db } from '@/lib/firebase'
import { cn, formatRelative, getTelFromJid } from '@/lib/utils'
import type { ConsultaLena, ZonaSummary } from '@/types'

const ESTADOS_ACTIVOS: ConsultaLena['estado'][] = [
  'pendiente',
  'zona_lista',
  'admin_notificado',
  'confirmado',
]

const DEFAULT_TEMPLATE =
  'Hola {nombre}! Te aviso que estamos armando reparto de leña por {zona}. Si querés sumarte con envío gratis, respondeme este mensaje y lo coordinamos.'

const DEFAULT_FORM = {
  id: '',
  nombre: '',
  tel: '',
  zona: '',
  cantidadKg: '',
  notas: '',
}

type FormState = typeof DEFAULT_FORM

type ConfigLogistica = {
  umbralKg: number
  adminPhone: string
  plantillaCliente: string
  campanaDelayMinSeg: number
  campanaDelayMaxSeg: number
}

type ZonaEstado = ZonaSummary['estado']

const ZONA_ESTADO_CONFIG: Record<ZonaEstado, { label: string; color: string; bar: string }> = {
  normal: { label: 'Normal', color: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
  cerca: { label: 'Cerca del umbral', color: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-500' },
  lista: { label: 'Lista para envío', color: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
  admin_notificado: { label: 'Esperando confirmación', color: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' },
  confirmado: { label: 'Confirmado', color: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
  enviado: { label: 'Enviado', color: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-700' },
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function jidFromTel(tel: string): string {
  const digits = normalizeDigits(tel)
  return digits ? `${digits}@s.whatsapp.net` : ''
}

function telFromJid(jid: string): string {
  return getTelFromJid(jid)
}

function normalizeZonaKey(zona: string): string {
  return (zona || 'Sin zona')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate()
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return new Date()
}

function mapConsulta(id: string, data: Record<string, unknown>): ConsultaLena {
  const remoteJid = String(data.remoteJid ?? '')
  const tel = String(data.tel ?? telFromJid(remoteJid))
  return {
    id,
    remoteJid,
    tel,
    nombre: String(data.nombre ?? 'Sin nombre'),
    zona: String(data.zona ?? 'Sin zona'),
    cantidadKg: Number(data.cantidadKg ?? 0),
    notas: typeof data.notas === 'string' ? data.notas : undefined,
    fechaConsulta: toDate(data.fechaConsulta),
    estado: (data.estado as ConsultaLena['estado']) ?? 'pendiente',
  }
}

function estadoZona(consultas: ConsultaLena[], totalKg: number, umbralKg: number): ZonaEstado {
  if (consultas.some((c) => c.estado === 'confirmado')) return 'confirmado'
  if (consultas.some((c) => c.estado === 'admin_notificado')) return 'admin_notificado'
  if (consultas.some((c) => c.estado === 'zona_lista')) return 'lista'
  const pct = umbralKg > 0 ? totalKg / umbralKg : 0
  if (pct >= 0.85) return 'lista'
  if (pct >= 0.6) return 'cerca'
  return 'normal'
}

function reemplazarPlantilla(template: string, consulta: ConsultaLena, fechaTexto: string): string {
  return template
    .replace(/\{nombre\}/gi, consulta.nombre || '!')
    .replace(/\{zona\}/gi, consulta.zona)
    .replace(/\{kg\}/gi, String(consulta.cantidadKg))
    .replace(/\{fechaTexto\}/gi, fechaTexto)
}

function delayEscalonadoMs(index: number, minSeg: number, maxSeg: number): number {
  const minMs = Math.max(5000, minSeg * 1000)
  const maxMs = Math.max(minMs, maxSeg * 1000)
  const spread = maxMs - minMs
  return index * (minMs + Math.round(spread / 2))
}

export default function LogisticaZonasPage() {
  const [consultas, setConsultas] = useState<ConsultaLena[]>([])
  const [config, setConfig] = useState<ConfigLogistica>({
    umbralKg: 800,
    adminPhone: '',
    plantillaCliente: DEFAULT_TEMPLATE,
    campanaDelayMinSeg: 15,
    campanaDelayMaxSeg: 20,
  })
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [expandedZona, setExpandedZona] = useState<string | null>(null)
  const [userRole, setUserRole] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sendZona, setSendZona] = useState<ZonaSummary | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState(DEFAULT_TEMPLATE)
  const [fechaTexto, setFechaTexto] = useState('esta semana')

  useEffect(() => {
    fetch('/api/auth/verify')
      .then((r) => r.json())
      .then((data) => setUserRole(data.role ?? ''))
      .catch(() => setUserRole(''))
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'consultasLena'), where('estado', 'in', ESTADOS_ACTIVOS))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setConsultas(snap.docs.map((d) => mapConsulta(d.id, d.data())))
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setError('No se pudieron cargar las consultas de leña.')
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'general'), (snap) => {
      const data = snap.data() ?? {}
      const rawUmbral = Number(data.colaLenaUmbralClusterZonaKg)
      const rawMin = Number(data.campanaDelayMinSeg)
      const rawMax = Number(data.campanaDelayMaxSeg)
      setConfig({
        umbralKg: Number.isFinite(rawUmbral) && rawUmbral > 0 ? Math.round(rawUmbral) : 800,
        adminPhone: String(data.adminPhone ?? ''),
        plantillaCliente: String(data.colaLenaPlantillaWAClienteRutaArmada ?? '').trim() || DEFAULT_TEMPLATE,
        campanaDelayMinSeg: Number.isFinite(rawMin) && rawMin > 0 ? Math.round(rawMin) : 15,
        campanaDelayMaxSeg: Number.isFinite(rawMax) && rawMax > 0 ? Math.round(rawMax) : 20,
      })
    })
    return () => unsub()
  }, [])

  const zonas = useMemo<ZonaSummary[]>(() => {
    const buckets = new Map<string, { label: string; items: ConsultaLena[] }>()
    consultas.forEach((consulta) => {
      const zona = consulta.zona.trim() || 'Sin zona'
      const key = normalizeZonaKey(zona)
      const current = buckets.get(key)
      if (current) current.items.push(consulta)
      else buckets.set(key, { label: zona, items: [consulta] })
    })

    return [...buckets.values()]
      .map(({ label, items }) => {
        const totalKg = items.reduce((sum, item) => sum + item.cantidadKg, 0)
        return {
          zona: label,
          totalKg,
          cantidadConsultas: items.length,
          consultas: items.sort((a, b) => a.fechaConsulta.getTime() - b.fechaConsulta.getTime()),
          umbralKg: config.umbralKg,
          estado: estadoZona(items, totalKg, config.umbralKg),
        }
      })
      .sort((a, b) => b.totalKg - a.totalKg)
  }, [consultas, config.umbralKg])

  const zonasListas = zonas.filter((zona) => zona.estado === 'lista')
  const zonasExistentes = zonas.map((z) => z.zona).filter((zona) => zona !== 'Sin zona')
  const isAdmin = userRole === 'admin'

  function openNewForm(zona = '') {
    setForm({ ...DEFAULT_FORM, zona })
    setError(null)
    setFormOpen(true)
  }

  function openEditForm(consulta: ConsultaLena) {
    setForm({
      id: consulta.id,
      nombre: consulta.nombre,
      tel: consulta.tel,
      zona: consulta.zona,
      cantidadKg: String(consulta.cantidadKg),
      notas: consulta.notas ?? '',
    })
    setError(null)
    setFormOpen(true)
  }

  async function saveConsulta(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const tel = normalizeDigits(form.tel)
    const cantidadKg = Number(form.cantidadKg)
    const zona = form.zona.trim()
    const nombre = form.nombre.trim()

    if (!nombre || !tel || !zona || !Number.isFinite(cantidadKg) || cantidadKg < 1 || cantidadKg > 499) {
      setError('Completá nombre, teléfono, zona y una cantidad entre 1 y 499 kg.')
      setSaving(false)
      return
    }

    const payload = {
      remoteJid: jidFromTel(tel),
      tel,
      nombre,
      zona,
      cantidadKg: Math.round(cantidadKg),
      notas: form.notas.trim() || null,
      actualizadoEn: serverTimestamp(),
    }

    try {
      if (form.id) {
        await updateDoc(doc(db, 'consultasLena', form.id), payload)
        setMessage('Consulta actualizada.')
      } else {
        await addDoc(collection(db, 'consultasLena'), {
          ...payload,
          estado: 'pendiente',
          fechaConsulta: serverTimestamp(),
          creadoEn: serverTimestamp(),
          origen: 'dashboard',
        })
        setMessage('Consulta registrada.')
      }
      setFormOpen(false)
      setForm(DEFAULT_FORM)
    } catch (err) {
      console.error(err)
      setError('No se pudo guardar la consulta.')
    } finally {
      setSaving(false)
    }
  }

  async function eliminarConsulta(id: string) {
    if (!window.confirm('Eliminar esta consulta de leña?')) return
    await deleteDoc(doc(db, 'consultasLena', id))
    setMessage('Consulta eliminada.')
  }

  async function actualizarZona(zona: ZonaSummary, estado: ConsultaLena['estado'], extra: Record<string, unknown> = {}) {
    const batch = writeBatch(db)
    zona.consultas.forEach((consulta) => {
      batch.update(doc(db, 'consultasLena', consulta.id), {
        estado,
        actualizadoEn: serverTimestamp(),
        ...extra,
      })
    })
    await batch.commit()
  }

  async function notificarAdmin(zona: ZonaSummary) {
    setError(null)
    setMessage(null)
    const adminDigits = normalizeDigits(config.adminPhone)
    if (adminDigits.length < 10) {
      setError('Falta configurar adminPhone en Configuracion > General.')
      return
    }

    const dashboardUrl = typeof window !== 'undefined' ? `${window.location.origin}/logistica-zonas` : '/logistica-zonas'
    const texto =
      `Zona ${zona.zona}: ${zona.totalKg}kg en ${zona.cantidadConsultas} consultas. Confirmas el reparto?\n` +
      `Confirmalo en el panel: ${dashboardUrl}`

    const batch = writeBatch(db)
    zona.consultas.forEach((consulta) => {
      batch.update(doc(db, 'consultasLena', consulta.id), {
        estado: 'admin_notificado',
        fechaNotificacionAdmin: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })
    })
    batch.set(doc(collection(db, 'mensajes_programados')), {
      jid: `${adminDigits}@s.whatsapp.net`,
      texto,
      runAt: Timestamp.fromDate(new Date()),
      estado: 'pendiente',
      origen: 'dashboard_logistica_zonas_admin',
      creadoEn: serverTimestamp(),
    })
    await batch.commit()
    setMessage(`Aviso al admin programado para ${zona.zona}.`)
  }

  async function confirmarZona(zona: ZonaSummary) {
    await actualizarZona(zona, 'confirmado', { fechaConfirmacion: serverTimestamp() })
    setMessage(`Zona ${zona.zona} confirmada.`)
  }

  function openSendModal(zona: ZonaSummary) {
    setSendZona(zona)
    setPreviewTemplate(config.plantillaCliente)
    setFechaTexto('esta semana')
    setError(null)
    setMessage(null)
  }

  async function enviarMensajesClientes() {
    if (!sendZona) return
    const batch = writeBatch(db)
    const now = Date.now()

    sendZona.consultas.forEach((consulta, index) => {
      const ref = doc(collection(db, 'mensajes_programados'))
      const runAtMs = now + delayEscalonadoMs(index, config.campanaDelayMinSeg, config.campanaDelayMaxSeg)
      batch.set(ref, {
        jid: consulta.remoteJid || jidFromTel(consulta.tel),
        texto: reemplazarPlantilla(previewTemplate, consulta, fechaTexto),
        runAt: Timestamp.fromMillis(runAtMs),
        estado: 'pendiente',
        origen: 'dashboard_logistica_zonas_clientes',
        creadoEn: serverTimestamp(),
      })
      batch.update(doc(db, 'consultasLena', consulta.id), {
        estado: 'enviado',
        fechaEnvio: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })
    })

    await batch.commit()
    setMessage(`Se programaron ${sendZona.consultas.length} mensajes para ${sendZona.zona}.`)
    setSendZona(null)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consultas por zona</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Interés pendiente de clientes agrupado por zona. Al alcanzar el umbral ({config.umbralKg} kg), se puede armar reparto.
            Para entregas con fecha, usá{' '}
            <Link href="/agenda-entregas" className="text-brand-600 hover:text-brand-700 font-medium">
              Agenda de entregas
            </Link>.
          </p>
        </div>
        <button onClick={() => openNewForm()} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Nueva consulta
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {zonasListas.length > 0 && (
        <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Hay {zonasListas.length} zona(s) listas para notificar al admin.
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-slate-500">Cargando consultas...</div>
      ) : zonas.length === 0 ? (
        <div className="card p-12 text-center">
          <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Todavia no hay consultas pendientes.</p>
          <button onClick={() => openNewForm()} className="btn-secondary mt-4">
            Registrar primera consulta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {zonas.map((zona) => {
            const cfg = ZONA_ESTADO_CONFIG[zona.estado]
            const pct = Math.min(Math.round((zona.totalKg / zona.umbralKg) * 100), 100)
            const expanded = expandedZona === zona.zona
            return (
              <div key={zona.zona} className="card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-600" />
                        <h2 className="font-semibold text-slate-900">Zona: {zona.zona}</h2>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {zona.cantidadConsultas} consultas · {zona.consultas.length} clientes
                      </p>
                    </div>
                    <span className={cn('badge text-xs', cfg.color)}>{cfg.label}</span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium text-slate-700">{zona.totalKg} kg / {zona.umbralKg} kg</span>
                      <span className="text-slate-500">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div className={cn('h-3 rounded-full transition-all', cfg.bar)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <button onClick={() => setExpandedZona(expanded ? null : zona.zona)} className="btn-secondary text-sm flex items-center gap-1.5">
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      Ver clientes
                    </button>
                    <button onClick={() => openNewForm(zona.zona)} className="btn-secondary text-sm flex items-center gap-1.5">
                      <Plus className="w-4 h-4" />
                      Agregar consulta
                    </button>
                    {zona.estado === 'lista' && (
                      <button onClick={() => notificarAdmin(zona)} className="btn-primary text-sm flex items-center gap-1.5">
                        <Bell className="w-4 h-4" />
                        Notificar Admin
                      </button>
                    )}
                    {zona.estado === 'admin_notificado' && isAdmin && (
                      <button onClick={() => confirmarZona(zona)} className="btn-primary text-sm flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar envío
                      </button>
                    )}
                    {zona.estado === 'confirmado' && (
                      <button onClick={() => openSendModal(zona)} className="btn-primary text-sm flex items-center gap-1.5">
                        <Send className="w-4 h-4" />
                        Enviar a {zona.consultas.length}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {zona.consultas.map((consulta) => (
                      <div key={consulta.id} className="px-5 py-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-amber-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-slate-900">{consulta.nombre}</p>
                            <span className="badge text-xs bg-amber-50 text-amber-700">{consulta.cantidadKg} kg</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <Link href={`/chats/${encodeURIComponent(consulta.remoteJid)}`} className="text-brand-600 hover:text-brand-700 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {consulta.tel}
                            </Link>
                            <span>{formatRelative(consulta.fechaConsulta)}</span>
                          </div>
                          {consulta.notas && <p className="text-xs text-slate-500 mt-1">{consulta.notas}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditForm(consulta)} className="p-1.5 text-slate-400 hover:text-brand-700">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => eliminarConsulta(consulta.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveConsulta} className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">{form.id ? 'Editar consulta' : 'Nueva consulta'}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre</label>
                  <input className="input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.tel} onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Zona</label>
                  <input
                    className="input"
                    list="zonas-consultas-lena"
                    value={form.zona}
                    onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))}
                  />
                  <datalist id="zonas-consultas-lena">
                    {zonasExistentes.map((zona) => <option key={zona} value={zona} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Cantidad kg</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={499}
                    value={form.cantidadKg}
                    onChange={(e) => setForm((f) => ({ ...f, cantidadKg: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input min-h-24" value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      {sendZona && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Enviar mensajes a {sendZona.zona}</h2>
              <button onClick={() => setSendZona(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Fecha texto</label>
                <input className="input" value={fechaTexto} onChange={(e) => setFechaTexto(e.target.value)} />
              </div>
              <div>
                <label className="label">Mensaje base</label>
                <textarea className="input min-h-32" value={previewTemplate} onChange={(e) => setPreviewTemplate(e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Placeholders: {'{nombre}'}, {'{zona}'}, {'{kg}'}, {'{fechaTexto}'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Preview primer cliente</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {reemplazarPlantilla(previewTemplate, sendZona.consultas[0], fechaTexto)}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setSendZona(null)} className="btn-secondary">Cancelar</button>
              <button onClick={enviarMensajesClientes} className="btn-primary flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Enviar a {sendZona.consultas.length} clientes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
