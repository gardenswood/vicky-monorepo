'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  ArrowLeft,
  Bot,
  User,
  Phone,
  MapPin,
  Package,
  Clock,
  BellOff,
  Bell,
  Mic,
  Image as ImageIcon,
  FileText,
  ExternalLink,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn, SERVICIO_LABELS, ESTADO_LABELS, ESTADO_COLORS, formatRelative } from '@/lib/utils'

interface Mensaje {
  id: string
  contenido: string
  tipo: 'texto' | 'audio' | 'imagen' | 'video' | 'documento'
  direccion: 'entrante' | 'saliente'
  timestamp: Date
  marcadores?: string[]
  servicio?: string
}

interface ChatInfo {
  jid: string
  tel: string
  nombre?: string
  estado?: string
  servicioPendiente?: string
  humanoAtendiendo?: boolean
  direccion?: string
  zona?: string
  metodoPago?: string
  pedidosAnteriores?: { servicio: string; descripcion: string; fecha?: Date }[]
}

export default function ChatDetailPage() {
  const { chatId } = useParams<{ chatId: string }>()
  const router = useRouter()
  const jid = decodeURIComponent(chatId)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    // Load chat info
    const chatRef = doc(db, 'chats', jid)
    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        setChatInfo({
          jid,
          tel: d.tel || jid.replace('@s.whatsapp.net', ''),
          nombre: d.nombre,
          estado: d.estado,
          servicioPendiente: d.servicioPendiente,
          humanoAtendiendo: d.humanoAtendiendo,
          direccion: d.direccion,
          zona: d.zona,
          metodoPago: d.metodoPago,
          pedidosAnteriores: d.pedidosAnteriores || [],
        })
      }
    })

    // Load messages in real-time
    const mensajesRef = collection(db, 'chats', jid, 'mensajes')
    const q = query(mensajesRef, orderBy('timestamp', 'asc'))
    const unsubMensajes = onSnapshot(q, (snap) => {
      const data: Mensaje[] = snap.docs.map((d) => ({
        id: d.id,
        contenido: d.data().contenido || '',
        tipo: d.data().tipo || 'texto',
        direccion: d.data().direccion || 'entrante',
        timestamp: d.data().timestamp?.toDate() ?? new Date(),
        marcadores: d.data().marcadores,
        servicio: d.data().servicio,
      }))
      setMensajes(data)
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })

    return () => {
      unsubChat()
      unsubMensajes()
    }
  }, [jid])

  async function toggleBotSilencio() {
    if (!chatInfo) return
    setToggling(true)
    try {
      const chatRef = doc(db, 'chats', jid)
      await updateDoc(chatRef, {
        humanoAtendiendo: !chatInfo.humanoAtendiendo,
        silenciadoHasta: !chatInfo.humanoAtendiendo
          ? Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
          : null,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setToggling(false)
    }
  }

  function groupByDate(msgs: Mensaje[]) {
    const groups: { date: string; messages: Mensaje[] }[] = []
    msgs.forEach((msg) => {
      const dateStr = format(msg.timestamp, 'dd/MM/yyyy')
      const last = groups[groups.length - 1]
      if (!last || last.date !== dateStr) {
        groups.push({ date: dateStr, messages: [msg] })
      } else {
        last.messages.push(msg)
      }
    })
    return groups
  }

  const MensajeIcon = ({ tipo }: { tipo: string }) => {
    if (tipo === 'audio') return <Mic className="w-3.5 h-3.5" />
    if (tipo === 'imagen') return <ImageIcon className="w-3.5 h-3.5" />
    if (tipo === 'documento') return <FileText className="w-3.5 h-3.5" />
    return null
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const groups = groupByDate(mensajes)

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-brand-700 font-semibold">
            {chatInfo?.nombre?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">
              {chatInfo?.nombre || chatInfo?.tel || 'Cliente'}
            </h2>
            {chatInfo?.humanoAtendiendo && (
              <span className="badge bg-orange-100 text-orange-700 text-xs">
                <User className="w-3 h-3 mr-1" /> Humano atendiendo
              </span>
            )}
            {chatInfo?.estado && (
              <span className={cn('badge text-xs', ESTADO_COLORS[chatInfo.estado] ?? 'bg-slate-100 text-slate-600')}>
                {ESTADO_LABELS[chatInfo.estado] ?? chatInfo.estado}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {chatInfo?.tel} · {mensajes.length} mensajes
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* WhatsApp link */}
          <a
            href={`https://wa.me/${chatInfo?.tel}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir WA
          </a>

          {/* Toggle bot silence */}
          <button
            onClick={toggleBotSilencio}
            disabled={toggling}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              chatInfo?.humanoAtendiendo
                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
            )}
          >
            {chatInfo?.humanoAtendiendo ? (
              <><Bell className="w-4 h-4" /> Reactivar bot</>
            ) : (
              <><BellOff className="w-4 h-4" /> Silenciar bot</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-4 space-y-1">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
              <Bot className="w-8 h-8 text-slate-300" />
              <p>Sin mensajes registrados</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.date} className="space-y-2">
                {/* Date separator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium px-3 py-1 bg-slate-100 rounded-full">
                    {group.date}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {group.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex animate-in', msg.direccion === 'saliente' ? 'justify-end' : 'justify-start')}
                  >
                    <div>
                      {msg.direccion === 'entrante' && (
                        <div className="flex items-center gap-1 mb-1 ml-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-400">
                            {chatInfo?.nombre || 'Cliente'}
                          </span>
                        </div>
                      )}
                      {msg.direccion === 'saliente' && (
                        <div className="flex items-center gap-1 mb-1 mr-1 justify-end">
                          <Bot className="w-3 h-3 text-brand-500" />
                          <span className="text-xs text-brand-500">Vicky</span>
                        </div>
                      )}
                      <div className={cn(msg.direccion === 'saliente' ? 'bubble-out' : 'bubble-in')}>
                        {msg.tipo !== 'texto' && (
                          <div className="flex items-center gap-1.5 mb-1 opacity-70 text-xs">
                            <MensajeIcon tipo={msg.tipo} />
                            <span className="capitalize">{msg.tipo}</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.contenido}</p>
                        {msg.marcadores && msg.marcadores.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {msg.marcadores.map((m, i) => (
                              <span key={i} className="text-xs bg-black/10 rounded px-1.5 py-0.5 font-mono">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className={cn(
                          'text-xs mt-1.5',
                          msg.direccion === 'saliente' ? 'text-white/60 text-right' : 'text-slate-400'
                        )}>
                          {format(msg.timestamp, 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Client info panel */}
        <div className="w-72 bg-white border-l border-slate-200 overflow-y-auto flex-shrink-0 p-5 space-y-5">
          <h3 className="font-semibold text-slate-900 text-sm">Info del cliente</h3>

          <div className="space-y-3">
            <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Teléfono" value={chatInfo?.tel} />
            <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Dirección" value={chatInfo?.direccion} />
            <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Zona" value={chatInfo?.zona} />
            <InfoRow icon={<Package className="w-3.5 h-3.5" />} label="Servicio" value={chatInfo?.servicioPendiente ? SERVICIO_LABELS[chatInfo.servicioPendiente] : undefined} />
            <InfoRow icon={<FileText className="w-3.5 h-3.5" />} label="Pago" value={chatInfo?.metodoPago} />
          </div>

          {chatInfo?.pedidosAnteriores && chatInfo.pedidosAnteriores.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pedidos</p>
              <div className="space-y-2">
                {chatInfo.pedidosAnteriores.map((p, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-700">{SERVICIO_LABELS[p.servicio] ?? p.servicio}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.descripcion}</p>
                    {p.fecha && (
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelative(p.fecha)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <a
              href={`/clientes/${encodeURIComponent(chatInfo?.tel ?? '')}`}
              className="btn-secondary w-full text-center block text-xs"
            >
              Ver perfil completo
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <div className="text-slate-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm text-slate-700 font-medium">{value}</p>
      </div>
    </div>
  )
}
