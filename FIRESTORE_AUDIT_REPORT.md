# Auditoria Firestore Vicky - webgardens-8655d

Fecha de lectura: 2026-04-29

Modo usado: solo lectura por API REST de Firestore con `gcloud auth print-access-token`.

Archivos exportados:

- `config-prompts.json`: documento vivo `config/prompts`.
- `config-general.json`: documento vivo `config/general`.
- `servicios.json`: coleccion viva `servicios`.
- `prompt-versiones.json`: ultimas versiones guardadas del prompt.
- `prompt-borradores.json`: borradores historicos de instrucciones.
- `audit-normalized.json`: version simplificada para lectura humana.

## Hallazgos principales

### 1. Firestore tiene instrucciones vivas que no estan limpias en los repos

El documento `config/prompts` contiene `sistemaPrompt` version 14, actualizado el `2026-04-23T15:12:16Z`, con instrucciones acumuladas desde WhatsApp.

Ejemplos detectados:

- Promo de cercos hasta el 30 de abril con 30% de descuento.
- Precios promocionales de cercos: `1.80 Alto $110.000` y `2 a 2.5 Alto $140.000`.
- Envio sin cargo para 1 tonelada de lena a toda Cordoba en instrucciones fechadas el 13 y 20 de abril.
- Correcciones operativas: no ofrecer carbon, no pasar alias/cuentas bancarias, numero correcto de Gardens, no responder como inmobiliaria.
- Bloqueo puntual: no enviar mas mensajes a un numero especifico.

Conclusion: si se redeploya solo desde GitHub sin preservar Firestore, se puede cambiar el comportamiento real de Vicky.

### 2. Hay mezcla de Gardens Wood con contenido inmobiliario

En `config/prompts.sistemaPromptAdmin` todavia aparece texto de "bot inmobiliario" y campanas por venta/alquiler/tasacion/administracion.

En `servicios` hay documentos activos que no corresponden a Gardens Wood:

- `administracion`
- `alquiler`
- `consultoria`
- `tasacion`
- `venta`

El dashboard actual, en cambio, esta preparado principalmente para:

- `lena`
- `cerco`
- `pergola`
- `fogonero`
- `bancos`
- `madera`

Conclusion: antes de desplegar o ampliar difusiones, conviene separar/limpiar servicios activos para que el bot no use datos equivocados.

### 3. Config general contiene campos vivos que deben pasar al dashboard

Campos relevantes detectados en `config/general`:

- `botActivo`
- `modeloGemini`
- `delayMinSeg` / `delayMaxSeg`
- `tiempoSilencioHumanoHoras`
- `whatsappAtencionCliente`
- `datosEntregaNotifyPhone`
- `whatsappGrupoJidAgendaEntregas`
- `notificarAgendaEntregasGrupoActivo`
- `geocodeCronActivo`
- `geocodeCronMaxPorEjecucion`
- `campanaDelayMinSeg` / `campanaDelayMaxSeg`
- `campanaMaxDestinatarios`
- `campanaDescuentoPct`
- `campanaRutaFechaTexto`
- `campanaRutaPlantilla`
- `instagramDmActivo`
- `instagramDmSoloEnlaceWhatsapp`
- `instagramDmMensajeEnlaceWhatsapp`

Conclusion: el dashboard debe mostrar y editar estos campos con etiquetas claras, para que no haya que tocar Firestore a mano.

### 4. Hay borradores historicos utiles

`prompt-borradores.json` contiene instrucciones sobre fletes de lena:

- Villa Allende sin cargo desde 200 kg.
- Mendiolaza sin cargo por tonelada; menos de eso con flete.
- Unquillo, Rio Ceballos y otras zonas con valores de envio.

Conclusion: estos borradores conviene revisarlos con el humano antes de incorporarlos como regla vigente.

## Recomendacion operativa

Antes de tocar produccion:

1. Congelar una copia local de `config/prompts`, `config/general` y `servicios` como respaldo.
2. Crear en el dashboard una seccion "Instrucciones vigentes" que permita ver:
   - instrucciones permanentes,
   - promociones temporales,
   - restricciones/no ofrecer,
   - campanas y difusiones,
   - historial de cambios.
3. Separar instrucciones temporales de `sistemaPrompt` para que tengan fecha de vencimiento.
4. Agregar CRM de contactos con intereses, tags, estado comercial, recordatorios y segmento para difusion.
5. Limpiar o desactivar servicios inmobiliarios solo con confirmacion explicita.
6. Recién despues alinear bot, dashboard, Firestore y despliegue VPS.

## Acciones que requieren confirmacion antes de ejecutar

- Escribir o modificar cualquier documento en Firestore.
- Desactivar o borrar servicios inmobiliarios en `servicios`.
- Cambiar `config/prompts` o `config/general`.
- Desplegar Cloud Run, Firebase, GitHub Actions o VPS.
- Subir cambios a GitHub.

