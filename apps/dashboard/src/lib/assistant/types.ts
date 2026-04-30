export type AssistantOrigin = 'dashboard' | 'whatsapp_admin' | 'cursor_chat' | 'code'

export type AssistantRole = 'admin' | 'operador' | 'viewer'

export type AssistantUser = {
  uid: string
  email: string
  role: AssistantRole
  nombre?: string | null
}

export type AssistantOperationType =
  | 'mergeDoc'
  | 'setDoc'
  | 'appendPromptInstruction'
  | 'appendPromotion'
  | 'appendRestriction'
  | 'updateServicePrice'
  | 'createDoc'

export type AssistantOperation = {
  id: string
  type: AssistantOperationType
  target: string
  path: string
  description: string
  data?: Record<string, unknown>
  before?: unknown
  after?: unknown
  requiresDeploy?: boolean
  requiresBotReload?: boolean
}

export type AssistantPlan = {
  runId: string
  reply: string
  status: 'planned' | 'needs_more_detail'
  operations: AssistantOperation[]
  warnings: string[]
  requiresConfirmation: true
}

export type AssistantRunStatus =
  | 'planned'
  | 'needs_more_detail'
  | 'applying'
  | 'applied'
  | 'failed'
  | 'rolled_back'
