# Plan profesional de actualizacion - Vicky Gardens Wood

Objetivo: dejar bot, dashboard, Firestore y futuro VPS ordenados, sin datos de rubros ajenos, sin duplicaciones y preservando las ultimas reglas operativas utiles que se cargaron por WhatsApp.

Estado actual: trabajo local. No se escribio en Firestore, no se desplego y no se hizo push.

## 1. Diagnostico

Archivos auditados:

- `firestore-audit/config-prompts.json`
- `firestore-audit/config-general.json`
- `firestore-audit/audit-normalized.json`
- `firestore-audit/prompt-borradores.json`
- `firestore-audit/prompt-versiones.json`
- `firestore-audit/servicios.json`
- `firestore-audit/FIRESTORE_AUDIT_REPORT.md`

Hallazgos:

- `config/prompts.sistemaPrompt` tiene instrucciones acumuladas desde WhatsApp, utiles pero desordenadas.
- `config/prompts.sistemaPromptAdmin` esta orientado a un rubro ajeno a Gardens Wood.
- `config/general.campanaRutaPlantilla` usa lenguaje ajeno a Gardens Wood.
- `servicios` contiene documentos activos fuera del rubro Gardens Wood.
- `servicios/lena` contiene productos que luego fueron deshabilitados por instruccion humana.
- Hay promociones temporales mezcladas dentro del prompt principal.
- Hay reglas permanentes que deben quedar limpias: no datos bancarios, no carbon, numero correcto, direccion, tono variado, CRM.

## 2. Estructura propuesta

Documentos locales preparados:

- `docs/firestore-proposed/config-prompts.proposed.json`
- `docs/firestore-proposed/config-general.proposed.json`
- `docs/firestore-proposed/servicios.proposed.json`
- `docs/firestore-proposed/config-promociones.proposed.json`

Distribucion correcta:

- `config/prompts`: identidad, tono, reglas de conversacion, marcadores internos, cierre de entrega y prompt admin.
- `config/general`: delays, modelo Gemini, telefonos, horarios, campanas, Instagram, geocoding, grupo operativo.
- `servicios/{id}`: catalogo, precios, envio y estado activo de cada servicio.
- `config/promociones` o coleccion futura `promociones`: promociones temporales con fecha, estado y reglas.
- `clientes/{tel}`: CRM, intereses, tags, estado comercial, recordatorios y difusion.

## 3. Limpieza recomendada para Firestore

Antes de aplicar, crear backup/export de:

- `config/prompts`
- `config/general`
- `servicios`
- `config/prompts/versiones`
- `config/prompts/borradores`

Cambios propuestos:

1. Reemplazar `config/prompts` por `config-prompts.proposed.json`.
2. Reemplazar o fusionar `config/general` con `config-general.proposed.json`.
3. Reemplazar `servicios` por los servicios validos de `servicios.proposed.json`.
4. Remover o archivar documentos de servicios ajenos al rubro Gardens Wood.
5. Quitar de `servicios/lena` productos deshabilitados por instruccion humana.
6. Crear estructura de promociones solo si el bot/dashboard se actualizan para leerla.

## 4. Punto critico: promociones temporales

No conviene dejar promociones dentro del prompt principal porque vencen y quedan activas para siempre.

Decision recomendada:

- Promo cercos 30%: puede quedar como activa hasta `2026-04-30`, pero debe tener fecha de vencimiento.
- Envio sin cargo por 1 tonelada de lena: requiere confirmacion humana, porque la instruccion original decia "hoy".

Mientras el bot no lea `config/promociones`, hay dos opciones:

1. Opcion rapida: incluir solo promociones confirmadas dentro de `config/prompts.sistemaPrompt` con vencimiento escrito claramente.
2. Opcion prolija: modificar bot y dashboard para leer/escribir promociones estructuradas.

Recomendacion: opcion prolija antes de VPS.

## 5. Cambios necesarios en dashboard

### Instrucciones AI

Mejorar `apps/dashboard/src/app/(dashboard)/config/prompts/page.tsx`:

- Mostrar advertencia si detecta palabras/rubros ajenos a Gardens Wood.
- Separar tabs:
  - Prompt principal
  - Prompt admin
  - Mensajes
  - Cierre entrega
  - Promociones
  - Restricciones
- Guardar historial antes de aplicar cambios.
- Permitir restaurar versiones sin perder auditoria.

### Precios y servicios

Mejorar `apps/dashboard/src/app/(dashboard)/config/precios/page.tsx`:

- Filtrar por defecto solo servicios Gardens Wood.
- Mostrar "servicios archivados" por separado.
- Evitar que documentos ajenos aparezcan como servicios ofrecibles.
- Permitir activar/desactivar servicios sin borrar historial.
- Indicar que `servicios/*` prevalece sobre ejemplos del prompt.

### CRM

Mejorar clientes:

- `apps/dashboard/src/app/(dashboard)/clientes/page.tsx`
- `apps/dashboard/src/app/(dashboard)/clientes/[tel]/page.tsx`

Agregar:

- potencial: frio, tibio, caliente.
- statusCrm: pendiente_cotizacion, seguimiento, concreto, en_obra.
- urgencia: alta, media, baja.
- intereses/tags: lena, cercos, pergolas, fogonero, bancos, madera.
- proximoContactoAt.
- notas internas e historial.
- consentimiento o criterio para difusion.
- filtro de clientes por producto/interes para futuras campanas.

## 6. Cambios necesarios en bot

Prioridad:

1. Filtrar servicios ofrecibles por allowlist Gardens Wood o por `activo === true` y `categoria === gardens_wood`.
2. Leer promociones estructuradas si se crea `config/promociones` o `promociones/*`.
3. Aplicar vencimiento automatico de promociones.
4. Guardar CRM desde marcadores `[CRM:...]`, intereses y recordatorios.
5. Respetar bloqueos de contacto antes de difusiones.
6. Mantener fallback de prompt en codigo, pero Firestore debe ser fuente editable desde dashboard.

Si WhatsApp/Baileys complica el despliegue VPS:

- Mantener bot donde funciona actualmente.
- Desplegar solo dashboard y repo unificado.
- Mover bot a VPS recien cuando este resuelto almacenamiento de sesion, GCS/credenciales y reconexion.

## 7. Monorepo

Estructura local ya creada:

```text
apps/
  bot/
  dashboard/
infra/
  docker/
docs/
  firestore-proposed/
```

Pendiente:

- Decidir repo destino de GitHub.
- Confirmar si se preserva historial via `git subtree` o si se sube como repo nuevo.
- Instalar dependencias y correr builds.
- Agregar GitHub Actions solo despues de validar secrets.

## 8. VPS Hostinger

Preparacion:

- Docker Compose para `bot` y `dashboard`.
- Nginx o reverse proxy con SSL.
- Variables separadas por servicio.
- Backup de `.env` fuera de Git.
- Logs y reinicio automatico.
- Healthchecks.

Riesgo principal del bot en VPS:

- Sesion WhatsApp/Baileys y persistencia.
- Acceso seguro a Firebase/GCS.
- Webhooks/cron.
- Reconexion y QR si se cae sesion.

Plan seguro:

1. Subir dashboard primero.
2. Probar lectura/escritura Firestore desde panel.
3. Mantener bot actual estable.
4. Migrar bot a VPS solo con ventana de prueba y rollback.

## 9. Orden de ejecucion recomendado

1. Revisar artefactos propuestos con humano.
2. Confirmar promociones vigentes y restricciones.
3. Implementar dashboard para editar todo desde UI.
4. Implementar bot para leer promociones/restricciones estructuradas.
5. Probar local.
6. Crear backup Firestore.
7. Aplicar cambios a Firestore con script controlado.
8. Validar bot responde bien con datos limpios.
9. Subir monorepo a GitHub.
10. Preparar VPS y desplegar dashboard.
11. Evaluar migracion del bot al VPS.

## 10. Acciones que requieren confirmacion explicita

- Escribir en Firestore.
- Borrar o archivar documentos de servicios.
- Cambiar `config/prompts` o `config/general`.
- Desplegar dashboard o bot.
- Subir a GitHub.
- Migrar el bot de WhatsApp al VPS.

