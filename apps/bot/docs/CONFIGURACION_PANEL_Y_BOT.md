# Configuración del panel y el bot Vicky (alineación y recuperación)

El **dashboard** (Next.js) y el **bot** (`vicky-bot` en Cloud Run) comparten el mismo proyecto Firebase **`webgardens-8655d`**. La fuente de verdad operativa es **Firestore**; el bot la lee al arrancar y, en algunos campos, en cada mensaje.

## Mapa rápido: pantalla del panel → documento Firestore → cuándo lo ve el bot

| Panel (dashboard) | Firestore | Efecto en el bot |
|-------------------|-----------|------------------|
| **General** (`/config/general`) | `config/general` | Delays, `botActivo`, `modeloGemini`, campañas, tel. operación, grupo agenda, etc. Parte se lee **con caché ~5 min**; `botActivo` y algunos toggles críticos se releen **sin caché**. Si cambia `recargarBotAt`, el bot recarga runtime por poll (~60 s) o endpoint interno. |
| **Instrucciones AI** (`/config/prompts`) | `config/prompts` | `sistemaPrompt`, `sistemaPromptAdmin`, bienvenida, cierre entrega. El bot arma Gemini al arranque y ahora también puede recargar runtime al cambiar `config/general.recargarBotAt`. **Igual conviene redeploy durable de `vicky-bot`** para dejar todas las réplicas alineadas. |
| **Precios y servicios** (`/config/precios`) | `servicios/{lena,cerco,...}` | Se anexa al system prompt como `[DATOS_SERVICIOS_FIRESTORE]` al arranque y en recarga runtime. **Redeploy durable** tras cambiar precios. |
| **Asistente Vicky** (`/asistente` + chat flotante) | `assistant_runs`, `assistant_changes`, `change_requests` + docs objetivo | Propone cambios, exige confirmación, aplica con Admin SDK, audita `before/after`, marca `recargarBotAt` y puede disparar endpoint de recarga / GitHub Actions si las variables están configuradas. |
| Chats, clientes, agenda, cola | `chats/*`, `clientes/*`, etc. | Según feature; muchos cambios se ven en caliente o en la siguiente interacción. |

## Cómo volver a dejar todo como antes (checklist)

1. **Entrá al dashboard** con el mismo proyecto Firebase (`webgardens-8655d`). Si no cargan datos, revisá login y reglas Firestore para usuarios admin.
2. **General:** confirmá **`botActivo`** encendido, **`modeloGemini`** acorde a lo que usás en Cloud Run (o dejá el default del panel), delays y teléfonos de operación si los usás.
3. **Instrucciones AI → Historial:** elegí una **versión anterior** de `sistemaPrompt`, **Restaurar**, luego **Guardar** (sin Guardar no se escribe en `config/prompts`).
4. **Precios y servicios:** verificá que `lena`, `cerco`, `pergola`, `fogonero`, `bancos` tengan los textos y precios esperados; **Guardar** si cambiás algo.
5. **Cloud Run:** después de cambiar **prompt** o **servicios**, ejecutá o dejá disparado un **nuevo deploy** de `vicky-bot`. La recarga runtime acelera el cambio en la revisión viva, pero el redeploy sigue siendo la sincronización durable.
6. Opcional: en admin WhatsApp, **`#g`** + instructivo + **OK** aplica bloque a `sistemaPrompt` y recarga Gemini **solo en ese contenedor**; el panel y otras réplicas siguen alineándose con redeploy.

## Asistente Vicky y sincronización

- El chat flotante vive en todo el dashboard y crea propuestas en `assistant_runs`.
- Nada se aplica sin confirmar. Al confirmar, el dashboard escribe los documentos reales (`config/*`, `servicios/*`, `clientes/*`, `entregas_agenda/*`, etc.), guarda `assistant_changes` con `before/after` y actualiza `change_requests`.
- Si el cambio afecta comportamiento de Vicky, se escribe `config/general.recargarBotAt`; el bot lo detecta por polling (`VICKY_RUNTIME_RELOAD_POLL_MS`, default 60 s) o por `POST /internal/reload/runtime` con `Authorization: Bearer VICKY_CRON_SECRET`.
- Para disparar recarga inmediata desde el dashboard, configurar `VICKY_BOT_INTERNAL_RELOAD_URL` y `VICKY_CRON_SECRET` (o `VICKY_BOT_INTERNAL_RELOAD_SECRET`) en `vicky-dashboard`.
- Para disparar deploy durable desde el dashboard, configurar `GITHUB_ACTIONS_DISPATCH_TOKEN`, `GITHUB_REPOSITORY` (o owner/name separados) y opcionalmente `GITHUB_ASSISTANT_SYNC_WORKFLOW`.

## Si no hay historial de prompts útil

- El bot tiene un **`SYSTEM_PROMPT` de respaldo** en `bot.js` si `config/prompts.sistemaPrompt` está vacío o falla la lectura.
- Podés pegar en el panel un instructivo correcto (o copiar desde el fallback del código con cuidado de mantener reglas de marcadores que usás en producción) y **Guardar** + **redeploy**.

## Referencia de esquema

Detalle de campos: [`FIRESTORE_SCHEMA.md`](./FIRESTORE_SCHEMA.md).
