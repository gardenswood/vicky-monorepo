import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(date: Date | undefined): string {
  if (!date) return ''
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Ayer'
  return format(date, 'dd/MM/yy')
}

export function formatRelative(date: Date | undefined): string {
  if (!date) return ''
  return formatDistanceToNow(date, { addSuffix: true, locale: es })
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

export function getInitials(name?: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getTelFromJid(jid: string): string {
  return getJidDigits(jid)
}

export function isLidJid(jid?: string | null): boolean {
  return String(jid || '').endsWith('@lid')
}

export function getJidDigits(jid?: string | null): string {
  return String(jid || '')
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '')
    .replace('@lid', '')
}

export interface ClienteIdentityLike {
  tel?: string
  telefono?: string | null
  nombre?: string | null
  pushName?: string | null
  remoteJid?: string | null
  whatsappLid?: string | null
}

export function getDisplayName(cliente: ClienteIdentityLike): string {
  const raw = (cliente.nombre || cliente.pushName || '').trim()
  return raw || 'Sin nombre'
}

export function getDisplayPhone(cliente: ClienteIdentityLike): string {
  const telefono = String(cliente.telefono || '').replace(/\D/g, '')
  if (telefono.length >= 8) return telefono

  const remoteJid = String(cliente.remoteJid || '')
  if (remoteJid.endsWith('@s.whatsapp.net')) {
    const digits = getJidDigits(remoteJid).replace(/\D/g, '')
    if (digits.length >= 8) return digits
  }

  const docTel = String(cliente.tel || '').replace(/\D/g, '')
  if (!isLidJid(remoteJid) && docTel.length >= 8) return docTel

  return ''
}

export function getIdentitySecondary(cliente: ClienteIdentityLike): string {
  const remoteJid = String(cliente.remoteJid || '')
  if (isLidJid(remoteJid)) return `WhatsApp LID ${cliente.whatsappLid || getJidDigits(remoteJid)}`
  if (remoteJid.startsWith('ig:')) return `Instagram ${remoteJid.replace(/^ig:/, '')}`
  return remoteJid || String(cliente.tel || '')
}

export const SERVICIO_LABELS: Record<string, string> = {
  lena: 'Leña',
  cerco: 'Cercos',
  pergola: 'Pérgolas',
  fogonero: 'Sector Fogonero',
  bancos: 'Bancos',
  madera: 'Productos de Madera',
}

export const SERVICIO_COLORS: Record<string, string> = {
  lena: '#92400e',
  cerco: '#166534',
  pergola: '#1d4ed8',
  fogonero: '#b45309',
  bancos: '#7c3aed',
  madera: '#0f766e',
}

export const ESTADO_LABELS: Record<string, string> = {
  nuevo: '🆕 Nuevo',
  cotizacion: '📄 Cotización enviada',
  cotizacion_enviada: '📄 Cotización enviada',
  confirmado: '✅ Confirmado',
  cliente: '🌟 Cliente',
  silenciado: '👤 Humano atendiendo',
}

export const ESTADO_COLORS: Record<string, string> = {
  nuevo: 'bg-slate-100 text-slate-700',
  cotizacion: 'bg-blue-100 text-blue-700',
  cotizacion_enviada: 'bg-blue-100 text-blue-700',
  confirmado: 'bg-green-100 text-green-700',
  cliente: 'bg-brand-100 text-brand-700',
  silenciado: 'bg-orange-100 text-orange-700',
}
