'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Users,
  Plus,
  Shield,
  Eye,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  Clock,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface Usuario {
  uid: string
  email: string
  nombre: string
  rol: 'admin' | 'operador' | 'viewer'
  activo: boolean
  creadoEn?: Date
}

const ROL_CONFIG = {
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700', icon: <Shield className="w-3 h-3" />, desc: 'Acceso completo' },
  operador: { label: 'Operador', color: 'bg-blue-100 text-blue-700', icon: <Edit2 className="w-3 h-3" />, desc: 'Puede editar config y responder chats' },
  viewer: { label: 'Visor', color: 'bg-slate-100 text-slate-600', icon: <Eye className="w-3 h-3" />, desc: 'Solo puede ver, sin editar' },
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', nombre: '', rol: 'operador' as Usuario['rol'] })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      const data: Usuario[] = snap.docs.map((d) => ({
        uid: d.id,
        email: d.data().email,
        nombre: d.data().nombre,
        rol: d.data().rol,
        activo: d.data().activo ?? true,
        creadoEn: d.data().creadoEn?.toDate(),
      }))
      setUsuarios(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  async function createUser() {
    setCreating(true)
    setCreateError('')
    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al crear usuario')
      setCreateSuccess(`Usuario creado. Contraseña temporal: ${data.tempPassword}`)
      setNewUser({ email: '', nombre: '', rol: 'operador' })
      setTimeout(() => { setCreateSuccess(''); setShowCreate(false) }, 8000)
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear usuario')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActivo(uid: string, activo: boolean) {
    await updateDoc(doc(db, 'usuarios', uid), { activo: !activo })
  }

  async function changeRol(uid: string, rol: Usuario['rol']) {
    await updateDoc(doc(db, 'usuarios', uid), { rol, ultimaActualizacion: serverTimestamp() })
    // Also update Firebase Auth custom claims via API
    await fetch('/api/usuarios/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, rol }),
    })
    setEditingId(null)
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios del panel</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gestioná quién puede acceder al dashboard y con qué permisos
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      {/* Create user form */}
      {showCreate && (
        <div className="card p-5 mb-5 border-brand-200 bg-brand-50/30">
          <h3 className="font-semibold text-slate-900 mb-4">Crear nuevo usuario</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input bg-white"
                placeholder="usuario@empresa.com"
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Nombre</label>
              <input
                type="text"
                className="input bg-white"
                placeholder="Nombre Apellido"
                value={newUser.nombre}
                onChange={(e) => setNewUser((u) => ({ ...u, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Rol</label>
              <select
                className="input bg-white"
                value={newUser.rol}
                onChange={(e) => setNewUser((u) => ({ ...u, rol: e.target.value as Usuario['rol'] }))}
              >
                <option value="viewer">Visor (solo ver)</option>
                <option value="operador">Operador (editar config)</option>
                <option value="admin">Admin (acceso total)</option>
              </select>
            </div>
          </div>

          {createError && (
            <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              {createError}
            </div>
          )}
          {createSuccess && (
            <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {createSuccess}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button onClick={createUser} disabled={creating || !newUser.email || !newUser.nombre} className="btn-primary">
              {creating ? 'Creando...' : 'Crear usuario'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* Role descriptions */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {Object.entries(ROL_CONFIG).map(([key, cfg]) => (
          <div key={key} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('badge text-xs flex items-center gap-1', cfg.color)}>
                {cfg.icon}
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-slate-500">{cfg.desc}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : usuarios.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No hay usuarios configurados</p>
            <p className="text-slate-400 text-sm mt-1">Creá el primer usuario admin para empezar</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Usuario</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Rol</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Estado</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Creado</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map((u) => (
                <tr key={u.uid} className={cn('hover:bg-slate-50 transition-colors', !u.activo && 'opacity-50')}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{u.nombre}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    {editingId === u.uid ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="input text-xs py-1"
                          defaultValue={u.rol}
                          onChange={(e) => changeRol(u.uid, e.target.value as Usuario['rol'])}
                        >
                          <option value="viewer">Visor</option>
                          <option value="operador">Operador</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={cn('badge text-xs flex items-center gap-1', ROL_CONFIG[u.rol]?.color)}>
                          {ROL_CONFIG[u.rol]?.icon}
                          {ROL_CONFIG[u.rol]?.label}
                        </span>
                        <button
                          onClick={() => setEditingId(u.uid)}
                          className="text-slate-300 hover:text-slate-500 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <button
                      onClick={() => toggleActivo(u.uid, u.activo)}
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium transition-colors',
                        u.activo ? 'text-green-600 hover:text-green-700' : 'text-slate-400 hover:text-slate-600'
                      )}
                    >
                      {u.activo ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Activo</>
                      ) : (
                        <><XCircle className="w-3.5 h-3.5" /> Inactivo</>
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-4">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {u.creadoEn ? format(u.creadoEn, "d MMM yyyy", { locale: es }) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className="text-xs text-slate-400 font-mono">{u.uid.slice(0, 8)}...</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
