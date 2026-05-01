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
  serverTimestamp,
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
  en_obra: 'bg-purple-50 text-purple-700',
  perdido: 'bg-red-50 text-red-700 border-red-200',
  desestimado: 'bg-slate-200 text-slate-700 border-slate-300',
}

const STATUS_CRM_LABELS: Record<string, string> = {
  pendiente_cotizacion: '⏱️ Pendiente cotización',
  seguimiento: '👀 Seguimiento',
  concreto: '🎯 Concreto',
  en_obra: '🚧 En obra',
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

  const telDecoded = initialCliente?.tel

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

  async function setStatusCrmRapido(status: 'perdido' | 'desestimado') {
    if (!cliente || !telDecoded) return
    try {
      await updateDoc(doc(db, 'clientes', telDecoded), {
        statusCrm: status,
        ultimaActualizacion: serverTimestamp(),
      })
    } catch (err) {
      console.error(err)
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
                          onClick={() => setStatusCrmRapido('perdido')}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                        <button
                          title="Desestimar Lead"
                          onClick={() => setStatusCrmRapido('desestimado')}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                        >
                          <ThumbsDown className="w-5 h-5" />
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
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  
                  {/* Datos del Cliente */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-5 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-brand-500" />
                      Datos de ubicación y pago
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="label text-xs text-slate-400 uppercase tracking-wider mb-1.5">Dirección</label>
                        {editing ? (
                          <input
                            type="text"
                            className="input"
                            value={draft.direccion ?? ''}
                            onChange={(e) => setDraft((d) => ({ ...d, direccion: e.target.value }))}
                          />
                        ) : (
                          <p className="text-sm text-slate-700 font-medium">
                            {cliente.direccion || <span className="text-slate-400 font-normal">Sin dirección</span>}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="label text-xs text-slate-400 uppercase tracking-wider mb-1.5">Zona</label>
                        {editing ? (
                          <input
                            type="text"
                            className="input"
                            value={draft.zona ?? ''}
                            onChange={(e) => setDraft((d) => ({ ...d, zona: e.target.value }))}
                          />
                        ) : (
                          <p className="text-sm text-slate-700 font-medium">
                            {cliente.zona || <span className="text-slate-400 font-normal">Sin zona</span>}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="label text-xs text-slate-400 uppercase tracking-wider mb-1.5">Estado Lead</label>
                        {editing ? (
                          <select
                            className="input"
                            value={draft.estado ?? ''}
                            onChange={(e) => setDraft((d) => ({ ...d, estado: e.target.value }))}
                          >
                            {Object.entries(ESTADO_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={cn('badge text-xs px-2.5 py-1 rounded-full', ESTADO_COLORS[cliente.estado ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                            {ESTADO_LABELS[cliente.estado ?? ''] ?? cliente.estado}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="label text-xs text-slate-400 uppercase tracking-wider mb-1.5">Método de pago</label>
                        <p className="text-sm text-slate-700 capitalize font-medium">
                          {cliente.metodoPago || <span className="text-slate-400 font-normal">No especificado</span>}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <label className="label text-xs text-slate-400 uppercase tracking-wider mb-2">Notas internas</label>
                      {editing ? (
                        <textarea
                          className="w-full h-32 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-slate-700 text-sm resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent placeholder:text-yellow-600/50 shadow-inner"
                          value={draft.notas ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
                          placeholder="Notas sobre este cliente..."
                        />
                      ) : (
                        <div className="text-sm text-slate-700 bg-yellow-50 rounded-xl p-4 border border-yellow-100 shadow-inner min-h-[80px] whitespace-pre-wrap">
                          {cliente.notas || <span className="text-yellow-600/50 italic">Sin notas registradas</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CRM Comercial */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-5 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      CRM comercial
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="label text-xs text-slate-400 uppercase tracking-wider mb-1.5">Potencial</label>
                        {editing ? (
                          <select
                            className="input"
                            value={draft.potencial ?? ''}
                            onChange={(e) => setDraft((d) => ({ ...d, potencial: e.target.value }))}
                          >
                            <option value="">Sin definir</option>
                            <option value="frio">Frío</option>
                            <option value="tibio">Tibio</option>
                            <option value="caliente">Caliente</option>
                          </select>
                        ) : (
                          <span className="badge text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                            {cliente.potencial || 'Sin definir'}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="label text-xs text-slate-400 uppercase tracking-wider mb-1.5">Estado CRM</label>
                        {editing ? (
                          <select
                            className="input"
                            value={draft.statusCrm ?? ''}
                            onChange={(e) => setDraft((d) => ({ ...d, statusCrm: e.target.value }))}
                          >
                            <option value="">Sin definir</option>
                            <option value="pendiente_cotizacion">⏱️ Pendiente cotización</option>
                            <option value="seguimiento">👀 Seguimiento</option>
                            <option value="concreto">🎯 Concreto</option>
                            <option value="en_obra">🚧 En obra</option>
                            <option value="perdido">❌ Perdido</option>
                            <option value="desestimado">👎 Desestimado</option>
                          </select>
                        ) : (
                          <span className={cn('badge text-xs px-2.5 py-1 rounded-full border', STATUS_CRM_COLORS[cliente.statusCrm ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                            {STATUS_CRM_LABELS[cliente.statusCrm ?? ''] ?? cliente.statusCrm?.replaceAll('_', ' ') ?? 'Sin definir'}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="label text-xs text-slate-400 uppercase tracking-wider mb-1.5">Urgencia</label>
                        {editing ? (
                          <select
                            className="input"
                            value={draft.urgencia ?? ''}
                            onChange={(e) => setDraft((d) => ({ ...d, urgencia: e.target.value }))}
                          >
                            <option value="">Sin definir</option>
                            <option value="alta">Alta</option>
                            <option value="media">Media</option>
                            <option value="baja">Baja</option>
                          </select>
                        ) : (
                          <p className="text-sm text-slate-700 font-medium capitalize">{cliente.urgencia || 'Sin definir'}</p>
                        )}
                      </div>
                      <div>
                        <label className="label text-xs text-slate-400 uppercase tracking-wider mb-1.5">Próximo contacto</label>
                        {editing ? (
                          <input
                            type="date"
                            className="input"
                            value={draft.proximoContactoAt ? draft.proximoContactoAt.toISOString().slice(0, 10) : ''}
                            onChange={(e) => setDraft((d) => ({ ...d, proximoContactoAt: e.target.value ? new Date(`${e.target.value}T12:00:00`) : undefined }))}
                          />
                        ) : (
                          <p className="text-sm text-slate-700 font-medium">
                            {cliente.proximoContactoAt ? format(cliente.proximoContactoAt, "d 'de' MMM, yyyy", { locale: es }) : 'Sin recordatorio'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <label className="label text-xs text-slate-400 uppercase tracking-wider mb-2">Intereses / productos consultados</label>
                      {editing ? (
                        <input
                          className="input"
                          value={(draft.interes || []).join(', ')}
                          onChange={(e) => setDraft((d) => ({
                            ...d,
                            interes: e.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
                          }))}
                          placeholder="lena, cerco, pergola..."
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(cliente.interes || []).length > 0 ? cliente.interes?.map((i) => (
                            <span key={i} className="badge px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-600 font-medium border border-slate-200 shadow-sm">{i}</span>
                          )) : <span className="text-sm text-slate-400 italic">Sin intereses registrados</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Logística leña */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-0" />
                    <h3 className="font-semibold text-slate-900 mb-4 text-sm flex items-center gap-2 relative z-10">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      Logística leña
                    </h3>
                    {consultasLena.length > 0 ? (
                      <div className="space-y-4 relative z-10">
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-800 shadow-sm">
                          <p className="font-bold flex items-center gap-2 text-base">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                            Consulta activa
                          </p>
                          <p className="mt-3 leading-relaxed">
                            <span className="font-semibold">{consultasLena.reduce((sum, c) => sum + c.cantidadKg, 0)} kg</span> en {consultasLena[0].zona}.<br />
                            Estado: <span className="capitalize font-medium">{consultasLena[0].estado.replaceAll('_', ' ')}</span>
                          </p>
                        </div>
                        <Link href="/logistica-zonas" className="btn-secondary w-full justify-center flex items-center gap-1.5 rounded-xl bg-white shadow-sm border-slate-200 hover:border-amber-300 hover:text-amber-700 py-2.5">
                          Ver reparto de leña
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4 relative z-10">
                        <p className="text-slate-500 text-sm italic">Sin consulta logística activa.</p>
                        <button onClick={openConsultaModal} className="btn-secondary w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 hover:border-brand-300 hover:text-brand-600 bg-white py-2.5">
                          <Plus className="w-4 h-4" /> Registrar para reparto
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Pedidos Anteriores */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-5 flex items-center gap-2">
                      <Package className="w-5 h-5 text-purple-500" />
                      Pedidos anteriores ({cliente.pedidosAnteriores?.length ?? 0})
                    </h3>
                    {!cliente.pedidosAnteriores || cliente.pedidosAnteriores.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                        <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-400 text-sm">Sin pedidos registrados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cliente.pedidosAnteriores.map((p, i) => (
                          <div key={i} className="flex items-start gap-4 p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-brand-200 transition-colors">
                            <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center flex-shrink-0 text-brand-600 font-bold border border-brand-100">
                              #{i + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-900">
                                {SERVICIO_LABELS[p.servicio] ?? p.servicio}
                              </p>
                              <p className="text-sm text-slate-600 mt-1 leading-snug">{p.descripcion}</p>
                              <div className="flex items-center gap-4 mt-2">
                                {p.monto && (
                                  <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    ${p.monto.toLocaleString('es-AR')}
                                  </span>
                                )}
                                {p.fecha && (
                                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    {formatRelative(p.fecha)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Identidad WhatsApp & Actividad */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                      <h3 className="font-semibold text-slate-900 mb-4 text-sm flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        Identidad WhatsApp
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Nombre visible</p>
                          <p className="text-slate-800 font-medium">{nombreVisible}</p>
                        </div>
                        {cliente.pushName && cliente.pushName !== cliente.nombre && (
                          <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Nombre WhatsApp / agenda</p>
                            <p className="text-slate-800">{cliente.pushName}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Teléfono real</p>
                          <p className="text-slate-800 font-medium">{telefonoVisible || 'Sin teléfono resuelto'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Identificador técnico</p>
                          <p className="text-slate-500 text-xs break-all bg-slate-50 p-1.5 rounded mt-1 border border-slate-100">
                            {identidadSecundaria || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                      <h3 className="font-semibold text-slate-900 mb-4 text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        Actividad
                      </h3>
                      <div className="space-y-4">
                        {[
                          { label: 'Primer contacto', value: cliente.fechaPrimerContacto },
                          { label: 'Último contacto', value: cliente.fechaUltimoContacto },
                        ].map(({ label, value }) => (
                          <div key={label} className="relative pl-4 border-l-2 border-brand-100">
                            <div className="absolute w-2 h-2 bg-brand-400 rounded-full -left-[5px] top-1.5 ring-4 ring-white" />
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                            <p className="text-sm text-slate-800 font-medium">
                              {value ? format(value, "d 'de' MMMM, yyyy", { locale: es }) : '—'}
                            </p>
                            {value && (
                              <p className="text-xs text-slate-400 mt-0.5">{formatRelative(value)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-600 flex items-center gap-2 bg-slate-50 py-2 px-3 rounded-lg border border-slate-100">
                          <span className={cn('w-2.5 h-2.5 rounded-full shadow-sm', cliente.audioIntroEnviado ? 'bg-green-500' : 'bg-slate-300')} />
                          Audio intro {cliente.audioIntroEnviado ? 'enviado' : 'pendiente'}
                        </p>
                      </div>
                    </div>
                  </div>

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
    </AnimatePresence>
  )
}
