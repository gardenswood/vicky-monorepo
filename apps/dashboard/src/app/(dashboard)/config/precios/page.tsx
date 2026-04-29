'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, doc, getDocs, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  DollarSign, Save, Plus, Trash2, CheckCircle2, AlertCircle,
  Leaf, TreePine, Flame, Sofa, Package, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
} from 'lucide-react'

interface PrecioItem {
  descripcion: string
  precio: number
  unidad: string
}

interface Servicio {
  id: string
  nombre: string
  activo: boolean
  tieneEnvio: boolean
  precios: PrecioItem[]
  infoEnvio?: string
  marcador: string
}

const SERVICIOS_DEFAULT: Servicio[] = [
  {
    id: 'lena',
    nombre: 'Leña',
    activo: true,
    tieneEnvio: true,
    marcador: '[IMG:lena]',
    infoEnvio: 'Villa Allende: sin cargo en +500kg. Zonas cercanas: $45.000 extra.',
    precios: [
      { descripcion: 'Hogar / Grande', precio: 290000, unidad: 'tonelada' },
      { descripcion: 'Salamandra / Mediana', precio: 300000, unidad: 'tonelada' },
      { descripcion: 'Parrilla / Fino (Quebracho Blanco)', precio: 320000, unidad: 'tonelada' },
    ],
  },
  {
    id: 'cerco',
    nombre: 'Cercos de madera',
    activo: true,
    tieneEnvio: false,
    marcador: '[IMG:cerco]',
    precios: [
      { descripcion: '1.80m de alto', precio: 140000, unidad: 'metro lineal' },
      { descripcion: '2.00m a 2.50m de alto', precio: 170000, unidad: 'metro lineal' },
      { descripcion: 'Hasta 3.00m de alto', precio: 185000, unidad: 'metro lineal' },
      { descripcion: 'Revestimiento con palo fino', precio: 150000, unidad: 'metro lineal' },
    ],
  },
  {
    id: 'pergola',
    nombre: 'Pérgolas',
    activo: true,
    tieneEnvio: false,
    marcador: '[IMG:pergola]',
    precios: [
      { descripcion: 'Caña Tacuara', precio: 110000, unidad: 'm²' },
      { descripcion: 'Caña Tacuara + Chapa Policarbonato', precio: 130000, unidad: 'm²' },
      { descripcion: 'Palos Pergoleros', precio: 130000, unidad: 'm²' },
      { descripcion: 'Palos Pergoleros + Policarbonato', precio: 150000, unidad: 'm²' },
    ],
  },
  {
    id: 'fogonero',
    nombre: 'Sector Fogonero',
    activo: true,
    tieneEnvio: false,
    marcador: '[IMG:fogonero]',
    precios: [
      { descripcion: 'Base (Geotextil + Piedra blanca)', precio: 57000, unidad: 'm²' },
    ],
  },
  {
    id: 'bancos',
    nombre: 'Bancos de Quebracho',
    activo: true,
    tieneEnvio: false,
    marcador: '[IMG:bancos]',
    precios: [
      { descripcion: 'Banco con respaldo (Quebracho Blanco)', precio: 355000, unidad: 'metro lineal' },
    ],
  },
]

const SERVICIOS_GARDENS_WOOD = new Set(['lena', 'cerco', 'pergola', 'fogonero', 'bancos', 'madera'])

const ICONS: Record<string, React.ReactNode> = {
  lena: <Leaf className="w-4 h-4" />,
  cerco: <TreePine className="w-4 h-4" />,
  pergola: <TreePine className="w-4 h-4" />,
  fogonero: <Flame className="w-4 h-4" />,
  bancos: <Sofa className="w-4 h-4" />,
  madera: <Package className="w-4 h-4" />,
}

export default function PreciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>(SERVICIOS_DEFAULT)
  const [activeServicio, setActiveServicio] = useState('lena')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadServicios()
  }, [])

  async function loadServicios() {
    try {
      const snap = await getDocs(collection(db, 'servicios'))
      if (!snap.empty) {
        const svcs: Servicio[] = snap.docs.map((d) => ({
          id: d.id,
          nombre: d.data().nombre,
          activo: d.data().activo ?? true,
          tieneEnvio: d.data().tieneEnvio ?? false,
          precios: d.data().precios ?? [],
          infoEnvio: d.data().infoEnvio,
          marcador: d.data().marcador ?? '',
        })).filter((svc) => SERVICIOS_GARDENS_WOOD.has(svc.id))
        setServicios(svcs.length > 0 ? svcs : SERVICIOS_DEFAULT)
        if (svcs.length > 0 && !svcs.some((svc) => svc.id === activeServicio)) {
          setActiveServicio(svcs[0].id)
        }
      }
    } catch {
      setError('Error al cargar servicios. Mostrando valores por defecto.')
    } finally {
      setLoading(false)
    }
  }

  async function saveAll() {
    setSaving(true)
    setError('')
    try {
      for (const svc of servicios) {
        await setDoc(doc(db, 'servicios', svc.id), {
          ...svc,
          ultimaActualizacion: serverTimestamp(),
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const servicio = servicios.find((s) => s.id === activeServicio)

  function updateServicio(id: string, changes: Partial<Servicio>) {
    setServicios((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)))
  }

  function updatePrecio(svcId: string, idx: number, changes: Partial<PrecioItem>) {
    setServicios((prev) =>
      prev.map((s) => {
        if (s.id !== svcId) return s
        const precios = [...s.precios]
        precios[idx] = { ...precios[idx], ...changes }
        return { ...s, precios }
      })
    )
  }

  function addPrecio(svcId: string) {
    setServicios((prev) =>
      prev.map((s) =>
        s.id === svcId
          ? { ...s, precios: [...s.precios, { descripcion: '', precio: 0, unidad: '' }] }
          : s
      )
    )
  }

  function removePrecio(svcId: string, idx: number) {
    setServicios((prev) =>
      prev.map((s) => {
        if (s.id !== svcId) return s
        const precios = s.precios.filter((_, i) => i !== idx)
        return { ...s, precios }
      })
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Precios y servicios</h1>
            <p className="text-slate-500 text-sm">Configurá los precios que usa Vicky en sus respuestas</p>
          </div>
        </div>
        <button onClick={saveAll} disabled={saving} className="btn-primary flex items-center gap-1.5">
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Guardado' : 'Guardar todos'}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex gap-6">
        {/* Service tabs (left) */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {servicios.map((svc) => (
            <button
              key={svc.id}
              onClick={() => setActiveServicio(svc.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                activeServicio === svc.id
                  ? 'bg-brand-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className={activeServicio === svc.id ? 'text-white' : 'text-slate-400'}>
                {ICONS[svc.id]}
              </span>
              <span className="flex-1 truncate">{svc.nombre}</span>
              {!svc.activo && (
                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Off</span>
              )}
            </button>
          ))}
        </div>

        {/* Service editor (right) */}
        {servicio && (
          <div className="flex-1 space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">{servicio.nombre}</h2>
                <button
                  onClick={() => updateServicio(servicio.id, { activo: !servicio.activo })}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    servicio.activo ? 'text-brand-600' : 'text-slate-400'
                  }`}
                >
                  {servicio.activo ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                  {servicio.activo ? 'Servicio activo' : 'Servicio inactivo'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Marcador de imagen</label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={servicio.marcador}
                    onChange={(e) => updateServicio(servicio.id, { marcador: e.target.value })}
                    placeholder="[IMG:lena]"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="tieneEnvio"
                    checked={servicio.tieneEnvio}
                    onChange={(e) => updateServicio(servicio.id, { tieneEnvio: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded"
                  />
                  <label htmlFor="tieneEnvio" className="text-sm text-slate-700">Tiene información de envío</label>
                </div>
              </div>

              {servicio.tieneEnvio && (
                <div className="mt-3">
                  <label className="label">Información de envío</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    value={servicio.infoEnvio || ''}
                    onChange={(e) => updateServicio(servicio.id, { infoEnvio: e.target.value })}
                    placeholder="Detallá las condiciones de envío para este servicio..."
                  />
                </div>
              )}
            </div>

            {/* Prices */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Lista de precios</h3>
                <button
                  onClick={() => addPrecio(servicio.id)}
                  className="btn-secondary flex items-center gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar precio
                </button>
              </div>

              {servicio.precios.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">Sin precios configurados</p>
              ) : (
                <div className="space-y-3">
                  {servicio.precios.map((precio, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <input
                          type="text"
                          className="input bg-white mb-2"
                          placeholder="Descripción (ej: Hogar / Grande)"
                          value={precio.descripcion}
                          onChange={(e) => updatePrecio(servicio.id, idx, { descripcion: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-slate-500 mb-1 block">Precio ($)</label>
                            <input
                              type="number"
                              className="input bg-white"
                              placeholder="0"
                              value={precio.precio || ''}
                              onChange={(e) => updatePrecio(servicio.id, idx, { precio: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-slate-500 mb-1 block">Unidad</label>
                            <input
                              type="text"
                              className="input bg-white"
                              placeholder="ej: tonelada, m², metro lineal"
                              value={precio.unidad}
                              onChange={(e) => updatePrecio(servicio.id, idx, { unidad: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removePrecio(servicio.id, idx)}
                        className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Price preview */}
              {servicio.precios.length > 0 && (
                <div className="mt-4 bg-brand-50 rounded-lg p-4 border border-brand-100">
                  <p className="text-xs font-semibold text-brand-700 mb-2">Preview en chat:</p>
                  <div className="text-xs text-brand-800 space-y-1">
                    <p className="font-medium">Precios {servicio.nombre}:</p>
                    {servicio.precios.map((p, i) => (
                      <p key={i}>
                        • {p.descripcion}: ${p.precio?.toLocaleString('es-AR')}/{p.unidad}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
