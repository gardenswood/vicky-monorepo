# Sincronización de instrucciones: WhatsApp, Dashboard, Firebase y Git

## Regla elemental

Toda modificación de instrucciones, skills, precios, promociones o comportamiento estable debe quedar reflejada en:

1. Firebase, porque es la fuente operativa que lee Vicky.
2. Dashboard, porque el humano debe poder verla y editarla.
3. Git, porque es el historial auditable y reproducible.
4. Deploy, cuando el bot o dashboard necesitan recargar código o contexto.

## Si el cambio nace en WhatsApp

1. Admin usa `#g`, `!!g` o `vicky:g` y confirma con `OK`.
2. El bot escribe en `config/prompts` y recarga la réplica actual.
3. Exportar snapshot:
   ```bash
   npm run config:export
   ```
4. Commit y push del snapshot.
5. Redeploy de `vicky-bot` si el cambio debe impactar todas las réplicas.

## Si el cambio nace en Dashboard

1. Guardar desde la pantalla correspondiente.
2. Verificar que el documento Firestore cambió.
3. Exportar snapshot:
   ```bash
   npm run config:export
   ```
4. Commit y push del snapshot.
5. Redeploy de `vicky-bot` si el dato se lee al arranque o si se modificaron skills.

## Si el cambio nace en Código

1. Editar archivos versionados (`bot.js`, docs, `vicky-skills/*`, reglas, dashboard).
2. Importar skills/config versionada cuando corresponda:
   ```bash
   npm run config:import
   ```
3. Desplegar reglas Firebase si cambiaron.
4. Desplegar dashboard y/o bot según el área tocada.
5. Commit y push.

## Fuente de verdad

- Firestore: estado operativo en vivo.
- Git: código, reglas, documentación y snapshots auditables.
- Dashboard: interfaz humana para editar y verificar.
- Bot: consumidor operativo que debe recargarse o redeployarse cuando la lectura no sea live.

## Skills Vicky (`vicky_skills`)

El bot **siempre prioriza** los documentos en Firestore (`vicky_skills/*`). Si la colección está vacía o falla la lectura, usa **fallback** desde `apps/bot/vicky-skills/*.md` según `vicky-skills/index.json`.

**Flujo recomendado (equipo/dev, sin desalinear panel y Git):**

1. Editar los `.md` en **`apps/bot/vicky-skills/`** (y `index.json` si se agrega o reordena una skill).
2. Commit y push en Git.
3. Subir el mismo contenido a Firebase (operativo + lo que ve el dashboard):
   ```bash
   cd apps/bot
   npm run config:import
   ```
   El script también actualiza **`config/general.recargarBotAt`** para que el bot recargue el system prompt (incluye skills) en el **poll de runtime (~60 s)** sin redeploy obligatorio.
4. Opcional pero recomendable: refrescar el snapshot versionado:
   ```bash
   npm run config:export
   ```
   y commitear `config-snapshots/vicky-runtime-config.json`.
5. **Redeploy de `vicky-bot`** solo si necesitás alinear **código** nuevo o forzar arranque limpio en todas las revisiones; para skills/prompt vía Firestore alcanza con el paso 3.

**Si alguien editó solo desde el panel:** Firestore quedó distinto de Git. Para alinear, copiar el texto al `.md` correspondiente en el repo **o** volver a ejecutar `config:import` tras corregir Git para que Firestore refleje la versión acordada.

**No** dejar solo el cambio en Git sin `config:import`: en producción Gemini seguirá leyendo Firestore y no verá el markdown nuevo hasta importar.

## Colecciones principales

- `config/prompts`
- `config/promociones`
- `config/general`
- `servicios/*`
- `vicky_skills/*`
- `mensajes_programados`
- `entregas_agenda`
- `clientes`
- `chats`
- `colaLena`
- `consultasLena`
