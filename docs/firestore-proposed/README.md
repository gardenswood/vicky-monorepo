# Propuesta Firestore Vicky

Estos archivos son propuestas locales. No fueron aplicados a Firestore.

## Archivos

- `config-prompts.proposed.json`: reemplazo limpio para `config/prompts`.
- `config-general.proposed.json`: base limpia para `config/general`.
- `servicios.proposed.json`: servicios Gardens Wood a conservar/ofrecer.
- `config-promociones.proposed.json`: promociones y restricciones estructuradas.

## Criterio aplicado

- No mezclar promociones vencibles dentro del prompt principal.
- No duplicar precios en `sistemaPrompt` si ya existen en `servicios`.
- Dejar reglas permanentes en `config/prompts`.
- Dejar precios, envios y catalogo en `servicios`.
- Dejar campanas/delays/telefonos/modelo en `config/general`.
- Dejar promociones temporales en estructura separada.

## Antes de subir a Firebase

1. Revisar promociones vigentes.
2. Confirmar si se archivan o borran servicios ajenos a Gardens Wood.
3. Crear backup Firestore.
4. Implementar dashboard/bot si se va a usar `config-promociones`.
5. Aplicar cambios con script idempotente y registrar version.

