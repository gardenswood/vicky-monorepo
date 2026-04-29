'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  SlidersHorizontal,
  Save,
  CheckCircle2,
  AlertCircle,
  Bot,
  Clock,
  Power,
  Info,
  Phone,
  Tag,
  Truck,
  MapPin,
} from 'lucide-react'

interface ConfigGeneral {
  delayMinSeg: number
  delayMaxSeg: number
  modeloGemini: string
  frecuenciaAudioFidelizacion: number
  tiempoSilencioHumanoHoras: number
  botActivo: boolean
  /** Si es false, Vicky no responde DMs de Instagram (WhatsApp sigue según botActivo). */
  instagramDmActivo: boolean
  adminPhone: string
  horaAtencionDesde: string
  horaAtencionHasta: string
  /** ID interno de etiqueta WhatsApp Business (no el nombre). Handoff a asesor. */
  whatsappLabelIdContactarAsesor: string
  /** WhatsApp operación: recibe copia del mensaje del cliente cuando envía teléfono + dirección + horario (marcador [NOTIFICAR_DATOS_ENTREGA] en respuesta Vicky). */
  datosEntregaNotifyPhone: string
  campanaDelayMinSeg: number
  campanaDelayMaxSeg: number
  campanaMaxDestinatarios: number
  campanaDescuentoPct: number
  /** Texto para {fechaTexto} en mensajes #RUTA personalizados */
  campanaRutaFechaTexto?: string
  /** Placeholders: {nombre} {zona} {producto} {fechaTexto} {pct} {tipoCliente} */
  campanaRutaPlantilla?: string
  /** Cron HTTP geocode: si false, POST /internal/cron/geocode-clientes no escribe Firestore. */
  geocodeCronActivo?: boolean
  /** Máximo de clientes a geocodificar por ejecución del cron (panel + servidor cap 80). */
  geocodeCronMaxPorEjecucion?: number
  /** JID del grupo WhatsApp (…@g.us) para avisar cada alta en agenda de entregas. Vacío = no enviar. */
  whatsappGrupoJidAgendaEntregas?: string
  /** Si es false, no se envían avisos al grupo aunque haya JID. */
  notificarAgendaEntregasGrupoActivo?: boolean
}

const DEFAULT_CONFIG: ConfigGeneral = {
  delayMinSeg: 5,
  delayMaxSeg: 10,
  modeloGemini: 'gemini-2.5-flash',
  frecuenciaAudioFidelizacion: 4,
  tiempoSilencioHumanoHoras: 24,
  botActivo: true,
  instagramDmActivo: true,
  adminPhone: '',
  horaAtencionDesde: '08:00',
  horaAtencionHasta: '17:00',
  whatsappLabelIdContactarAsesor: '',
  datosEntregaNotifyPhone: '',
  campanaDelayMinSeg: 15,
  campanaDelayMaxSeg: 20,
  campanaMaxDestinatarios: 40,
  campanaDescuentoPct: 10,
  campanaRutaFechaTexto: 'mañana',
  campanaRutaPlantilla:
    'Hola {nombre}! Te cuento que {fechaTexto} vamos a estar por la zona *{zona}* y quería saber si necesitás *{producto}*, así aprovechás el flete sin cargo. Cualquier cosa escribime. — Vicky, Gardens Wood',
  geocodeCronActivo: true,
  geocodeCronMaxPorEjecucion: 30,
  whatsappGrupoJidAgendaEntregas: '',
  notificarAgendaEntregasGrupoActivo: true,
}

const MODELOS_GEMINI = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (recomendado, rápido)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (más inteligente, más lento)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (estable)' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (legacy)' },
]

export default function ConfigGeneralPage() {
  const [config, setConfig] = useState<ConfigGeneral>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const snap = await getDoc(doc(db, 'config', 'general'))
      if (snap.exists()) {
        setConfig({ ...DEFAULT_CONFIG, ...snap.data() })
      }
    } catch {
      setError('Error al cargar la configuración')
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    setSaving(true)
    setError('')
    try {
      // merge: true evita borrar campos si el estado local alguna vez quedó incompleto (p. ej. JID del grupo agenda).
      await setDoc(
        doc(db, 'config', 'general'),
        {
          ...config,
          ultimaActualizacion: serverTimestamp(),
        },
        { merge: true },
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  function update(changes: Partial<ConfigGeneral>) {
    setConfig((prev) => ({ ...prev, ...changes }))
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <SlidersHorizontal className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Configuración general</h1>
            <p className="text-slate-500 text-sm">Ajustes de comportamiento del bot</p>
          </div>
        </div>
        <button onClick={saveConfig} disabled={saving} className="btn-primary flex items-center gap-1.5">
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="space-y-5">
        {/* Bot status */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Power className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Estado del bot</h2>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-900">Bot activo</p>
              <p className="text-xs text-slate-500">
                Cuando está inactivo, el bot no responde a nadie. Equivale a *#silencio global* por WhatsApp admin;
                para reactivar también *#activo global* o *#vicky activa*.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.botActivo}
                onChange={(e) => update({ botActivo: e.target.checked })}
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${config.botActivo ? 'bg-brand-600' : 'bg-slate-300'} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full`} />
            </label>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg mt-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Respuestas por Instagram DM</p>
              <p className="text-xs text-slate-500">
                Si está desactivado, Vicky no contesta mensajes directos de Instagram (Meta). WhatsApp sigue según &quot;Bot activo&quot; arriba.
                Requiere webhook y variables en Cloud Run; ver runbook del repo del bot (§ Instagram).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.instagramDmActivo !== false}
                onChange={(e) => update({ instagramDmActivo: e.target.checked })}
              />
              <div
                className={`w-11 h-6 rounded-full transition-colors ${config.instagramDmActivo !== false ? 'bg-brand-600' : 'bg-slate-300'} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full`}
              />
            </label>
          </div>
        </div>

        {/* Response delay */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Delay de respuesta</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Tiempo de espera antes de responder (simula escritura humana)
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Mínimo (segundos)</label>
              <input
                type="number"
                className="input"
                min={1}
                max={60}
                value={config.delayMinSeg}
                onChange={(e) => update({ delayMinSeg: parseInt(e.target.value) || 5 })}
              />
              <input
                type="range"
                min={1}
                max={60}
                value={config.delayMinSeg}
                onChange={(e) => update({ delayMinSeg: parseInt(e.target.value) })}
                className="w-full mt-2 accent-brand-600"
              />
            </div>
            <div>
              <label className="label">Máximo (segundos)</label>
              <input
                type="number"
                className="input"
                min={1}
                max={120}
                value={config.delayMaxSeg}
                onChange={(e) => update({ delayMaxSeg: parseInt(e.target.value) || 15 })}
              />
              <input
                type="range"
                min={1}
                max={120}
                value={config.delayMaxSeg}
                onChange={(e) => update({ delayMaxSeg: parseInt(e.target.value) })}
                className="w-full mt-2 accent-brand-600"
              />
            </div>
          </div>
          <div className="mt-3 bg-blue-50 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              El bot espera entre {config.delayMinSeg}s y {config.delayMaxSeg}s antes de responder. 
              Recomendado: 8-15 segundos para parecer natural.
            </p>
          </div>
        </div>

        {/* AI Model */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Bot className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Modelo de IA</h2>
          </div>
          <div>
            <label className="label">Modelo Gemini</label>
            <select
              className="input"
              value={config.modeloGemini}
              onChange={(e) => update({ modeloGemini: e.target.value })}
            >
              {MODELOS_GEMINI.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Human takeover */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Control humano</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Silencio cuando humano atiende (horas)</label>
              <input
                type="number"
                className="input"
                min={1}
                max={168}
                value={config.tiempoSilencioHumanoHoras}
                onChange={(e) => update({ tiempoSilencioHumanoHoras: parseInt(e.target.value) || 24 })}
              />
              <p className="text-xs text-slate-500 mt-1">
                El bot se silencia {config.tiempoSilencioHumanoHoras}h cuando el dueño responde desde el teléfono
              </p>
            </div>
            <div>
              <label className="label">Frecuencia audio fidelización</label>
              <input
                type="number"
                className="input"
                min={1}
                max={20}
                value={config.frecuenciaAudioFidelizacion}
                onChange={(e) => update({ frecuenciaAudioFidelizacion: parseInt(e.target.value) || 4 })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Envía audio de fidelización cada {config.frecuenciaAudioFidelizacion} mensajes de texto
              </p>
            </div>
          </div>
        </div>

        {/* WhatsApp Business labels */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Tag className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Etiquetas WhatsApp Business</h2>
          </div>
          <div>
            <label className="label">ID de etiqueta “Contactar asesor” (handoff)</label>
            <input
              type="text"
              className="input font-mono text-sm"
              placeholder="ej. 2 o el id que muestre la consola con VICKY_LOG_LABELS"
              value={config.whatsappLabelIdContactarAsesor}
              onChange={(e) => update({ whatsappLabelIdContactarAsesor: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-2">
              Creá en WhatsApp Business una etiqueta llamada por ejemplo <strong>Contactar asesor</strong>. El bot la aplica al chat cuando Vicky hace traspaso a humano (<code className="bg-slate-100 px-1 rounded">[HANDOFF_EXPERTO:…]</code>).
              El valor acá es el <strong>ID interno</strong> de la etiqueta, no el nombre. En la PC, con <strong>node bot.js apagado</strong>, en la carpeta del bot ejecutá{' '}
              <code className="bg-slate-100 px-1 rounded">npm run labels:discover</code> y copiá el <code className="bg-slate-100 px-1 rounded">id=&quot;…&quot;</code> que coincida con tu etiqueta. Alternativa: <code className="bg-slate-100 px-1 rounded">VICKY_LOG_LABELS=1</code> y consola al arrancar el bot.
              Tras guardar, hacé <strong>redeploy</strong> de <code className="bg-slate-100 px-1 rounded">vicky-bot</code>. Cuenta WhatsApp Business vinculada al bot.
            </p>
          </div>
        </div>

        {/* Campañas #RUTA y avisos #ENVIAR (Baileys) */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Truck className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Campañas (#RUTA) y avisos masivos (#enviar)</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Mismos límites para <code className="bg-slate-100 px-1">#ruta ZONA PRODUCTO</code> y para{' '}
            <code className="bg-slate-100 px-1">#enviar clientes …</code> / <code className="bg-slate-100 px-1">#enviar leña …</code> desde WhatsApp admin.
            Delay entre mensajes para reducir riesgo de bloqueo. Twilio opcional (#RUTA):{' '}
            <code className="bg-slate-100 px-1">CAMPANA_USE_TWILIO=1</code> y plantilla en Cloud Run.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Delay mínimo (seg)</label>
              <input
                type="number"
                className="input"
                min={5}
                max={120}
                value={config.campanaDelayMinSeg}
                onChange={(e) => update({ campanaDelayMinSeg: parseInt(e.target.value) || 15 })}
              />
            </div>
            <div>
              <label className="label">Delay máximo (seg)</label>
              <input
                type="number"
                className="input"
                min={5}
                max={180}
                value={config.campanaDelayMaxSeg}
                onChange={(e) => update({ campanaDelayMaxSeg: parseInt(e.target.value) || 20 })}
              />
            </div>
            <div>
              <label className="label">Máx. destinatarios por campaña</label>
              <input
                type="number"
                className="input"
                min={5}
                max={200}
                value={config.campanaMaxDestinatarios}
                onChange={(e) => update({ campanaMaxDestinatarios: parseInt(e.target.value) || 40 })}
              />
            </div>
            <div>
              <label className="label">% descuento en texto de campaña</label>
              <input
                type="number"
                className="input"
                min={0}
                max={50}
                value={config.campanaDescuentoPct}
                onChange={(e) => update({ campanaDescuentoPct: parseInt(e.target.value) || 10 })}
              />
              <p className="text-xs text-slate-500 mt-1">Usá {"{pct}"} en la plantilla si querés mencionarlo.</p>
            </div>
            <div className="col-span-2">
              <label className="label">#RUTA — texto de fecha (ej. mañana, el jueves)</label>
              <input
                type="text"
                className="input"
                value={config.campanaRutaFechaTexto ?? 'mañana'}
                onChange={(e) => update({ campanaRutaFechaTexto: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">Reemplaza el placeholder {"{fechaTexto}"} en cada mensaje.</p>
            </div>
            <div className="col-span-2">
              <label className="label">#RUTA — plantilla del mensaje (Baileys / fuera de plantilla Twilio)</label>
              <textarea
                className="input font-mono text-sm min-h-[100px]"
                value={config.campanaRutaPlantilla ?? DEFAULT_CONFIG.campanaRutaPlantilla}
                onChange={(e) => update({ campanaRutaPlantilla: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Placeholders: <code className="bg-slate-100 px-1">{"{nombre}"}</code>,{' '}
                <code className="bg-slate-100 px-1">{"{zona}"}</code>, <code className="bg-slate-100 px-1">{"{producto}"}</code>,{' '}
                <code className="bg-slate-100 px-1">{"{fechaTexto}"}</code>, <code className="bg-slate-100 px-1">{"{pct}"}</code>,{' '}
                <code className="bg-slate-100 px-1">{"{tipoCliente}"}</code> (ej. leña hogar). Comando WhatsApp:{' '}
                <code className="bg-slate-100 px-1">#ruta villa lena parrilla</code> — el último token opcional filtra tipo de leña en CRM.
              </p>
            </div>
          </div>
        </div>

        {/* Geocodificación automática (mapa / #ruta_geo) */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Geocodificación automática (mapa)</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Cloud Scheduler puede llamar cada noche (o varias veces al día) a{' '}
            <code className="bg-slate-100 px-1 rounded">POST …/internal/cron/geocode-clientes</code> con el mismo{' '}
            <code className="bg-slate-100 px-1 rounded">Bearer</code> que los otros crons (ver runbook del bot). Rellena{' '}
            <code className="bg-slate-100 px-1 rounded">lat</code> / <code className="bg-slate-100 px-1 rounded">lng</code> en
            fichas con <code className="bg-slate-100 px-1 rounded">direccion</code> vía OpenStreetMap Nominatim (~1 req/s).
          </p>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-900">Cron geocode activo</p>
              <p className="text-xs text-slate-500">
                Si lo apagás, el endpoint sigue respondiendo pero no actualiza coordenadas (útil para pausar sin borrar el job en Google Cloud).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.geocodeCronActivo !== false}
                onChange={(e) => update({ geocodeCronActivo: e.target.checked })}
              />
              <div
                className={`w-11 h-6 rounded-full transition-colors ${config.geocodeCronActivo !== false ? 'bg-brand-600' : 'bg-slate-300'} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full`}
              />
            </label>
          </div>
          <div className="mt-4">
            <label className="label">Máximo de clientes por ejecución del cron</label>
            <input
              type="number"
              className="input max-w-xs"
              min={1}
              max={80}
              value={config.geocodeCronMaxPorEjecucion ?? 30}
              onChange={(e) =>
                update({ geocodeCronMaxPorEjecucion: parseInt(e.target.value, 10) || 30 })
              }
            />
            <p className="text-xs text-slate-500 mt-1">
              Tope en servidor: 80 por llamada. Para lotes mayores usá en la PC{' '}
              <code className="bg-slate-100 px-1 rounded">npm run geocode:clientes -- --max=200</code>.
            </p>
          </div>
        </div>

        {/* Contact & schedule */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Phone className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Contacto y horarios</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Teléfono del admin (solo números, sin +)</label>
              <input
                type="text"
                className="input"
                placeholder="5493514000000"
                value={config.adminPhone}
                onChange={(e) => update({ adminPhone: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Número que recibe notificaciones de la cola de leña y puede usar comandos admin
              </p>
            </div>
            <div className="col-span-2">
              <label className="label">WhatsApp operación — datos de entrega (solo números)</label>
              <input
                type="text"
                className="input"
                placeholder="5493512956376"
                value={config.datosEntregaNotifyPhone}
                onChange={(e) => update({ datosEntregaNotifyPhone: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Cuando el cliente manda en un mensaje teléfono, dirección y horario de entrega, Vicky reenvía ese texto acá. Si lo dejás vacío, el bot usa la variable{' '}
                <code className="bg-slate-100 px-1 rounded">VICKY_DATOS_ENTREGA_NOTIFY_PHONE</code> en Cloud Run o el valor por defecto (5493512956376). Tras guardar, redeploy de{' '}
                <code className="bg-slate-100 px-1 rounded">vicky-bot</code> para leer el cambio.
              </p>
            </div>
            <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-900">Grupo WhatsApp — agenda de entregas</p>
              <p className="text-xs text-slate-500">
                Cada vez que se crea un evento en <strong>Agenda de entregas</strong> (panel, Vicky con{' '}
                <code className="text-[11px] bg-slate-100 px-1 rounded">[ENTREGA:…]</code> o admin{' '}
                <code className="text-[11px] bg-slate-100 px-1 rounded">#entrega</code>), el bot envía un mensaje
                resumen a este grupo. La cuenta del bot tiene que ser <strong>miembro del grupo</strong>. Podés pegar el{' '}
                <strong>JID</strong> (<code className="text-[11px]">…@g.us</code>), el <strong>enlace de invitación</strong>{' '}
                (<code className="text-[11px]">https://chat.whatsapp.com/…</code>) o solo el <strong>código</strong> del
                enlace.
              </p>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm text-slate-700">Avisos activos</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.notificarAgendaEntregasGrupoActivo !== false}
                    onChange={(e) => update({ notificarAgendaEntregasGrupoActivo: e.target.checked })}
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors ${config.notificarAgendaEntregasGrupoActivo !== false ? 'bg-brand-600' : 'bg-slate-300'} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full`}
                  />
                </label>
              </div>
              <div>
                <label className="label">Grupo (JID, enlace o código de invitación)</label>
                <input
                  type="text"
                  className="input font-mono text-sm"
                  placeholder="120363…@g.us o https://chat.whatsapp.com/…"
                  value={config.whatsappGrupoJidAgendaEntregas || ''}
                  onChange={(e) => update({ whatsappGrupoJidAgendaEntregas: e.target.value.trim() })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Lo más estable es el JID <code className="bg-slate-100 px-1 rounded">120363…@g.us</code> (lo obtenés con{' '}
                  <code className="bg-slate-100 px-1 rounded">npm run wa:grupo-jid</code> en el repo del bot). También podés
                  pegar el enlace completo de invitación: el bot lo resuelve a JID al enviar el aviso. Pulsá{' '}
                  <strong>Guardar</strong>. Variable en Cloud Run:{' '}
                  <code className="bg-slate-100 px-1 rounded">WHATSAPP_GRUPO_JID_AGENDA_ENTREGAS</code>.
                </p>
              </div>
            </div>
            <div>
              <label className="label">Horario de atención — desde</label>
              <input
                type="time"
                className="input"
                value={config.horaAtencionDesde}
                onChange={(e) => update({ horaAtencionDesde: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Horario de atención — hasta</label>
              <input
                type="time"
                className="input"
                value={config.horaAtencionHasta}
                onChange={(e) => update({ horaAtencionHasta: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
