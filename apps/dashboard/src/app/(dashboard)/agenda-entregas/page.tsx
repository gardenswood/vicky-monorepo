'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  Timestamp,
  serverTimestamp,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Truck,
  Bell,
  Package,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

function tsToFechaDiaLocal(ts: Timestamp): string {
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtHoraRunAt(ts: Timestamp): string {
  return format(ts.toDate(), 'HH:mm')
}

type EntregaDoc = {
  id: string
  fechaDia: string
  horaTexto?: string | null
  titulo: string
  notas?: string | null
  jid?: string | null
  /** Teléfono de contacto en puerta (puede diferir del WhatsApp) */
  telefonoContacto?: string | null
  /** Dirección de entrega (copia operativa del día; el CRM sigue en clientes/) */
  direccion?: string | null
  /** Producto y características a entregar */
  producto?: string | null
  kg?: number | null
  origen?: string
  estado?: string
}

type ProgramadoDoc = {
  id: string
  jid?: string
  texto?: string
  runAt?: Timestamp
  estado?: string
  origen?: string
}

type ColaDoc = {
  id: string
  nombre?: string
  direccion?: string
  zona?: string
  cantidadKg?: number
  estado?: string
  remoteJid?: string
  tel?: string | null
}

type DiaBucket = {
  entregas: EntregaDoc[]
  programados: ProgramadoDoc[]
}

type DatosEntregaRegDoc = {
  id: string
  jid?: string | null
  telefonoLinea?: string | null
  nombre?: string | null
  mensajeCliente?: string | null
  origen?: string
  estado?: string
  creadoEn?: Timestamp | null
}

export default function AgendaEntregasPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState<Date>(() => new Date())
  const [entregas, setEntregas] = useState<EntregaDoc[]>([])
  const [programados, setProgramados] = useState<ProgramadoDoc[]>([])
  const [cola, setCola] = useState<ColaDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  /** Si no es null, el modal está en modo edición de ese documento */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fechaDia: format(new Date(), 'yyyy-MM-dd'),
    horaTexto: '',
    titulo: '',
    notas: '',
    jid: '',
    kg: '',
    telefonoContacto: '',
    direccion: '',
    producto: '',
  })
  const [crmTelImport, setCrmTelImport] = useState('')
  const [importingCrm, setImportingCrm] = useState(false)
  const [datosEntregaReg, setDatosEntregaReg] = useState<DatosEntregaRegDoc[]>([])
  const [agendaFirestoreError, setAgendaFirestoreError] = useState<string | null>(null)

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const fechaMin = format(monthStart, 'yyyy-MM-dd')
  const fechaMax = format(monthEnd, 'yyyy-MM-dd')

  useEffect(() => {
    const qE = query(
      collection(db, 'entregas_agenda'),
      where('fechaDia', '>=', fechaMin),
      where('fechaDia', '<=', fechaMax),
      orderBy('fechaDia')
    )
    const unsubE = onSnapshot(
      qE,
      (snap) => {
        setAgendaFirestoreError(null)
        setEntregas(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EntregaDoc, 'id'>) }))
        )
        setLoading(false)
      },
      (err) => {
        console.error('entregas_agenda onSnapshot:', err)
        setAgendaFirestoreError(err?.message || 'Error al leer entregas_agenda')
        setLoading(false)
      }
    )

    const qP = query(
      collection(db, 'mensajes_programados'),
      where('runAt', '>=', Timestamp.fromDate(monthStart)),
      where('runAt', '<=', Timestamp.fromDate(monthEnd)),
      orderBy('runAt')
    )
    const unsubP = onSnapshot(qP, (snap) => {
      setProgramados(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProgramadoDoc, 'id'>) }))
      )
    })

    const qC = query(collection(db, 'colaLena'), orderBy('fechaPedido', 'asc'))
    const unsubC = onSnapshot(qC, (snap) => {
      setCola(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ColaDoc, 'id'>) }))
      )
    })

    const qDe = query(collection(db, 'datos_entrega_cliente'), orderBy('creadoEn', 'desc'), limit(25))
    const unsubDe = onSnapshot(qDe, (snap) => {
      setDatosEntregaReg(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DatosEntregaRegDoc, 'id'>) }))
      )
    })

    return () => {
      unsubE()
      unsubP()
      unsubC()
      unsubDe()
    }
  }, [cursor, fechaMin, fechaMax, monthStart, monthEnd])

  const byDay = useMemo(() => {
    const m: Record<string, DiaBucket> = {}
    for (const e of entregas) {
      if (e.estado === 'cancelada') continue
      if (!m[e.fechaDia]) m[e.fechaDia] = { entregas: [], programados: [] }
      m[e.fechaDia].entregas.push(e)
    }
    for (const p of programados) {
      if (!p.runAt) continue
      const key = tsToFechaDiaLocal(p.runAt)
      if (!m[key]) m[key] = { entregas: [], programados: [] }
      m[key].programados.push(p)
    }
    return m
  }, [entregas, programados])

  const selectedKey = format(selected, 'yyyy-MM-dd')
  const bucket = byDay[selectedKey] ?? { entregas: [], programados: [] }

  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const gridDays = eachDayOfInterval({ start: calStart, end: calEnd })

  const colaActiva = cola.filter((c) => c.estado === 'en_cola' || c.estado === 'notificado')

  function emptyFormForDay(dia: string) {
    return {
      fechaDia: dia,
      horaTexto: '',
      titulo: '',
      notas: '',
      jid: '',
      kg: '',
      telefonoContacto: '',
      direccion: '',
      producto: '',
    }
  }

  function abrirModalNuevo() {
    setEditingId(null)
    setForm(emptyFormForDay(format(selected, 'yyyy-MM-dd')))
    setModal(true)
  }

  function abrirModalEditar(e: EntregaDoc) {
    setEditingId(e.id)
    setForm({
      fechaDia: e.fechaDia,
      horaTexto: e.horaTexto || '',
      titulo: e.titulo,
      notas: e.notas || '',
      jid: e.jid || '',
      kg: e.kg != null ? String(e.kg) : '',
      telefonoContacto: e.telefonoContacto || '',
      direccion: e.direccion || '',
      producto: e.producto || '',
    })
    setModal(true)
  }

  function cerrarModal() {
    setModal(false)
    setEditingId(null)
    setForm(emptyFormForDay(format(new Date(), 'yyyy-MM-dd')))
  }

  async function eliminarEntregaEvento(id: string) {
    if (!window.confirm('¿Eliminar este evento de la agenda? No se puede deshacer.')) return
    try {
      await deleteDoc(doc(db, 'entregas_agenda', id))
      setEditingId((cur) => {
        if (cur === id) {
          setModal(false)
          setForm(emptyFormForDay(format(new Date(), 'yyyy-MM-dd')))
          return null
        }
        return cur
      })
    } catch (e) {
      console.error(e)
      alert('No se pudo eliminar.')
    }
  }

  function candidateClienteDocIds(rawDigits: string): string[] {
    const d = rawDigits.replace(/\D/g, '')
    const out: string[] = []
    const push = (x: string) => {
      if (x && !out.includes(x)) out.push(x)
    }
    if (!d) return out
    push(d)
    if (d.length === 10 && !d.startsWith('54')) push(`549${d}`)
    if (d.length === 11 && d.startsWith('54') && !d.startsWith('549')) push(`549${d.slice(2)}`)
    if (d.startsWith('549') && d.length > 3) push(d.slice(3))
    return out
  }

  async function importarDesdeCrm() {
    const digits = crmTelImport.replace(/\D/g, '')
    if (!digits) {
      alert('Ingresá dígitos del teléfono (ej. 3516170743 o 5493516170743).')
      return
    }
    setImportingCrm(true)
    try {
      const ids = candidateClienteDocIds(digits)
      for (const id of ids) {
        const snap = await getDoc(doc(db, 'clientes', id))
        if (snap.exists()) {
          const d = snap.data()
          const rj = (d.remoteJid as string) || `${id}@s.whatsapp.net`
          const servicio = (d.servicioPendiente as string) || ''
          const tipo = (d.tipoLenaPreferido as string) || ''
          const prodParts = [servicio, tipo ? `leña ${tipo}` : ''].filter(Boolean)
          setForm((f) => ({
            ...f,
            jid: rj,
            direccion: (d.direccion as string) || f.direccion,
            telefonoContacto: id || f.telefonoContacto,
            producto: prodParts.length ? prodParts.join(' · ') : f.producto,
            titulo:
              f.titulo.trim() ||
              `${d.nombre ? `${String(d.nombre)} — ` : ''}${servicio || 'Entrega'}`.slice(0, 500),
          }))
          setCrmTelImport('')
          return
        }
      }
      alert('No se encontró clientes/{id}. Revisá en Firestore (id suele ser 549… sin @).')
    } finally {
      setImportingCrm(false)
    }
  }

  async function guardarEntrega() {
    const tit = form.titulo.trim()
    if (!tit) {
      alert('Completá el título.')
      return
    }
    setSaving(true)
    try {
      const kgRaw = form.kg.trim()
      let kg: number | undefined
      if (kgRaw) {
        const n = parseFloat(kgRaw.replace(',', '.'))
        if (Number.isFinite(n)) kg = n
      }
      const ht = form.horaTexto.trim()
      const telC = form.telefonoContacto.trim()
      const dir = form.direccion.trim()
      const prod = form.producto.trim()
      const campos = {
        fechaDia: form.fechaDia,
        horaTexto: ht && ht !== '--' ? ht.slice(0, 32) : null,
        titulo: tit.slice(0, 500),
        notas: form.notas.trim() ? form.notas.trim().slice(0, 2000) : null,
        jid: form.jid.trim() || null,
        telefonoContacto: telC ? telC.slice(0, 40) : null,
        direccion: dir ? dir.slice(0, 500) : null,
        producto: prod ? prod.slice(0, 500) : null,
        kg: kg ?? null,
        actualizadoEn: serverTimestamp(),
      }
      if (editingId) {
        await updateDoc(doc(db, 'entregas_agenda', editingId), campos)
      } else {
        await addDoc(collection(db, 'entregas_agenda'), {
          ...campos,
          origen: 'panel',
          estado: 'pendiente',
          creadoEn: serverTimestamp(),
          /** El bot marca true tras enviar el aviso al grupo WA (panel General). */
          notificadoGrupoAgenda: false,
        })
      }
      cerrarModal()
    } catch (e) {
      console.error(e)
      alert(
        editingId
          ? 'No se pudo guardar los cambios. ¿Índice de Firestore pendiente o permisos?'
          : 'No se pudo guardar. ¿Índice de Firestore pendiente o permisos?',
      )
    } finally {
      setSaving(false)
    }
  }

  async function marcarEntrega(id: string, estado: 'hecha' | 'cancelada') {
    try {
      await updateDoc(doc(db, 'entregas_agenda', id), {
        estado,
        actualizadoEn: serverTimestamp(),
      })
    } catch (e) {
      console.error(e)
      alert('No se pudo actualizar.')
    }
  }

  async function marcarProgramadoEnviado(id: string) {
    try {
      await updateDoc(doc(db, 'mensajes_programados', id), {
        estado: 'enviado',
        actualizadoEn: serverTimestamp(),
      })
    } catch (e) {
      console.error(e)
      alert('No se pudo actualizar el recordatorio.')
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full">
      {agendaFirestoreError ? (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          <strong className="font-semibold">No se cargó el calendario de entregas.</strong>{' '}
          {agendaFirestoreError}
          <span className="block mt-1 text-red-700/90">
            Si dice “index”, creá el índice compuesto que sugiere la consola de Firebase o desplegá{' '}
            <code className="rounded bg-red-100 px-1">firebase/firestore.indexes.json</code>.
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-brand-600" />
            Agenda de entregas
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Entregas con fecha ([ENTREGA:…] desde Vicky o carga manual), recordatorios WhatsApp
            ([AGENDAR:…]) y pedidos en cola de leña sin día fijo en esta agenda. En cada evento podés
            guardar hora, dirección, teléfono de contacto y producto (también en CRM en la ficha
            Cliente).
          </p>
        </div>
        <button type="button" onClick={abrirModalNuevo} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nueva entrega / evento
        </button>
      </div>

      <div className="flex flex-wrap gap-4 text-xs mb-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1">
          <Package className="w-3.5 h-3.5" /> Entrega / obra
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1">
          <Bell className="w-3.5 h-3.5" /> Recordatorio WA
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 text-slate-700 px-2.5 py-1">
          <Truck className="w-3.5 h-3.5" /> Cola leña (abajo)
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <button
          type="button"
          className="btn-secondary p-2"
          onClick={() => {
            const n = subMonths(cursor, 1)
            setCursor(n)
            setSelected(startOfMonth(n))
          }}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800 capitalize">
          {format(cursor, 'MMMM yyyy', { locale: es })}
        </h2>
        <button
          type="button"
          className="btn-secondary p-2"
          onClick={() => {
            const n = addMonths(cursor, 1)
            setCursor(n)
            setSelected(startOfMonth(n))
          }}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="card p-4 overflow-x-auto">
          {loading && (
            <div className="flex justify-center py-12 text-slate-400 text-sm">Cargando…</div>
          )}
          <div className="grid grid-cols-7 gap-1 min-w-[520px]">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">
                {d}
              </div>
            ))}
            {gridDays.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const b = byDay[key]
              const nE = b?.entregas.length ?? 0
              const nP = b?.programados.length ?? 0
              const inMonth = isSameMonth(day, cursor)
              const sel = isSameDay(day, selected)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(day)}
                  className={cn(
                    'min-h-[72px] rounded-lg border p-1 text-left transition-colors',
                    inMonth ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 text-slate-400',
                    sel && 'ring-2 ring-brand-500 border-brand-400'
                  )}
                >
                  <div className="text-sm font-medium">{format(day, 'd')}</div>
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {nE > 0 && (
                      <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 rounded px-1">
                        {nE} ent.
                      </span>
                    )}
                    {nP > 0 && (
                      <span className="text-[10px] font-medium bg-amber-100 text-amber-800 rounded px-1">
                        {nP} rec.
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-slate-900 mb-1">
              {format(selected, "EEEE d 'de' MMMM", { locale: es })}
            </h3>
            <p className="text-xs text-slate-500 mb-3">{selectedKey}</p>
            {bucket.entregas.length === 0 && bucket.programados.length === 0 && (
              <p className="text-sm text-slate-400">Nada cargado para este día.</p>
            )}
            <ul className="space-y-3">
              {bucket.entregas.map((e) => (
                <li
                  key={e.id}
                  className={cn(
                    'rounded-lg border border-slate-100 p-3 text-sm',
                    e.estado === 'hecha' && 'opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 mb-1">
                        <Package className="w-3.5 h-3.5" /> Entrega
                      </span>
                      <p className="font-medium text-slate-800">{e.titulo}</p>
                      {(e.horaTexto || e.kg != null) && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {e.horaTexto ? `${e.horaTexto} hs` : ''}
                          {e.horaTexto && e.kg != null ? ' · ' : ''}
                          {e.kg != null ? `${e.kg} kg` : ''}
                        </p>
                      )}
                      {e.telefonoContacto && (
                        <p className="text-xs text-slate-600 mt-1">Contacto: {e.telefonoContacto}</p>
                      )}
                      {e.direccion && (
                        <p className="text-xs text-slate-600 mt-0.5">Dirección: {e.direccion}</p>
                      )}
                      {e.producto && (
                        <p className="text-xs text-slate-600 mt-0.5">Producto: {e.producto}</p>
                      )}
                      {e.notas && <p className="text-xs text-slate-600 mt-1">{e.notas}</p>}
                      {e.jid && (
                        <Link
                          href={`/chats/${encodeURIComponent(e.jid)}`}
                          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Chat
                        </Link>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      <button
                        type="button"
                        className="text-xs text-brand-600 hover:underline flex items-center gap-0.5"
                        onClick={() => abrirModalEditar(e)}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline flex items-center gap-0.5"
                        onClick={() => void eliminarEntregaEvento(e.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                      {e.estado === 'pendiente' && (
                        <>
                          <button
                            type="button"
                            className="text-xs text-green-700 hover:underline flex items-center gap-0.5"
                            onClick={() => marcarEntrega(e.id, 'hecha')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Hecha
                          </button>
                          <button
                            type="button"
                            className="text-xs text-slate-500 hover:underline flex items-center gap-0.5"
                            onClick={() => marcarEntrega(e.id, 'cancelada')}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
              {bucket.programados.map((p) => (
                <li key={p.id} className="rounded-lg border border-amber-100 bg-amber-50/40 p-3 text-sm">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 mb-1">
                    <Bell className="w-3.5 h-3.5" /> Recordatorio WA
                  </span>
                  {p.runAt && (
                    <p className="text-xs text-slate-500">{fmtHoraRunAt(p.runAt)} (envío programado)</p>
                  )}
                  <p className="text-slate-800 mt-1">{p.texto || '—'}</p>
                  <p className="text-[11px] text-slate-400 mt-1 truncate" title={p.jid}>
                    {p.jid}
                  </p>
                  {p.jid && (
                    <Link
                      href={`/chats/${encodeURIComponent(p.jid)}`}
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Chat
                    </Link>
                  )}
                  {p.estado === 'pendiente' && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-amber-800 hover:underline"
                      onClick={() => marcarProgramadoEnviado(p.id)}
                    >
                      Marcar como enviado (manual)
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4 text-slate-600" />
              Cola leña activa
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Pedidos ≤200 kg en cola (no tienen día en esta agenda hasta que coordines y cargues un evento).
            </p>
            {colaActiva.length === 0 ? (
              <p className="text-sm text-slate-400">Sin ítems en cola.</p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {colaActiva.map((c) => (
                  <li key={c.id} className="text-sm border-b border-slate-100 pb-2 last:border-0">
                    <p className="font-medium text-slate-800">{c.nombre || 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500">
                      {c.cantidadKg != null ? `${c.cantidadKg} kg` : '—'} · {c.zona || '—'}
                    </p>
                    {c.remoteJid && (
                      <Link
                        href={`/chats/${encodeURIComponent(c.remoteJid)}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Abrir chat
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/cola-lena" className="text-sm text-brand-600 hover:underline mt-3 inline-block">
              Ir a Cola de leña →
            </Link>
          </div>
        </div>
      </div>

      <div className="card p-4 mt-6 max-w-6xl">
        <h3 className="font-semibold text-slate-900 mb-1">Datos de entrega (registro bot)</h3>
        <p className="text-xs text-slate-500 mb-3">
          Se guarda cuando el cliente manda teléfono + dirección + franja y el modelo usa{' '}
          <code className="text-[11px]">[NOTIFICAR_DATOS_ENTREGA]</code> (o heurística). La ficha CRM queda en{' '}
          <code className="text-[11px]">clientes/…</code>; el día en el calendario con{' '}
          <code className="text-[11px]">[ENTREGA:…]</code> o evento manual arriba.
        </p>
        {datosEntregaReg.length === 0 ? (
          <p className="text-sm text-slate-400">Sin registros recientes.</p>
        ) : (
          <ul className="space-y-3 max-h-80 overflow-y-auto text-sm">
            {datosEntregaReg.map((r) => (
              <li key={r.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  {r.creadoEn && (
                    <span>{format(r.creadoEn.toDate(), "d MMM. yyyy HH:mm", { locale: es })}</span>
                  )}
                  {r.origen && <span>origen: {r.origen}</span>}
                  {r.telefonoLinea && <span>línea: {r.telefonoLinea}</span>}
                </div>
                {r.nombre && <p className="font-medium text-slate-800 mt-1">{r.nombre}</p>}
                <p className="text-slate-700 mt-1 whitespace-pre-wrap break-words">
                  {(r.mensajeCliente || '').slice(0, 600)}
                  {(r.mensajeCliente || '').length > 600 ? '…' : ''}
                </p>
                {r.jid && (
                  <Link
                    href={`/chats/${encodeURIComponent(r.jid)}`}
                    className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-2"
                  >
                    <ExternalLink className="w-3 h-3" /> Chat ({r.jid.length > 40 ? `${r.jid.slice(0, 40)}…` : r.jid})
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-lg text-slate-900">
              {editingId ? 'Editar entrega / evento' : 'Nueva entrega / evento'}
            </h3>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
              <p className="text-xs text-slate-600">
                Importar desde CRM: busca <code className="text-[11px]">clientes/…</code> y rellena JID,
                dirección, línea de contacto y borrador de producto.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="label text-xs">Tel. documento cliente</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="3516170743 o 549…"
                    value={crmTelImport}
                    onChange={(e) => setCrmTelImport(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary text-sm shrink-0"
                  disabled={importingCrm}
                  onClick={() => void importarDesdeCrm()}
                >
                  {importingCrm ? 'Buscando…' : 'Importar CRM'}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Día</label>
                <input
                  type="date"
                  className="input"
                  value={form.fechaDia}
                  onChange={(e) => setForm((f) => ({ ...f, fechaDia: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Hora (opcional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="09:00 o dejar vacío"
                  value={form.horaTexto}
                  onChange={(e) => setForm((f) => ({ ...f, horaTexto: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Título</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: 1 tn leña — Iván"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Kg (opcional)</label>
                <input
                  type="text"
                  className="input"
                  inputMode="decimal"
                  placeholder="1000"
                  value={form.kg}
                  onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">JID / chat (opcional)</label>
                <input
                  type="text"
                  className="input font-mono text-xs"
                  placeholder="549…@s.whatsapp.net o …@lid"
                  value={form.jid}
                  onChange={(e) => setForm((f) => ({ ...f, jid: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Tel. contacto entrega (opcional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Si difiere del WhatsApp o para llamar en puerta"
                  value={form.telefonoContacto}
                  onChange={(e) => setForm((f) => ({ ...f, telefonoContacto: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Dirección de entrega (opcional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Calle, número, referencias del día"
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Producto / características (opcional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: 1 tn leña quebracho, tipo hogar"
                  value={form.producto}
                  onChange={(e) => setForm((f) => ({ ...f, producto: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={cerrarModal}>
                  Cerrar
                </button>
                {editingId ? (
                  <button
                    type="button"
                    className="btn-secondary border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => void eliminarEntregaEvento(editingId)}
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void guardarEntrega()}
              >
                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
