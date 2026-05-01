# Mapa funcional Dashboard ↔ Bot

## Resumen

Este mapa define qué funciones humanas del dashboard tienen equivalente operativo para Vicky y qué colecciones Firestore comparten.

| Dashboard | Colecciones | Función humana | Uso de Vicky |
|---|---|---|---|
| `/chats` y `/chats/[chatId]` | `chats`, `chats/{jid}/mensajes` | Ver conversación, activar humano | Respetar `humanoAtendiendo` y `silenciadoHasta`; usar historial reciente |
| `/clientes` | `clientes`, `consultasLena` | CRM comercial general, identidad legible, filtros, export y señales de logística leña | Actualizar identidad (`nombre`/`pushName`/`telefono`), CRM con marcadores para todos los servicios y oportunidades por actividad reciente |
| `/clientes/[tel]` | `clientes`, `consultasLena` | Editar ficha comercial; ver identidad WhatsApp; bloque separado de logística leña | Usar datos de identidad, zona, dirección, intereses, estado comercial y próximo contacto |
| `/agenda-entregas` | `entregas_agenda`, `mensajes_programados`, `datos_entrega_cliente`, `colaLena` | Crear/editar entregas y recordatorios | Emitir `[ENTREGA:...]`, `[AGENDAR:...]`, avisos al grupo |
| `/cola-lena` | `colaLena`, `config/general` | Ver pedidos confirmados chicos | Sincronizar cola operativa y estados de despacho |
| `/logistica-zonas` | `consultasLena`, `mensajes_programados`, `config/general` | Agrupar consultas por zona y enviar campañas | Usar interés pendiente por zona y programar WhatsApp |
| `/config/prompts` | `config/prompts`, `vicky_skills` | Editar instrucciones y skills | Cargar prompt y skills al armar Gemini |
| `/config/promociones` | `config/promociones` | Promos y restricciones | Aplicar reglas comerciales vigentes |
| `/config/precios` | `servicios/*` | Catálogo, precios y envío | Responder con precios reales y marcadores de catálogo |
| `/config/general` | `config/general` | Delays, admin, cron, umbrales | Control runtime del bot y campañas |
| `/usuarios` | `usuarios` | Roles y acceso | Gobierna permisos del dashboard |

## Reglas de uso por Vicky

- No inventar datos que no estén en Firestore, prompt o skills.
- Si una acción requiere humano, usar handoff y no prometer cierre.
- Si hay datos suficientes para agenda, usar `entregas_agenda`.
- Si hay recordatorio o mensaje diferido, usar `mensajes_programados`.
- El CRM comercial (`/clientes`) es general para leña, cercos, pérgolas, fogonero, bancos y madera; no debe funcionar como pantalla de reparto.
- Si hay interés de leña pendiente de agrupar por zona, usar `consultasLena` desde `/logistica-zonas`.
- Si el pedido de leña está confirmado para despacho, usar el flujo de `colaLena`.

## Campos mínimos por acción

### `mensajes_programados`

- `jid`
- `texto`
- `runAt`
- `estado: pendiente`
- `origen`

### `entregas_agenda`

- `fechaDia`
- `titulo`
- `origen`
- `estado`
- opcionales: `horaTexto`, `jid`, `direccion`, `producto`, `kg`, `telefonoContacto`

### `consultasLena`

- `tel`
- `remoteJid`
- `nombre`
- `zona`
- `cantidadKg`
- `estado`
- `fechaConsulta`
