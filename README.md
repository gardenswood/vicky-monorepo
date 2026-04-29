# Vicky Monorepo

Repositorio unificado para Vicky Gardens Wood.

## Estructura

```text
apps/
  bot/        Bot WhatsApp Vicky (Baileys, Gemini, Firestore)
  dashboard/  Panel admin Vicky (Next.js, Firebase/Firestore)
infra/
  docker/     Archivos de despliegue VPS
```

## Estado actual

- Los repos originales fueron copiados localmente bajo `apps/bot` y `apps/dashboard`.
- No se hizo push a GitHub.
- No se modifico Firestore ni Cloud Run.
- La auditoria de Firestore esta documentada en `FIRESTORE_AUDIT_REPORT.md`.

## Comandos locales

```powershell
npm run bot:start
npm run dashboard:dev
npm run dashboard:build
```

Cada app conserva su propio `package.json` y `package-lock.json`.

## Seguridad operativa

Antes de cualquier cambio en produccion hay que pedir confirmacion explicita para:

- escribir en Firestore,
- desplegar Cloud Run/Firebase/VPS,
- modificar reglas o indices,
- subir cambios a GitHub,
- desactivar servicios o instrucciones vigentes.

