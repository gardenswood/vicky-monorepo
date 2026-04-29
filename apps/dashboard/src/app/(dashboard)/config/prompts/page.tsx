'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Bot, Save, History, AlertCircle, CheckCircle2, Eye, EyeOff, Info } from 'lucide-react'
import dynamicImport from 'next/dynamic'

const MonacoEditor = dynamicImport(() => import('@monaco-editor/react'), { ssr: false })

interface PromptVersion {
  id: string
  version: number
  fecha: Date
  previewTexto: string
}

export default function PromptsPage() {
  const [sistemaPrompt, setSistemaPrompt] = useState('')
  const [sistemaPromptAdmin, setSistemaPromptAdmin] = useState('')
  const [mensajeBienvenida, setMensajeBienvenida] = useState('')
  const [mensajeClienteCierreEntrega, setMensajeClienteCierreEntrega] = useState('')
  const [instruccionCierreEntregaGemini, setInstruccionCierreEntregaGemini] = useState('')
  const [activeTab, setActiveTab] = useState<'principal' | 'admin' | 'bienvenida' | 'cierreEntrega'>('principal')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [showVersions, setShowVersions] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  useEffect(() => {
    loadPrompts()
    loadVersions()
  }, [])

  async function loadPrompts() {
    try {
      const snap = await getDoc(doc(db, 'config', 'prompts'))
      if (snap.exists()) {
        const d = snap.data()
        setSistemaPrompt(d.sistemaPrompt || '')
        setSistemaPromptAdmin(d.sistemaPromptAdmin || '')
        setMensajeBienvenida(d.mensajeBienvenidaTexto || '')
        setMensajeClienteCierreEntrega(d.mensajeClienteCierreEntregaHumano || '')
        setInstruccionCierreEntregaGemini(d.instruccionCierreEntregaHumanoGemini || '')
      } else {
        // Pre-fill with a placeholder
        setSistemaPrompt('// Pegá aquí el SYSTEM_PROMPT del bot\n// Este texto define el comportamiento completo de Vicky')
        setSistemaPromptAdmin('// Pegá aquí el SYSTEM_PROMPT_ADMIN')
        setMensajeBienvenida('Contame, ¿en qué te puedo ayudar? Escribime porfa que me es más fácil responder 😊')
        setMensajeClienteCierreEntrega('')
        setInstruccionCierreEntregaGemini('')
      }
    } catch (err) {
      setError('Error al cargar los prompts')
    } finally {
      setLoading(false)
    }
  }

  async function loadVersions() {
    try {
      const q = query(
        collection(db, 'config', 'prompts', 'versiones'),
        orderBy('fecha', 'desc')
      )
      const snap = await getDocs(q)
      const v: PromptVersion[] = snap.docs.map((d) => ({
        id: d.id,
        version: d.data().version,
        fecha: d.data().fecha?.toDate(),
        previewTexto: d.data().sistemaPrompt?.slice(0, 80) + '...',
      }))
      setVersions(v)
    } catch {}
  }

  async function savePrompts() {
    setSaving(true)
    setError('')
    try {
      const promptRef = doc(db, 'config', 'prompts')
      const currentSnap = await getDoc(promptRef)
      const currentVersion = currentSnap.exists() ? (currentSnap.data().version || 0) : 0

      // Save version history
      await setDoc(
        doc(db, 'config', 'prompts', 'versiones', `v${currentVersion}`),
        {
          version: currentVersion,
          fecha: serverTimestamp(),
          sistemaPrompt,
          sistemaPromptAdmin,
          mensajeBienvenidaTexto: mensajeBienvenida,
          mensajeClienteCierreEntregaHumano: mensajeClienteCierreEntrega,
          instruccionCierreEntregaHumanoGemini: instruccionCierreEntregaGemini,
        }
      )

      // Update main config
      await setDoc(promptRef, {
        sistemaPrompt,
        sistemaPromptAdmin,
        mensajeBienvenidaTexto: mensajeBienvenida,
        mensajeClienteCierreEntregaHumano: mensajeClienteCierreEntrega,
        instruccionCierreEntregaHumanoGemini: instruccionCierreEntregaGemini,
        version: currentVersion + 1,
        ultimaActualizacion: serverTimestamp(),
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      loadVersions()
    } catch (err) {
      setError('Error al guardar los prompts')
    } finally {
      setSaving(false)
    }
  }

  async function restoreVersion(versionId: string) {
    try {
      const snap = await getDoc(doc(db, 'config', 'prompts', 'versiones', versionId))
      if (snap.exists()) {
        const d = snap.data()
        setSistemaPrompt(d.sistemaPrompt || '')
        setSistemaPromptAdmin(d.sistemaPromptAdmin || '')
        setMensajeBienvenida(d.mensajeBienvenidaTexto || '')
        setMensajeClienteCierreEntrega(d.mensajeClienteCierreEntregaHumano || '')
        setInstruccionCierreEntregaGemini(d.instruccionCierreEntregaHumanoGemini || '')
        setShowVersions(false)
      }
    } catch {
      setError('Error al restaurar la versión')
    }
  }

  const currentContent =
    activeTab === 'principal'
      ? sistemaPrompt
      : activeTab === 'admin'
        ? sistemaPromptAdmin
        : activeTab === 'bienvenida'
          ? mensajeBienvenida
          : `${mensajeClienteCierreEntrega}\n\n---\n\n${instruccionCierreEntregaGemini}`

  const setCurrentContent =
    activeTab === 'principal'
      ? setSistemaPrompt
      : activeTab === 'admin'
        ? setSistemaPromptAdmin
        : activeTab === 'bienvenida'
          ? setMensajeBienvenida
          : () => {}

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Instrucciones de IA</h1>
              <p className="text-slate-500 text-sm">Define el comportamiento, personalidad y catálogo de Vicky</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="btn-secondary flex items-center gap-1.5"
            >
              <History className="w-4 h-4" />
              Historial ({versions.length})
            </button>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="btn-secondary flex items-center gap-1.5"
            >
              {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {previewMode ? 'Editor' : 'Preview'}
            </button>
            <button
              onClick={savePrompts}
              disabled={saving}
              className="btn-primary flex items-center gap-1.5"
            >
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
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {[
            { id: 'principal', label: 'Prompt principal', desc: 'Comportamiento de Vicky' },
            { id: 'admin', label: 'Prompt Admin', desc: 'Comandos del dueño' },
            { id: 'bienvenida', label: 'Mensaje de bienvenida', desc: 'Texto después del audio' },
            {
              id: 'cierreEntrega',
              label: 'Cierre entrega',
              desc: 'Tras humano (#final_entrega)',
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-50 text-brand-700 border border-brand-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
            </div>
          ) : activeTab === 'cierreEntrega' ? (
            previewMode ? (
              <div className="h-full overflow-y-auto p-6 space-y-6">
                <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-900 mb-2 text-sm text-slate-500 uppercase tracking-wide">
                    Mensaje al cliente (WhatsApp)
                  </h3>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                    {mensajeClienteCierreEntrega || '(vacío → usa default del bot)'}
                  </pre>
                </div>
                <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-900 mb-2 text-sm text-slate-500 uppercase tracking-wide">
                    Instrucción a Gemini (modo cierre)
                  </h3>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                    {instruccionCierreEntregaGemini || '(vacío → usa default del bot)'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col gap-2 p-2 min-h-0">
                <div className="flex-1 min-h-[40%] flex flex-col border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border-b border-slate-100">
                    Mensaje al cliente (WhatsApp) — admin <code className="text-brand-700">#final_entrega</code>
                  </div>
                  <MonacoEditor
                    height="100%"
                    defaultLanguage="plaintext"
                    value={mensajeClienteCierreEntrega}
                    onChange={(value: string | undefined) => setMensajeClienteCierreEntrega(value || '')}
                    theme="vs-light"
                    options={{
                      wordWrap: 'on',
                      minimap: { enabled: false },
                      lineNumbers: 'off',
                      fontSize: 13,
                      fontFamily: '"Fira Code", "Cascadia Code", monospace',
                      padding: { top: 12, bottom: 12 },
                      scrollBeyondLastLine: false,
                      renderLineHighlight: 'none',
                    }}
                  />
                </div>
                <div className="flex-1 min-h-[40%] flex flex-col border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border-b border-slate-100">
                    Instrucción a Gemini mientras <code className="text-brand-700">cierreEntregaAsistido</code>
                  </div>
                  <MonacoEditor
                    height="100%"
                    defaultLanguage="plaintext"
                    value={instruccionCierreEntregaGemini}
                    onChange={(value: string | undefined) => setInstruccionCierreEntregaGemini(value || '')}
                    theme="vs-light"
                    options={{
                      wordWrap: 'on',
                      minimap: { enabled: false },
                      lineNumbers: 'off',
                      fontSize: 13,
                      fontFamily: '"Fira Code", "Cascadia Code", monospace',
                      padding: { top: 12, bottom: 12 },
                      scrollBeyondLastLine: false,
                      renderLineHighlight: 'none',
                    }}
                  />
                </div>
              </div>
            )
          ) : previewMode ? (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-slate-400" /> Preview del prompt
                </h3>
                <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                  {currentContent}
                </pre>
              </div>
            </div>
          ) : (
            <MonacoEditor
              height="100%"
              defaultLanguage="plaintext"
              value={currentContent}
              onChange={(value: string | undefined) => setCurrentContent(value || '')}
              theme="vs-light"
              options={{
                wordWrap: 'on',
                minimap: { enabled: false },
                lineNumbers: 'off',
                fontSize: 13,
                fontFamily: '"Fira Code", "Cascadia Code", monospace',
                padding: { top: 20, bottom: 20 },
                scrollBeyondLastLine: false,
                renderLineHighlight: 'none',
              }}
            />
          )}
        </div>

        {/* Version history panel */}
        {showVersions && (
          <div className="w-72 bg-white border-l border-slate-200 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900 text-sm">Historial de versiones</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {versions.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Sin versiones guardadas</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700">v{v.version}</span>
                      <span className="text-xs text-slate-400">
                        {v.fecha ? v.fecha.toLocaleDateString('es') : '-'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{v.previewTexto}</p>
                    <button
                      onClick={() => restoreVersion(v.id)}
                      className="mt-2 text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Restaurar esta versión
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Info panel */}
        <div className="w-64 bg-slate-50 border-l border-slate-200 p-4 space-y-4 flex-shrink-0">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Información
            </h3>
            <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
              <p className="text-xs text-slate-600">
                <strong>Longitud actual:</strong> {currentContent.length.toLocaleString()} caracteres
              </p>
              <p className="text-xs text-slate-600">
                <strong>Aprox. tokens:</strong> ~{Math.round(currentContent.length / 4).toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Marcadores detectados
            </h3>
            <div className="space-y-1">
              {activeTab === 'cierreEntrega' ? (
                <p className="text-xs text-slate-500">
                  Sugerido en la instrucción a Gemini: <code className="text-brand-700">[ENTREGA:…]</code>,{' '}
                  <code className="text-brand-700">[DIRECCION:…]</code>,{' '}
                  <code className="text-brand-700">[NOTIFICAR_DATOS_ENTREGA]</code>
                </p>
              ) : (
                ['[IMG:', '[COTIZACION:', '[PEDIDO:', '[PDF_CERCO:', '[CONFIRMADO]', '[NOMBRE:', '[DIRECCION:', '[ZONA:'].filter(
                  (m) => currentContent.includes(m)
                ).map((m) => (
                <span key={m} className="block text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded font-mono">
                  {m}...
                </span>
              ))
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Los cambios se aplican la próxima vez que el bot procese un mensaje (sin reiniciar).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
