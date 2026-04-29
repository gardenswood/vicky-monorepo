'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Truck, Package, MapPin, Clock, CheckCircle2, AlertTriangle, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn, formatRelative } from '@/lib/utils'

interface PedidoLena {
  id: string
  remoteJid: string
  nombre: string
  direccion: string
  zona?: string
  cantidadKg: number
  fechaPedido?: Date
  estado: 'en_cola' | 'notificado' | 'entregado'
}

const ESTADO_CONFIG = {
  en_cola: { label: 'En cola', color: 'bg-blue-100 text-blue-700', icon: <Package className="w-3.5 h-3.5" /> },
  notificado: { label: 'Notificado', color: 'bg-amber-100 text-amber-700', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
}

export default function ColaLenaPage() {
  const [pedidos, setPedidos] = useState<PedidoLena[]>([])
  const [loading, setLoading] = useState(true)
  const [capKg, setCapKg] = useState(1000)

  useEffect(() => {
    const ref = doc(db, 'config', 'general')
    const unsub = onSnapshot(ref, (snap) => {
      const v = snap.data()?.colaLenaCapacidadCamionKg
      const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
      if (Number.isFinite(n) && n >= 200) setCapKg(Math.round(n))
      else setCapKg(1000)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'colaLena'), orderBy('fechaPedido', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      const data: PedidoLena[] = snap.docs.map((d) => ({
        id: d.id,
        remoteJid: d.data().remoteJid || '',
        nombre: d.data().nombre || 'Sin nombre',
        direccion: d.data().direccion || '',
        zona: d.data().zona,
        cantidadKg: d.data().cantidadKg || 0,
        fechaPedido: d.data().fechaPedido?.toDate(),
        estado: d.data().estado || 'en_cola',
      }))
      setPedidos(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  async function cambiarEstado(id: string, nuevoEstado: PedidoLena['estado']) {
    await updateDoc(doc(db, 'colaLena', id), { estado: nuevoEstado })
  }

  const enCola = pedidos.filter((p) => p.estado === 'en_cola')
  const totalKg = enCola.reduce((sum, p) => sum + p.cantidadKg, 0)
  const pctCapacidad = Math.min(Math.round((totalKg / capKg) * 100), 100)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cola logística de leña</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Pedidos agrupados para entrega grupal (≤200kg por pedido)
          </p>
        </div>
      </div>

      {/* Capacity bar */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-slate-900">Capacidad del vehículo</p>
            <p className="text-sm text-slate-500">{enCola.length} pedidos en cola · {totalKg} kg acumulados</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">{totalKg} <span className="text-sm font-normal text-slate-500">/ {capKg} kg</span></p>
            <p className={cn('text-sm font-medium', pctCapacidad >= 90 ? 'text-red-600' : pctCapacidad >= 60 ? 'text-amber-600' : 'text-brand-600')}>
              {pctCapacidad}% de capacidad
            </p>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className={cn('h-3 rounded-full transition-all', pctCapacidad >= 90 ? 'bg-red-500' : pctCapacidad >= 60 ? 'bg-amber-500' : 'bg-brand-600')}
            style={{ width: `${pctCapacidad}%` }}
          />
        </div>
        {pctCapacidad >= 80 && (
          <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            El camión está casi lleno. Considerá programar una salida de entrega.
          </div>
        )}
      </div>

      {/* Estado tabs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {Object.entries(ESTADO_CONFIG).map(([key, cfg]) => {
          const count = pedidos.filter((p) => p.estado === key).length
          return (
            <div key={key} className="card p-4 flex items-center gap-3">
              <span className={cn('badge flex items-center gap-1', cfg.color)}>
                {cfg.icon} {cfg.label}
              </span>
              <span className="text-2xl font-bold text-slate-900 ml-auto">{count}</span>
            </div>
          )
        })}
      </div>

      {/* Pedidos list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : pedidos.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Cola vacía</p>
            <p className="text-slate-400 text-sm mt-1">Los pedidos de leña ≤200kg aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pedidos.map((pedido) => {
              const cfg = ESTADO_CONFIG[pedido.estado]
              return (
                <div key={pedido.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-slate-900">{pedido.nombre}</p>
                      <span className={cn('badge text-xs flex items-center gap-1', cfg.color)}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" /> {pedido.cantidadKg} kg
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {pedido.direccion}
                      </span>
                      {pedido.zona && <span>{pedido.zona}</span>}
                      {pedido.fechaPedido && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatRelative(pedido.fechaPedido)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <a
                        href={`/chats/${encodeURIComponent(pedido.remoteJid)}`}
                        className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        {pedido.remoteJid.replace('@s.whatsapp.net', '')}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {pedido.estado === 'en_cola' && (
                      <button
                        onClick={() => cambiarEstado(pedido.id, 'notificado')}
                        className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                      >
                        Notificar
                      </button>
                    )}
                    {pedido.estado === 'notificado' && (
                      <button
                        onClick={() => cambiarEstado(pedido.id, 'entregado')}
                        className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded hover:bg-green-100 transition-colors"
                      >
                        Marcar entregado
                      </button>
                    )}
                    {pedido.estado === 'entregado' && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
