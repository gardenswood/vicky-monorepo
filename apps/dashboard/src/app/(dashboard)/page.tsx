'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, limit, getDocs, Timestamp, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  MessageSquare,
  Users,
  FileText,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Leaf,
} from 'lucide-react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  LabelList,
} from 'recharts'
import { SERVICIO_LABELS, SERVICIO_COLORS, formatRelative } from '@/lib/utils'

interface KPI {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
}

interface ChatPreview {
  jid: string
  nombre?: string
  ultimoMensaje?: string
  ultimoMensajeAt?: Date
  estado?: string
  servicioPendiente?: string
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState({ mensajesHoy: 0, chatsActivos: 0, cotizaciones: 0, pedidos: 0 })
  const [mensajesPorDia, setMensajesPorDia] = useState<{ dia: string; total: number }[]>([])
  const [distribucion, setDistribucion] = useState<{ nombre: string; valor: number; color: string }[]>([])
  const [funnel, setFunnel] = useState<{ etapa: string; cantidad: number; pct: number }[]>([])
  const [recentChats, setRecentChats] = useState<ChatPreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
    const chatsRef = collection(db, 'chats')
    const q = query(chatsRef, orderBy('ultimoMensajeAt', 'desc'), limit(5))
    const unsub = onSnapshot(q, (snap) => {
      const chats: ChatPreview[] = snap.docs.map((doc) => {
        const d = doc.data()
        return {
          jid: doc.id,
          nombre: d.nombre,
          ultimoMensaje: d.ultimoMensaje,
          ultimoMensajeAt: d.ultimoMensajeAt?.toDate(),
          estado: d.estado,
          servicioPendiente: d.servicioPendiente,
        }
      })
      setRecentChats(chats)
    })
    return () => unsub()
  }, [])

  async function loadStats() {
    try {
      const today = startOfDay(new Date())
      const todayEnd = endOfDay(new Date())

      const mensHoyQ = query(
        collection(db, 'mensajes_log'),
        where('timestamp', '>=', Timestamp.fromDate(today)),
        where('timestamp', '<=', Timestamp.fromDate(todayEnd))
      )
      const mensHoySnap = await getDocs(mensHoyQ)

      const ayer = subDays(new Date(), 1)
      const chatsQ = query(collection(db, 'chats'), where('ultimoMensajeAt', '>=', Timestamp.fromDate(ayer)))
      const chatsSnap = await getDocs(chatsQ)

      const cotQ = query(collection(db, 'clientes'), where('estado', 'in', ['cotizacion_enviada', 'confirmado', 'cliente']))
      const cotSnap = await getDocs(cotQ)

      const pedQ = query(collection(db, 'clientes'), where('estado', 'in', ['confirmado', 'cliente']))
      const pedSnap = await getDocs(pedQ)

      setKpis({ mensajesHoy: mensHoySnap.size, chatsActivos: chatsSnap.size, cotizaciones: cotSnap.size, pedidos: pedSnap.size })

      const days: { dia: string; total: number }[] = []
      for (let i = 6; i >= 0; i--) {
        const day = subDays(new Date(), i)
        const qDay = query(
          collection(db, 'mensajes_log'),
          where('timestamp', '>=', Timestamp.fromDate(startOfDay(day))),
          where('timestamp', '<=', Timestamp.fromDate(endOfDay(day)))
        )
        const snap = await getDocs(qDay)
        days.push({ dia: format(day, 'EEE', { locale: es }), total: snap.size })
      }
      setMensajesPorDia(days)

      const allClientes = await getDocs(collection(db, 'clientes'))
      const servicioCount: Record<string, number> = {}
      allClientes.forEach((doc) => {
        const s = doc.data().servicioPendiente
        if (s) servicioCount[s] = (servicioCount[s] || 0) + 1
      })
      setDistribucion(Object.entries(servicioCount).map(([id, valor]) => ({
        nombre: SERVICIO_LABELS[id] || id,
        valor,
        color: SERVICIO_COLORS[id] || '#6b7280',
      })))

      const allClientesData = allClientes.docs.map((d) => d.data())
      const funnelData = [
        { etapa: 'Primer contacto', cantidad: allClientes.size },
        { etapa: 'Cotización enviada', cantidad: allClientesData.filter((c) => ['cotizacion_enviada', 'confirmado', 'cliente'].includes(c.estado)).length },
        { etapa: 'Confirmados', cantidad: allClientesData.filter((c) => ['confirmado', 'cliente'].includes(c.estado)).length },
        { etapa: 'Clientes', cantidad: allClientesData.filter((c) => c.estado === 'cliente').length },
      ]
      const total = funnelData[0].cantidad || 1
      setFunnel(funnelData.map((f) => ({ ...f, pct: Math.round((f.cantidad / total) * 100) })))
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const kpiCards: KPI[] = [
    { label: 'Mensajes hoy', value: kpis.mensajesHoy, icon: <MessageSquare className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
    { label: 'Chats activos (24h)', value: kpis.chatsActivos, icon: <Users className="w-5 h-5" />, color: 'text-brand-600 bg-brand-50' },
    { label: 'Cotizaciones enviadas', value: kpis.cotizaciones, icon: <FileText className="w-5 h-5" />, color: 'text-amber-600 bg-amber-50' },
    { label: 'Pedidos confirmados', value: kpis.pedidos, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-emerald-600 bg-emerald-50' },
  ]

  const estadoBadge = (estado?: string) => {
    const map: Record<string, string> = { nuevo: 'bg-slate-100 text-slate-600', cotizacion_enviada: 'bg-blue-100 text-blue-700', confirmado: 'bg-green-100 text-green-700', cliente: 'bg-brand-100 text-brand-700', silenciado: 'bg-orange-100 text-orange-700' }
    const labels: Record<string, string> = { nuevo: 'Nuevo', cotizacion_enviada: 'Cotización', confirmado: 'Confirmado', cliente: 'Cliente', silenciado: 'Humano' }
    return <span className={`badge ${map[estado ?? 'nuevo'] ?? map.nuevo}`}>{labels[estado ?? 'nuevo'] ?? estado}</span>
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-200 rounded-xl" />)}</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 h-64 bg-slate-200 rounded-xl" />
            <div className="h-64 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Leaf className="w-5 h-5 text-brand-600" />
            <span className="text-sm text-brand-600 font-medium">Gardens Wood</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
        </div>
        <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-brand-700">Bot activo</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
              <ArrowUpRight className="w-4 h-4 text-slate-300" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{kpi.value}</p>
            <p className="text-sm text-slate-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-slate-900">Mensajes por día</h3>
              <p className="text-xs text-slate-500 mt-0.5">Últimos 7 días</p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          {mensajesPorDia.length > 0 && mensajesPorDia.some(d => d.total > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={mensajesPorDia} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} labelStyle={{ fontWeight: 600 }} />
                <Area type="monotone" dataKey="total" stroke="#16a34a" strokeWidth={2} fill="url(#colorTotal)" name="Mensajes" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Sin datos aún — los mensajes aparecerán cuando el bot esté conectado a Firestore</div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Por servicio</h3>
          <p className="text-xs text-slate-500 mb-4">Distribución de consultas</p>
          {distribucion.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={distribucion} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="valor" paddingAngle={3}>
                  {distribucion.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Legend formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm text-center">Sin datos aún</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Embudo de conversión</h3>
          <p className="text-xs text-slate-500 mb-4">Total de clientes por etapa</p>
          {funnel.length > 0 && funnel[0].cantidad > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 10, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="etapa" width={110} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="cantidad" fill="#16a34a" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="cantidad" position="right" style={{ fontSize: 12, fill: '#475569' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm text-center">Sin datos aún</div>
          )}
        </div>

        <div className="card p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Chats recientes</h3>
              <p className="text-xs text-slate-500 mt-0.5">Última actividad</p>
            </div>
            <a href="/chats" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Ver todos →</a>
          </div>
          {recentChats.length > 0 ? (
            <div className="space-y-2">
              {recentChats.map((chat) => (
                <a key={chat.jid} href={`/chats/${encodeURIComponent(chat.jid)}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-700 text-sm font-semibold">{chat.nombre ? chat.nombre[0].toUpperCase() : '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900 truncate">{chat.nombre || chat.jid.replace('@s.whatsapp.net', '')}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0 ml-2">
                        <Clock className="w-3 h-3" />
                        {formatRelative(chat.ultimoMensajeAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-500 truncate flex-1">{chat.ultimoMensaje}</p>
                      {estadoBadge(chat.estado)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <MessageSquare className="w-8 h-8 text-slate-300" />
              <p>Los chats aparecerán aquí en tiempo real</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
