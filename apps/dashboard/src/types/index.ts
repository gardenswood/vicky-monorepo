export interface Mensaje {
  id: string
  contenido: string
  tipo: 'texto' | 'audio' | 'imagen' | 'video' | 'documento'
  direccion: 'entrante' | 'saliente'
  timestamp: Date
  marcadores?: string[]
  servicio?: string
  audioUrl?: string
  imagenUrl?: string
}

export interface Chat {
  jid: string
  tel: string
  nombre?: string
  ultimoMensaje?: string
  ultimoMensajeAt?: Date
  estado?: 'nuevo' | 'cotizacion' | 'confirmado' | 'cliente' | 'silenciado'
  servicioPendiente?: string
  humanoAtendiendo?: boolean
  mensajesCount?: number
}

export interface Cliente {
  tel: string
  remoteJid: string
  nombre?: string
  direccion?: string
  zona?: string
  metodoPago?: 'efectivo' | 'transferencia'
  estado?: 'nuevo' | 'cotizacion_enviada' | 'confirmado' | 'cliente'
  servicioPendiente?: string
  pedidosAnteriores?: Pedido[]
  fechaPrimerContacto?: Date
  fechaUltimoContacto?: Date
  audioIntroEnviado?: boolean
  notas?: string
  potencial?: 'frio' | 'tibio' | 'caliente'
  statusCrm?: 'pendiente_cotizacion' | 'seguimiento' | 'concreto' | 'en_obra'
  urgencia?: 'alta' | 'media' | 'baja'
  interes?: string[]
  proximoContactoAt?: Date
  consentimientoDifusion?: boolean
}

export interface Pedido {
  servicio: string
  descripcion: string
  fecha: Date
  estado?: string
  monto?: number
}

export interface ColaLena {
  id: string
  remoteJid: string
  nombre: string
  direccion: string
  zona?: string
  cantidadKg: number
  fechaPedido: Date
  estado: 'en_cola' | 'notificado' | 'entregado'
}

export interface PrecioItem {
  descripcion: string
  precio: number
  unidad: string
}

export interface Servicio {
  id: string
  nombre: string
  descripcion: string
  activo: boolean
  tieneEnvio: boolean
  precios: PrecioItem[]
  imagenUrl?: string
  marcador: string
  infoEnvio?: string
}

export interface ConfigGeneral {
  delayMinSeg: number
  delayMaxSeg: number
  modeloGemini: string
  frecuenciaAudioFidelizacion: number
  tiempoSilencioHumanoHoras: number
  botActivo: boolean
  adminPhone?: string
  horaAtencionDesde?: string
  horaAtencionHasta?: string
}

export interface ConfigPrompts {
  sistemaPrompt: string
  sistemaPromptAdmin: string
  mensajeBienvenidaTexto: string
  version: number
  ultimaActualizacion: Date
}

export interface UsuarioDashboard {
  uid: string
  email: string
  nombre: string
  rol: 'admin' | 'operador' | 'viewer'
  activo: boolean
  creadoEn: Date
}

export type ServicioId = 'lena' | 'cerco' | 'pergola' | 'fogonero' | 'bancos' | 'madera'

export interface StatsData {
  mensajesHoy: number
  chatsActivos: number
  cotizacionesEnviadas: number
  pedidosConfirmados: number
  mensajesPorDia: { fecha: string; entrantes: number; salientes: number }[]
  distribucionServicios: { nombre: string; valor: number; color: string }[]
  funnel: { etapa: string; cantidad: number }[]
}
