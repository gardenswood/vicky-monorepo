'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  ArrowLeft, Phone, MapPin, Package, Clock, Edit2, Save, X,
  MessageSquare, ExternalLink, DollarSign,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { SERVICIO_LABELS, ESTADO_COLORS, ESTADO_LABELS, cn, formatRelative } from '@/lib/utils'
import Link from 'next/link'

interface Cliente {
  tel: string
  remoteJid: string
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

export default function ClienteDetailPage() {
  const { tel } = useParams<{ tel: string }>()
  const router = useRouter()
  const telDecoded = decodeURIComponent(tel)

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Cliente>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'clientes', telDecoded), (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        const c: Cliente = {
          tel: telDecoded,
          remoteJid: d.remoteJid || `${telDecoded}@s.whatsapp.net`,
          nombre: d.nombre,
          direccion: d.direccion,
          zona: d.zona,
          metodoPago: d.metodoPago,
          estado: d.estado,
          servicioPendiente: d.servicioPendiente,
          pedidosAnteriores: (d.pedidosAnteriores || []).map((p: Record<string, unknown>) => ({
            ...p,
            fecha: (p.fecha as { toDate?: () => Date })?.toDate?.(),
          })),
          fechaUltimoContacto: d.fechaUltimoContacto?.toDate(),
          fechaPrimerContacto: d.fechaPrimerContacto?.toDate(),
          notas: d.notas,
          audioIntroEnviado: d.audioIntroEnviado,
          potencial: d.potencial,
          statusCrm: d.statusCrm,
          urgencia: d.urgencia,
          interes: Array.isArray(d.interes) ? d.interes : [],
          proximoContactoAt: d.proximoContactoAt?.toDate(),
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
  }, [telDecoded])

  async function saveChanges() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'clientes', telDecoded), {
        ...draft,
        ultimaActualizacion: serverTimestamp(),
      })
      setEditing(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Cliente no encontrado</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4">Volver</button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
          <span className="text-brand-700 text-lg font-bold">
            {cliente.nombre?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
        <div className="flex-1">
          {editing ? (
            <input
              type="text"
              className="input text-xl font-bold"
              value={draft.nombre ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              placeholder="Nombre del cliente"
            />
          ) : (
            <h1 className="text-2xl font-bold text-slate-900">
              {cliente.nombre || 'Sin nombre'}
            </h1>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-slate-500 text-sm flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> {cliente.tel}
            </span>
            {cliente.estado && (
              <span className={cn('badge text-xs', ESTADO_COLORS[cliente.estado] ?? 'bg-slate-100 text-slate-600')}>
                {ESTADO_LABELS[cliente.estado] ?? cliente.estado}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/chats/${encodeURIComponent(cliente.remoteJid)}`}
            className="btn-secondary flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4" /> Ver chat
          </Link>
          <a
            href={`https://wa.me/${cliente.tel}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" /> WhatsApp
          </a>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-1.5">
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button onClick={saveChanges} disabled={saving} className="btn-primary flex items-center gap-1.5">
                <Save className="w-4 h-4" /> Guardar
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-1.5">
              <Edit2 className="w-4 h-4" /> Editar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Main info */}
        <div className="col-span-2 space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Datos del cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Dirección</label>
                {editing ? (
                  <input
                    type="text"
                    className="input"
                    value={draft.direccion ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, direccion: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {cliente.direccion || <span className="text-slate-400">Sin dirección</span>}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Zona</label>
                {editing ? (
                  <input
                    type="text"
                    className="input"
                    value={draft.zona ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, zona: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm text-slate-700">
                    {cliente.zona || <span className="text-slate-400">Sin zona</span>}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Estado</label>
                {editing ? (
                  <select
                    className="input"
                    value={draft.estado ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, estado: e.target.value }))}
                  >
                    <option value="nuevo">Nuevo</option>
                    <option value="cotizacion_enviada">Cotización enviada</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="cliente">Cliente</option>
                  </select>
                ) : (
                  <span className={cn('badge text-xs', ESTADO_COLORS[cliente.estado ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                    {ESTADO_LABELS[cliente.estado ?? ''] ?? 'Nuevo'}
                  </span>
                )}
              </div>
              <div>
                <label className="label">Método de pago</label>
                <p className="text-sm text-slate-700 capitalize">
                  {cliente.metodoPago || <span className="text-slate-400">No especificado</span>}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="label">Notas internas</label>
              {editing ? (
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={draft.notas ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
                  placeholder="Notas sobre este cliente..."
                />
              ) : (
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
                  {cliente.notas || <span className="text-slate-400">Sin notas</span>}
                </p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-4">CRM comercial</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Potencial</label>
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
                  <span className="badge text-xs bg-amber-50 text-amber-700">{cliente.potencial || 'Sin definir'}</span>
                )}
              </div>
              <div>
                <label className="label">Estado CRM</label>
                {editing ? (
                  <select
                    className="input"
                    value={draft.statusCrm ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, statusCrm: e.target.value }))}
                  >
                    <option value="">Sin definir</option>
                    <option value="pendiente_cotizacion">Pendiente cotización</option>
                    <option value="seguimiento">Seguimiento</option>
                    <option value="concreto">Concreto</option>
                    <option value="en_obra">En obra</option>
                  </select>
                ) : (
                  <p className="text-sm text-slate-700">{cliente.statusCrm?.replaceAll('_', ' ') || 'Sin definir'}</p>
                )}
              </div>
              <div>
                <label className="label">Urgencia</label>
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
                  <p className="text-sm text-slate-700">{cliente.urgencia || 'Sin definir'}</p>
                )}
              </div>
              <div>
                <label className="label">Próximo contacto</label>
                {editing ? (
                  <input
                    type="date"
                    className="input"
                    value={draft.proximoContactoAt ? draft.proximoContactoAt.toISOString().slice(0, 10) : ''}
                    onChange={(e) => setDraft((d) => ({ ...d, proximoContactoAt: e.target.value ? new Date(`${e.target.value}T12:00:00`) : undefined }))}
                  />
                ) : (
                  <p className="text-sm text-slate-700">
                    {cliente.proximoContactoAt ? format(cliente.proximoContactoAt, "d 'de' MMMM, yyyy", { locale: es }) : 'Sin recordatorio'}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Intereses / productos consultados</label>
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
                    <span key={i} className="badge text-xs bg-slate-100 text-slate-600">{i}</span>
                  )) : <span className="text-sm text-slate-400">Sin intereses registrados</span>}
                </div>
              )}
            </div>
          </div>

          {/* Pedidos */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-400" />
              Pedidos anteriores ({cliente.pedidosAnteriores?.length ?? 0})
            </h3>
            {!cliente.pedidosAnteriores || cliente.pedidosAnteriores.length === 0 ? (
              <p className="text-slate-400 text-sm">Sin pedidos registrados</p>
            ) : (
              <div className="space-y-3">
                {cliente.pedidosAnteriores.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-700 text-xs font-bold">#{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {SERVICIO_LABELS[p.servicio] ?? p.servicio}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">{p.descripcion}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {p.monto && (
                          <span className="text-xs text-brand-700 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${p.monto.toLocaleString('es-AR')}
                          </span>
                        )}
                        {p.fecha && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
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
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-3 text-sm">Actividad</h3>
            <div className="space-y-3">
              {[
                { label: 'Primer contacto', value: cliente.fechaPrimerContacto },
                { label: 'Último contacto', value: cliente.fechaUltimoContacto },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-sm text-slate-700 font-medium">
                    {value ? format(value, "d 'de' MMMM, yyyy", { locale: es }) : '—'}
                  </p>
                  {value && (
                    <p className="text-xs text-slate-400">{formatRelative(value)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-3 text-sm">Servicio en curso</h3>
            {cliente.servicioPendiente ? (
              <div className="bg-brand-50 rounded-lg p-3 border border-brand-100">
                <p className="text-sm font-medium text-brand-800">
                  {SERVICIO_LABELS[cliente.servicioPendiente] ?? cliente.servicioPendiente}
                </p>
                <p className="text-xs text-brand-600 mt-0.5">Cotización pendiente de confirmación</p>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">Sin servicio activo</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-3 text-sm">Estado del bot</h3>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cliente.audioIntroEnviado ? 'bg-green-500' : 'bg-slate-300'}`} />
              Audio de bienvenida {cliente.audioIntroEnviado ? 'enviado' : 'no enviado aún'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
