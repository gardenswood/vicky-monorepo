'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Phone,
  MapPin,
  Package,
  Clock,
  Edit2,
  Save,
  X,
  MessageSquare,
  ExternalLink,
  DollarSign,
  Plus,
  AlertTriangle,
  ThumbsDown,
  XCircle,
  CalendarClock,
  History,
  Send,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  SERVICIO_LABELS,
  ESTADO_COLORS,
  ESTADO_LABELS,
  cn,
  formatRelative,
  getDisplayName,
  getDisplayPhone,
  getIdentitySecondary,
} from '@/lib/utils'
import Link from 'next/link'
import ChatModal from '@/components/chats/ChatModal'

interface Cliente {
  tel: string
  remoteJid: string
  telefono?: string
  pushName?: string
  whatsappLid?: string
  nombre?: string
  direccion?: string
  zona?: string
  metodoPago?: string
  estado?: string
  servicioPendiente?: string
  pedidosAnteriores?: { servicio: string; descripcion: string; fecha?: Date; monto?: number }[]
  fechaUltimoContacto?: Date
  fechaPrimerContacto?: Date
  notas?: string
  audioIntroEnviado?: boolean
  potencial?: string
  statusCrm?: string
  urgencia?: string
  interes?: string[]
  proximoContactoAt?: Date
  consentimientoDifusion?: boolean
}

interface ConsultaLenaActiva {
  id: string
  zona: string
  cantidadKg: number
  estado: string
  notas?: string
}

interface AccionCrm {
  id: string
  tipo: string
  datos: Record<string, string | null>
  origen: string
  creadoEn?: Date
}

function optionalDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function')
    return value.toDate()
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : undefined
  }
  return undefined
}

function normalizePotencial(value?: string): string | undefined {
  const normalized = (value ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  return normalized || undefined
}

interface LeadDrawerProps {
  isOpen: boolean
  onClose: () => void
  cliente: any // We'll use this to get the tel, but fetch the full data inside
}

const STATUS_CRM_COLORS: Record<string, string> = {
  pendiente_cotizacion: 'bg-blue-50 text-blue-700',
  seguimiento: 'bg-amber-50 text-amber-700',
  concreto: 'bg-green-50 text-green-700',
  perdido: 'bg-red-50 text-red-700 border-red-200',
  desestimado: 'bg-slate-200 text-slate-700 border-slate-300',
}

const STATUS_CRM_LABELS: Record<string, string> = {
  pendiente_cotizacion: '⏱️ Pendiente cotización',
  seguimiento: '👀 Seguimiento',
  concreto: '🎯 Concreto',
  perdido: '❌ Perdido',
  desestimado: '👎 Desestimado',
}

export function LeadDrawer({ isOpen, onClose, cliente: initialCliente }: LeadDrawerProps) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Cliente>>({})
  const [saving, setSaving] = useState(false)
  const [consultasLena, setConsultasLena] = useState<ConsultaLenaActiva[]>([])
  const [consultaModal, setConsultaModal] = useState(false)
  const [showChatModal, setShowChatModal] = useState(false)
  const [consultaForm, setConsultaForm] = useState({ cantidadKg: '', zona: '', notas: '' })
  const [savingConsulta, setSavingConsulta] = useState(false)
  const [accionesCrm, setAccionesCrm] = useState<AccionCrm[]>([])
  const [seguimientoModal, setSeguimientoModal] = useState(false)
  const [seguimientoForm, setSeguimientoForm] = useState({ fecha: '', hora: '14:00', texto: '' })
  const [savingSeguimiento, setSavingSeguimiento] = useState(false)
  const [motivoPerdidaModal, setMotivoPerdidaModal] = useState<'perdido' | 'desestimado' | null>(null)
  const [motivoPerdida, setMotivoPerdida] = useState('')

  const telDecoded = initialCliente?.tel

  useEffect(() => {
    if (!isOpen) {
      setConsultaModal(false)
      setSeguimientoModal(false)
      setMotivoPerdidaModal(null)
      setShowChatModal(false)
      setEditing(false)
      setMotivoPerdida('')
      setSeguimientoForm({ fecha: '', hora: '14:00', texto: '' })
    }
  }, [isOpen])

  useEffect(() => {
    if (!telDecoded || !isOpen) return

    setLoading(true)
    const unsub = onSnapshot(doc(db, 'clientes', telDecoded), (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        const c: Cliente = {
          tel: telDecoded,
          remoteJid: d.remoteJid || `${telDecoded}@s.whatsapp.net`,
          telefono: d.telefono,
          pushName: d.pushName,
          whatsappLid: d.whatsappLid,
          nombre: d.nombre,
          direccion: d.direccion,
          zona: d.zona,
          metodoPago: d.metodoPago,
          estado: d.estado || 'capturados',
          servicioPendiente: d.servicioPendiente,
          pedidosAnteriores: (d.pedidosAnteriores || []).map((p: Record<string, unknown>) => ({
            ...p,
            fecha: (p.fecha as { toDate?: () => Date })?.toDate?.(),
          })),
          fechaUltimoContacto: optionalDate(d.fechaUltimoContacto),
          fechaPrimerContacto: optionalDate(d.fechaPrimerContacto),
          notas: d.notas,
          audioIntroEnviado: d.audioIntroEnviado,
          potencial: normalizePotencial(d.potencial),
          statusCrm: d.statusCrm,
          urgencia: d.urgencia,
          interes: Array.isArray(d.interes) ? d.interes : [],
          proximoContactoAt: optionalDate(d.proximoContactoAt),
          consentimientoDifusion: d.consentimientoDifusion,
        }
        setCliente(c)
        setDraft({
          nombre: c.nombre,
          direccion: c.direccion,
          zona: c.zona,
          notas: c.notas,
          estado: c.estado,
          potencial: c.potencial,
          statusCrm: c.statusCrm,
          urgencia: c.urgencia,
          interes: c.interes,
          proximoContactoAt: c.proximoContactoAt,
          consentimientoDifusion: c.consentimientoDifusion,
        })
      }
      setLoading(false)
    })
    return () => unsub()
  }, [telDecoded, isOpen])

  useEffect(() => {
    if (!telDecoded || !isOpen) return

    const q = query(collection(db, 'consultasLena'), where('tel', '==', telDecoded))
    const unsub = onSnapshot(q, (snap) => {
      setConsultasLena(
        snap.docs
          .map((docSnap) => {
            const d = docSnap.data()
            return {
              id: docSnap.id,
              zona: String(d.zona ?? 'Sin zona'),
              cantidadKg: Number(d.cantidadKg ?? 0),
              estado: String(d.estado ?? 'pendiente'),
              notas: typeof d.notas === 'string' ? d.notas : undefined,
            }
          })
          .filter((consulta) => consulta.estado !== 'enviado')
      )
    })
    return () => unsub()
  }, [telDecoded, isOpen])

  useEffect(() => {
    if (!telDecoded || !isOpen) return
    const q = query(
      collection(db, 'clientes', telDecoded, 'acciones_crm'),
      orderBy('creadoEn', 'desc'),
      limit(20)
    )
    const unsub = onSnapshot(q, (snap) => {
      setAccionesCrm(
        snap.docs.map((d) => {
          const raw = d.data()
          let creadoEn: Date | undefined
          if (raw.creadoEn && typeof raw.creadoEn.toDate === 'function') creadoEn = raw.creadoEn.toDate()
          return {
            id: d.id,
            tipo: raw.tipo || '',
            datos: raw.datos || {},
            origen: raw.origen || '',
            creadoEn,
          }
        })
      )
    })
    return () => unsub()
  }, [telDecoded, isOpen])

  async function saveChanges() {
    if (!telDecoded) return
    setSaving(true)
    try {
      const payload: Record<string, any> = { ultimaActualizacion: serverTimestamp() }
      Object.entries(draft).forEach(([k, v]) => {
        if (v !== undefined) {
          payload[k] = v
        }
      })
      await updateDoc(doc(db, 'clientes', telDecoded), payload)
      setEditing(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function setStatusCrmRapidoConMotivo(status: 'perdido' | 'desestimado', motivo: string) {
    if (!cliente || !telDecoded) return
    try {
      await updateDoc(doc(db, 'clientes', telDecoded), {
        statusCrm: status,
        ultimaActualizacion: serverTimestamp(),
      })
      await addDoc(collection(db, 'clientes', telDecoded, 'acciones_crm'), {
        tipo: status === 'perdido' ? 'perdido' : 'desestimado',
        datos: { motivo: motivo || 'Sin motivo especificado' },
        origen: 'dashboard',
        creadoEn: serverTimestamp(),
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function guardarSeguimientoDashboard() {
    if (!cliente || !telDecoded || !seguimientoForm.fecha || !seguimientoForm.texto.trim()) return
    setSavingSeguimiento(true)
    try {
      const runMs = Date.parse(`${seguimientoForm.fecha}T${seguimientoForm.hora}:00-03:00`)
      if (!Number.isFinite(runMs)) return
      await addDoc(collection(db, 'mensajes_programados'), {
        jid: cliente.remoteJid || `${telDecoded}@s.whatsapp.net`,
        texto: seguimientoForm.texto.trim(),
        runAt: Timestamp.fromMillis(runMs),
        estado: 'pendiente',
        origen: 'dashboard_seguimiento',
        motivoSeguimiento: seguimientoForm.texto.trim().slice(0, 200),
        nombreCliente: getDisplayName(cliente),
        creadoEn: serverTimestamp(),
      })
      await updateDoc(doc(db, 'clientes', telDecoded), {
        proximoContactoAt: new Date(runMs),
        statusCrm: 'seguimiento',
        ultimaActualizacion: serverTimestamp(),
      })
      await addDoc(collection(db, 'clientes', telDecoded, 'acciones_crm'), {
        tipo: 'seguimiento_agendado',
        datos: { texto: seguimientoForm.texto.trim(), runAt: new Date(runMs).toISOString() },
        origen: 'dashboard',
        creadoEn: serverTimestamp(),
      })
      setSeguimientoModal(false)
      setSeguimientoForm({ fecha: '', hora: '14:00', texto: '' })
    } catch (err) {
      console.error(err)
    } finally {
      setSavingSeguimiento(false)
    }
  }

  function openConsultaModal() {
    setConsultaForm({ cantidadKg: '', zona: cliente?.zona ?? '', notas: '' })
    setConsultaModal(true)
  }

  async function saveConsultaLena() {
    if (!cliente) return
    const kg = Number(consultaForm.cantidadKg)
    if (!Number.isFinite(kg) || kg < 1 || kg > 499 || !consultaForm.zona.trim()) return
    setSavingConsulta(true)
    try {
      await addDoc(collection(db, 'consultasLena'), {
        remoteJid: cliente.remoteJid || `${cliente.tel}@s.whatsapp.net`,
        tel: cliente.tel,
        nombre: getDisplayName(cliente),
        zona: consultaForm.zona.trim(),
        cantidadKg: Math.round(kg),
        notas: consultaForm.notas.trim() || null,
        fechaConsulta: serverTimestamp(),
        estado: 'pendiente',
        origen: 'dashboard_cliente_detalle',
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })
      const currentInteres = Array.isArray(cliente.interes) ? cliente.interes : []
      const updatedInteres = currentInteres.includes('lena') ? currentInteres : [...currentInteres, 'lena']
      await updateDoc(doc(db, 'clientes', telDecoded), {
        statusCrm: cliente.statusCrm === 'concreto' ? 'concreto' : 'seguimiento',
        interes: updatedInteres,
        servicioPendiente: cliente.servicioPendiente || 'lena',
        ultimaActualizacion: serverTimestamp(),
      })
      await addDoc(collection(db, 'clientes', telDecoded, 'acciones_crm'), {
        tipo: 'consulta_lena_registrada',
        datos: { kg: Math.round(kg), zona: consultaForm.zona.trim() },
        origen: 'dashboard',
        creadoEn: serverTimestamp(),
      })
      setConsultaModal(false)
    } finally {
      setSavingConsulta(false)
    }
  }

  if (!isOpen) return null

  const nombreVisible = cliente ? getDisplayName(cliente) : 'Cargando...'
  const telefonoVisible = cliente ? getDisplayPhone(cliente) : ''
  const identidadSecundaria = cliente ? getIdentitySecondary(cliente) : ''
  const whatsappHref = telefonoVisible ? `https://wa.me/${telefonoVisible}` : null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-50 shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            {loading || !cliente ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
                {/* Header Fijo */}
                <div className="flex-shrink-0 border-b border-slate-200 bg-white px-6 py-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center shadow-inner flex-shrink-0">
                        <span className="text-brand-700 text-xl font-bold">
                          {nombreVisible[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {editing ? (
                          <input
                            type="text"
                            className="input text-xl font-bold max-w-md w-full"
                            value={draft.nombre ?? ''}
                            onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                            placeholder="Nombre del cliente"
                          />
                        ) : (
                          <h2 className="text-2xl font-bold text-slate-900 truncate">
                            {nombreVisible}
                          </h2>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-slate-500 text-sm flex items-center gap-1">
                            <Phone className="w-4 h-4 text-slate-400" /> {telefonoVisible || identidadSecundaria}
                          </span>
                          {cliente.estado && (
                            <span className={cn('badge text-xs px-2.5 py-0.5 rounded-full', ESTADO_COLORS[cliente.estado] ?? 'bg-slate-100 text-slate-600')}>
                              {ESTADO_LABELS[cliente.estado] ?? cliente.estado}
                            </span>
                          )}
                          {cliente.statusCrm && (
                            <span className={cn('badge text-xs px-2.5 py-0.5 rounded-full border', STATUS_CRM_COLORS[cliente.statusCrm] ?? 'bg-slate-100 text-slate-600')}>
                              {STATUS_CRM_LABELS[cliente.statusCrm] ?? cliente.statusCrm.replaceAll('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {!editing && (
                      <>
                        <button
                          title="Marcar como Perdido"
                          onClick={() => { setMotivoPerdidaModal('perdido'); setMotivoPerdida('') }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                        <button
                          title="Desestimar Lead"
                          onClick={() => { setMotivoPerdidaModal('desestimado'); setMotivoPerdida('') }}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                        >
                          <ThumbsDown className="w-5 h-5" />
                        </button>
                        <button
                          title="Agendar seguimiento"
                          onClick={() => setSeguimientoModal(true)}
                          className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
                        >
                          <CalendarClock className="w-5 h-5" />
                        </button>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                      </>
                    )}

                    <button
                      onClick={() => setShowChatModal(true)}
                      className="btn-secondary flex items-center gap-1.5 rounded-full"
                    >
                      <MessageSquare className="w-4 h-4" /> <span className="hidden sm:inline">Ver chat</span>
                    </button>
                    {whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary flex items-center gap-1.5 rounded-full"
                      >
                        <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    )}
                    
                    {editing ? (
                      <>
                        <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-1.5 rounded-full">
                          <X className="w-4 h-4" /> Cancelar
                        </button>
                        <button onClick={saveChanges} disabled={saving} className="btn-primary flex items-center gap-1.5 rounded-full">
                          <Save className="w-4 h-4" /> Guardar
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-1.5 rounded-full">
                        <Edit2 className="w-4 h-4" /> Editar
                      </button>
                    )}
                  </div>
                </div>

                {/* Content Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* Datos principales + Notas */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Zona</label>
                        {editing ? (
                          <input type="text" className="input mt-1" value={draft.zona ?? ''} onChange={(e) => setDraft((d) => ({ ...d, zona: e.target.value }))} />
                        ) : (
                          <p className="text-sm text-slate-700 font-medium mt-0.5">{cliente.zona || <span className="text-slate-400">Sin zona</span>}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Dirección</label>
                        {editing ? (
                          <input type="text" className="input mt-1" value={draft.direccion ?? ''} onChange={(e) => setDraft((d) => ({ ...d, direccion: e.target.value }))} />
                        ) : (
                          <p className="text-sm text-slate-700 font-medium mt-0.5">{cliente.direccion || <span className="text-slate-400">Sin dirección</span>}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Potencial</label>
                        {editing ? (
                          <select className="input mt-1" value={draft.potencial ?? ''} onChange={(e) => setDraft((d) => ({ ...d, potencial: e.target.value }))}>
                            <option value="">Sin definir</option>
                            <option value="frio">Frío</option>
                            <option value="tibio">Tibio</option>
                            <option value="caliente">Caliente</option>
                          </select>
                        ) : (
                          <span className="badge text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-medium mt-1 inline-block">
                            {cliente.potencial || 'Sin definir'}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Estado CRM</label>
                        {editing ? (
                          <select className="input mt-1" value={draft.statusCrm ?? ''} onChange={(e) => setDraft((d) => ({ ...d, statusCrm: e.target.value }))}>
                            <option value="">Sin definir</option>
                            <option value="pendiente_cotizacion">Pendiente cotización</option>
                            <option value="seguimiento">Seguimiento</option>
                            <option value="concreto">Concreto</option>
                            <option value="perdido">Perdido</option>
                            <option value="desestimado">Desestimado</option>
                          </select>
                        ) : (
                          <span className={cn('badge text-xs px-2.5 py-1 rounded-full border font-medium mt-1 inline-block', STATUS_CRM_COLORS[cliente.statusCrm ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                            {STATUS_CRM_LABELS[cliente.statusCrm ?? ''] ?? 'Sin definir'}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Próximo contacto</label>
                        {editing ? (
                          <div className="flex gap-2 mt-1">
                            <input type="date" className="input flex-1" value={draft.proximoContactoAt ? format(draft.proximoContactoAt, 'yyyy-MM-dd') : ''}
                              onChange={(e) => {
                                const prev = draft.proximoContactoAt
                                const hora = prev ? format(prev, 'HH:mm') : '14:00'
                                setDraft((d) => ({ ...d, proximoContactoAt: e.target.value ? new Date(`${e.target.value}T${hora}:00`) : undefined }))
                              }}
                            />
                            <input type="time" className="input w-28" value={draft.proximoContactoAt ? format(draft.proximoContactoAt, 'HH:mm') : '14:00'}
                              onChange={(e) => {
                                const prev = draft.proximoContactoAt
                                const fecha = prev ? format(prev, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
                                setDraft((d) => ({ ...d, proximoContactoAt: new Date(`${fecha}T${e.target.value}:00`) }))
                              }}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-slate-700 font-medium mt-0.5">
                            {cliente.proximoContactoAt ? format(cliente.proximoContactoAt, "d 'de' MMM, yyyy HH:mm", { locale: es }) : 'Sin recordatorio'}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Último contacto</label>
                        <p className="text-sm text-slate-700 mt-0.5">
                          {cliente.fechaUltimoContacto ? <>{format(cliente.fechaUltimoContacto, "d MMM yyyy", { locale: es })} <span className="text-slate-400">({formatRelative(cliente.fechaUltimoContacto)})</span></> : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Intereses */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 block">Intereses</label>
                      {editing ? (
                        <input className="input" value={(draft.interes || []).join(', ')}
                          onChange={(e) => setDraft((d) => ({ ...d, interes: e.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) }))}
                          placeholder="lena, cerco, pergola..."
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(cliente.interes || []).length > 0 ? cliente.interes?.map((i) => (
                            <span key={i} className="badge px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-medium">{i}</span>
                          )) : <span className="text-xs text-slate-400 italic">Sin intereses</span>}
                        </div>
                      )}
                    </div>

                    {/* Notas internas */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 block">Notas internas</label>
                      {editing ? (
                        <textarea
                          className="w-full h-24 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-slate-700 text-sm resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                          value={draft.notas ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
                          placeholder="Notas sobre este cliente..."
                        />
                      ) : (
                        <div className="text-sm text-slate-700 bg-yellow-50 rounded-xl p-3 border border-yellow-100 min-h-[60px] whitespace-pre-wrap">
                          {cliente.notas || <span className="text-yellow-600/50 italic">Sin notas</span>}
                        </div>
                      )}
                    </div>

                    {editing && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Estado Lead (kanban)</label>
                        <select className="input mt-1" value={draft.estado ?? ''} onChange={(e) => setDraft((d) => ({ ...d, estado: e.target.value }))}>
                          {Object.entries(ESTADO_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Logística leña */}
                  {(consultasLena.length > 0 || cliente.interes?.includes('lena') || cliente.servicioPendiente === 'lena') && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-200">
                      <h3 className="font-semibold text-slate-900 mb-3 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Leña
                      </h3>
                      {consultasLena.length > 0 ? (
                        <div className="space-y-3">
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                            <span className="font-semibold">{consultasLena.reduce((sum, c) => sum + c.cantidadKg, 0)} kg</span> en {consultasLena[0].zona} — <span className="capitalize">{consultasLena[0].estado.replaceAll('_', ' ')}</span>
                          </div>
                          <Link href="/logistica-zonas" className="btn-secondary w-full justify-center flex items-center gap-1.5 rounded-lg text-sm py-2">
                            Ver reparto de leña
                          </Link>
                        </div>
                      ) : (
                        <button onClick={openConsultaModal} className="btn-secondary w-full flex items-center justify-center gap-1.5 rounded-lg border-dashed text-sm py-2">
                          <Plus className="w-4 h-4" /> Registrar para reparto
                        </button>
                      )}
                    </div>
                  )}

                  {/* Pedidos anteriores */}
                  {cliente.pedidosAnteriores && cliente.pedidosAnteriores.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                      <h3 className="font-semibold text-slate-900 mb-3 text-sm flex items-center gap-2">
                        <Package className="w-4 h-4 text-purple-500" />
                        Pedidos ({cliente.pedidosAnteriores.length})
                      </h3>
                      <div className="space-y-2">
                        {cliente.pedidosAnteriores.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg text-sm">
                            <span className="text-brand-600 font-bold text-xs">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-slate-800">{SERVICIO_LABELS[p.servicio] ?? p.servicio}</span>
                              {p.descripcion && <span className="text-slate-500 ml-1.5">— {p.descripcion}</span>}
                            </div>
                            {p.fecha && <span className="text-[10px] text-slate-400 flex-shrink-0">{formatRelative(p.fecha)}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historial CRM */}
                  {accionesCrm.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                      <h3 className="font-semibold text-slate-900 mb-3 text-sm flex items-center gap-2">
                        <History className="w-4 h-4 text-indigo-500" />
                        Historial ({accionesCrm.length})
                      </h3>
                      <div className="space-y-2 max-h-52 overflow-y-auto">
                        {accionesCrm.map((a) => {
                          let icon = <Clock className="w-3.5 h-3.5 text-slate-400" />
                          let colorBg = 'bg-slate-50'
                          if (a.tipo === 'calificacion') { icon = <Edit2 className="w-3.5 h-3.5 text-blue-500" />; colorBg = 'bg-blue-50' }
                          else if (a.tipo.includes('seguimiento')) { icon = <CalendarClock className="w-3.5 h-3.5 text-amber-500" />; colorBg = 'bg-amber-50' }
                          else if (a.tipo === 'perdido' || a.tipo === 'desestimado') { icon = <XCircle className="w-3.5 h-3.5 text-red-500" />; colorBg = 'bg-red-50' }
                          else if (a.tipo.includes('lena') || a.tipo.includes('pedido')) { icon = <Package className="w-3.5 h-3.5 text-purple-500" />; colorBg = 'bg-purple-50' }
                          return (
                            <div key={a.id} className={cn('flex items-center gap-2.5 p-2.5 rounded-lg text-xs', colorBg)}>
                              {icon}
                              <span className="font-medium text-slate-700 capitalize">{a.tipo.replaceAll('_', ' ')}</span>
                              {a.datos.motivo && <span className="text-slate-500 truncate flex-1">— {a.datos.motivo}</span>}
                              <span className="text-slate-400 flex-shrink-0">{a.creadoEn ? formatRelative(a.creadoEn) : ''}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </>
            )}
          </motion.div>
        </>
      )}

      {/* Modal secundario de Consulta Leña */}
      {consultaModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Registrar consulta leña
              </h2>
              <button onClick={() => setConsultaModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs uppercase tracking-wider mb-1.5">Cantidad kg</label>
                  <input
                    type="number"
                    min={1}
                    max={499}
                    className="input rounded-xl"
                    value={consultaForm.cantidadKg}
                    onChange={(e) => setConsultaForm((f) => ({ ...f, cantidadKg: e.target.value }))}
                    placeholder="Ej. 100"
                  />
                </div>
                <div>
                  <label className="label text-xs uppercase tracking-wider mb-1.5">Zona</label>
                  <input
                    className="input rounded-xl"
                    value={consultaForm.zona}
                    onChange={(e) => setConsultaForm((f) => ({ ...f, zona: e.target.value }))}
                    placeholder="Barrio o zona"
                  />
                </div>
              </div>
              <div>
                <label className="label text-xs uppercase tracking-wider mb-1.5">Notas adicionales</label>
                <textarea
                  className="input min-h-24 rounded-xl resize-none"
                  value={consultaForm.notas}
                  onChange={(e) => setConsultaForm((f) => ({ ...f, notas: e.target.value }))}
                  placeholder="Detalles para el reparto..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5 bg-slate-50 rounded-b-3xl">
              <button onClick={() => setConsultaModal(false)} className="btn-secondary rounded-full px-5">Cancelar</button>
              <button onClick={saveConsultaLena} disabled={savingConsulta} className="btn-primary rounded-full px-5 shadow-md">
                {savingConsulta ? 'Guardando...' : 'Guardar consulta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal secundario de Chat */}
      {showChatModal && cliente && (
        <ChatModal jidDecoded={cliente.remoteJid} onClose={() => setShowChatModal(false)} />
      )}

      {/* Modal Motivo Pérdida/Desestimación */}
      {motivoPerdidaModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {motivoPerdidaModal === 'perdido' ? (
                  <><XCircle className="w-5 h-5 text-red-500" /> Marcar como Perdido</>
                ) : (
                  <><ThumbsDown className="w-5 h-5 text-slate-500" /> Desestimar Lead</>
                )}
              </h2>
              <button onClick={() => setMotivoPerdidaModal(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label text-xs uppercase tracking-wider mb-1.5">Motivo</label>
                <textarea
                  className="input min-h-24 rounded-xl resize-none"
                  value={motivoPerdida}
                  onChange={(e) => setMotivoPerdida(e.target.value)}
                  placeholder={motivoPerdidaModal === 'perdido' ? 'Por qué se pierde este lead...' : 'Por qué se desestima este lead...'}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5 bg-slate-50 rounded-b-3xl">
              <button onClick={() => setMotivoPerdidaModal(null)} className="btn-secondary rounded-full px-5">Cancelar</button>
              <button
                onClick={async () => {
                  await setStatusCrmRapidoConMotivo(motivoPerdidaModal, motivoPerdida.trim())
                  setMotivoPerdidaModal(null)
                  setMotivoPerdida('')
                }}
                className={cn(
                  'rounded-full px-5 shadow-md font-semibold',
                  motivoPerdidaModal === 'perdido' ? 'btn-primary bg-red-600 hover:bg-red-700' : 'btn-primary bg-slate-600 hover:bg-slate-700'
                )}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agendar Seguimiento */}
      {seguimientoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-brand-500" />
                Agendar seguimiento
              </h2>
              <button onClick={() => setSeguimientoModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs uppercase tracking-wider mb-1.5">Fecha</label>
                  <input
                    type="date"
                    className="input rounded-xl"
                    value={seguimientoForm.fecha}
                    onChange={(e) => setSeguimientoForm((f) => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-xs uppercase tracking-wider mb-1.5">Hora</label>
                  <input
                    type="time"
                    className="input rounded-xl"
                    value={seguimientoForm.hora}
                    onChange={(e) => setSeguimientoForm((f) => ({ ...f, hora: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label text-xs uppercase tracking-wider mb-1.5">Mensaje / motivo del seguimiento</label>
                <textarea
                  className="input min-h-24 rounded-xl resize-none"
                  value={seguimientoForm.texto}
                  onChange={(e) => setSeguimientoForm((f) => ({ ...f, texto: e.target.value }))}
                  placeholder="Ej: Hola! Te escribo por la consulta de cercos que habíamos charlado..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5 bg-slate-50 rounded-b-3xl">
              <button onClick={() => setSeguimientoModal(false)} className="btn-secondary rounded-full px-5">Cancelar</button>
              <button
                onClick={guardarSeguimientoDashboard}
                disabled={savingSeguimiento || !seguimientoForm.fecha || !seguimientoForm.texto.trim()}
                className="btn-primary rounded-full px-5 shadow-md"
              >
                {savingSeguimiento ? 'Guardando...' : 'Programar seguimiento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
