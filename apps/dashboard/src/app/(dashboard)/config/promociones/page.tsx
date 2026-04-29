'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AlertCircle, CheckCircle2, Megaphone, Plus, Save, Trash2 } from 'lucide-react'

type PrecioPromocional = {
  descripcion: string
  precio: number
  unidad: string
}

type Promocion = {
  id: string
  servicioId: string
  titulo: string
  estado: 'vigente' | 'activa' | 'activa_hasta_revision' | 'pausada' | 'vencida' | 'requiere_confirmacion_humana'
  desde: string
  hasta: string
  textoParaVicky: string
  reglas: string[]
  preciosPromocionales: PrecioPromocional[]
}

type Restriccion = {
  id: string
  estado: 'vigente' | 'activa' | 'pausada'
  tipo?: string
  telefono?: string
  textoParaVicky: string
}

type ConfigPromociones = {
  promociones: Promocion[]
  restricciones: Restriccion[]
}

const DEFAULT_CONFIG: ConfigPromociones = {
  promociones: [
    {
      id: 'promo_cercos_30_off_abril_2026',
      servicioId: 'cerco',
      titulo: '30% off en cercos de eucalipto impregnado',
      estado: 'activa_hasta_revision',
      desde: '2026-04-07',
      hasta: '2026-04-30',
      textoParaVicky: 'Hasta el 30 de abril tenemos 30% de descuento en cercos de palos de eucalipto impregnado.',
      reglas: [
        'Priorizar precio final promocional durante la campana.',
        'No mencionar precio de lista salvo que el humano lo indique.',
        'Pedir metros lineales, altura, zona y si necesita medicion.',
      ],
      preciosPromocionales: [
        { descripcion: 'Cerco 1.80 m de alto', precio: 110000, unidad: 'metro lineal' },
        { descripcion: 'Cerco 2.00 m a 2.50 m de alto', precio: 140000, unidad: 'metro lineal' },
      ],
    },
  ],
  restricciones: [
    {
      id: 'no_ofrecer_carbon',
      estado: 'vigente',
      textoParaVicky: 'No ofrecer carbon. Gardens Wood no vende carbon en este flujo.',
    },
    {
      id: 'no_datos_bancarios',
      estado: 'vigente',
      textoParaVicky: 'No pasar alias, CBU, cuentas bancarias ni datos de transferencia. Derivar cierre de pago a asesor.',
    },
  ],
}

const SERVICIOS = ['lena', 'cerco', 'pergola', 'fogonero', 'bancos', 'madera']

export default function PromocionesPage() {
  const [config, setConfig] = useState<ConfigPromociones>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const snap = await getDoc(doc(db, 'config', 'promociones'))
      if (snap.exists()) {
        const data = snap.data() as Partial<ConfigPromociones>
        setConfig({
          promociones: Array.isArray(data.promociones) ? data.promociones as Promocion[] : [],
          restricciones: Array.isArray(data.restricciones) ? data.restricciones as Restriccion[] : [],
        })
      }
    } catch {
      setError('Error al cargar promociones. Se muestran valores sugeridos.')
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    setSaving(true)
    setError('')
    try {
      await setDoc(
        doc(db, 'config', 'promociones'),
        {
          ...config,
          actualizadoEn: serverTimestamp(),
        },
        { merge: true },
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Error al guardar promociones')
    } finally {
      setSaving(false)
    }
  }

  function updatePromo(index: number, changes: Partial<Promocion>) {
    setConfig((prev) => ({
      ...prev,
      promociones: prev.promociones.map((p, i) => (i === index ? { ...p, ...changes } : p)),
    }))
  }

  function updateRestriccion(index: number, changes: Partial<Restriccion>) {
    setConfig((prev) => ({
      ...prev,
      restricciones: prev.restricciones.map((r, i) => (i === index ? { ...r, ...changes } : r)),
    }))
  }

  function addPromo() {
    setConfig((prev) => ({
      ...prev,
      promociones: [
        ...prev.promociones,
        {
          id: `promo_${Date.now()}`,
          servicioId: 'lena',
          titulo: '',
          estado: 'requiere_confirmacion_humana',
          desde: new Date().toISOString().slice(0, 10),
          hasta: '',
          textoParaVicky: '',
          reglas: [],
          preciosPromocionales: [],
        },
      ],
    }))
  }

  function addRestriccion() {
    setConfig((prev) => ({
      ...prev,
      restricciones: [
        ...prev.restricciones,
        {
          id: `restriccion_${Date.now()}`,
          estado: 'vigente',
          textoParaVicky: '',
        },
      ],
    }))
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Promociones y restricciones</h1>
            <p className="text-slate-500 text-sm">Reglas temporales y bloqueos que Vicky lee desde Firestore</p>
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
        <div className="mb-4 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        Las promociones con estado <strong>vigente</strong>, <strong>activa</strong> o <strong>activa hasta revisión</strong> se anexan al prompt del bot.
        Las promociones vencidas, pausadas o pendientes de confirmación quedan documentadas pero no se usan.
      </div>

      <section className="space-y-4 mb-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Promociones</h2>
          <button onClick={addPromo} className="btn-secondary flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Agregar promo
          </button>
        </div>

        {config.promociones.map((promo, index) => (
          <div key={promo.id} className="card p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Título</span>
                <input className="input mt-1" value={promo.titulo} onChange={(e) => updatePromo(index, { titulo: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Servicio</span>
                <select className="input mt-1" value={promo.servicioId} onChange={(e) => updatePromo(index, { servicioId: e.target.value })}>
                  {SERVICIOS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Estado</span>
                <select className="input mt-1" value={promo.estado} onChange={(e) => updatePromo(index, { estado: e.target.value as Promocion['estado'] })}>
                  <option value="vigente">Vigente</option>
                  <option value="activa">Activa</option>
                  <option value="activa_hasta_revision">Activa hasta revisión</option>
                  <option value="requiere_confirmacion_humana">Requiere confirmación</option>
                  <option value="pausada">Pausada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Desde</span>
                <input type="date" className="input mt-1" value={promo.desde || ''} onChange={(e) => updatePromo(index, { desde: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Hasta</span>
                <input type="date" className="input mt-1" value={promo.hasta || ''} onChange={(e) => updatePromo(index, { hasta: e.target.value })} />
              </label>
              <div className="flex items-end">
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, promociones: prev.promociones.filter((_, i) => i !== index) }))}
                  className="btn-secondary text-red-600 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Quitar
                </button>
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-500">Texto para Vicky</span>
              <textarea
                className="input mt-1 min-h-24"
                value={promo.textoParaVicky}
                onChange={(e) => updatePromo(index, { textoParaVicky: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-500">Reglas, una por línea</span>
              <textarea
                className="input mt-1 min-h-24"
                value={(promo.reglas || []).join('\n')}
                onChange={(e) => updatePromo(index, { reglas: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })}
              />
            </label>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Restricciones</h2>
          <button onClick={addRestriccion} className="btn-secondary flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Agregar restricción
          </button>
        </div>

        {config.restricciones.map((restriccion, index) => (
          <div key={restriccion.id} className="card p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className="block md:col-span-2">
                <span className="text-xs font-medium text-slate-500">ID</span>
                <input className="input mt-1" value={restriccion.id} onChange={(e) => updateRestriccion(index, { id: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Estado</span>
                <select className="input mt-1" value={restriccion.estado} onChange={(e) => updateRestriccion(index, { estado: e.target.value as Restriccion['estado'] })}>
                  <option value="vigente">Vigente</option>
                  <option value="activa">Activa</option>
                  <option value="pausada">Pausada</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, restricciones: prev.restricciones.filter((_, i) => i !== index) }))}
                  className="btn-secondary text-red-600 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Quitar
                </button>
              </div>
            </div>
            <textarea
              className="input min-h-20"
              value={restriccion.textoParaVicky}
              onChange={(e) => updateRestriccion(index, { textoParaVicky: e.target.value })}
              placeholder="Ej: No ofrecer carbon..."
            />
          </div>
        ))}
      </section>
    </div>
  )
}
