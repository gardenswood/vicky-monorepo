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
