# Esquema Firestore — Vicky (webgardens-8655d)

Fuente de verdad para alinear bot, dashboard y archivos en [`firebase/`](../firebase/). El bot usa **Firebase Admin SDK** (no evalúa reglas de seguridad). El dashboard usa **Client SDK** (sí evalúa reglas).

Operación del panel, redeploy y recuperación de prompts: [`CONFIGURACION_PANEL_Y_BOT.md`](./CONFIGURACION_PANEL_Y_BOT.md).

## Colecciones

### `config` (documentos fijos)

| Documento | Campos principales | Escritura | Lectura bot |
|-----------|-------------------|-----------|-------------|
| `general` | `delayMinSeg`, `delayMaxSeg`, `modeloGemini`, `frecuenciaAudioFidelizacion`, `tiempoSilencioHumanoHoras`, `botActivo`, **`instagramDmActivo`**, `adminPhone`, **`datosEntregaNotifyPhone`**, horarios atención, `whatsappLabelIdContactarAsesor`, campañas (`campanaDelayMinSeg`, `campanaDelayMaxSeg`, `campanaMaxDestinatarios`, `campanaDescuentoPct`, `campanaRutaFechaTexto`, `campanaRutaPlantilla`), **`geocodeCronActivo`**, **`geocodeCronMaxPorEjecucion`**, **`whatsappGrupoJidAgendaEntregas`**, **`notificarAgendaEntregasGrupoActivo`**, **`colaLenaCapacidadCamionKg`** (default 1000), **`colaLenaUmbralDisparoRutaKg`**, **`recordatorioEntregaJuanActivo`** (bool, default true), **`recordatorioEntregaClienteActivo`** (bool, default true), **`recordatorioEntregaClienteHorasAntes`** (number, default 2), **`plantillaRecordatorioCliente`** (string con `{nombre}`, `{direccion}`, `{hora}`, `{producto}`), **`recargarBotAt`**, **`recargarBotMotivo`** | Panel → General / Asistente Vicky | Cache ~5 min en la mayoría de campos; **`botActivo`** y algunos toggles críticos se leen sin caché. Si cambia `recargarBotAt`, el bot recarga runtime (prompts, servicios, promos, skills y config general) por poll o endpoint interno. |
| `prompts` | `sistemaPrompt`, `sistemaPromptAdmin`, `mensajeBienvenidaTexto`, **`mensajeClienteCierreEntregaHumano`** (WhatsApp al cliente al disparar admin `#final_entrega`), **`instruccionCierreEntregaHumanoGemini`** (bloque extra al modelo mientras `chats/{jid}.cierreEntregaAsistido`) | Panel → Instrucciones AI | Al armar Gemini, el bot **anteponde** (código) el bloque fijo *IDENTIDAD GARDENS WOOD* y luego `sistemaPrompt` (o fallback `SYSTEM_PROMPT` en `bot.js`). Después: bloque servicios + `SYSTEM_PROMPT_SUFIJO_*` (ubicación, nombre, cola leña). Mantener `sistemaPrompt` alineado solo a Gardens Wood (no mezclar otro negocio). |

**Subcolección** `config/prompts/versiones/{id}` — historial de versiones del prompt (panel).

**Subcolección** `config/prompts/borradores/{borradorId}` — uso **histórico / panel**: el flujo actual de WhatsApp `#g` + *OK* **fusiona directo** en `config/prompts.sistemaPrompt` (sin pasar por esta subcolección). El panel puede seguir listando borradores viejos o crearlos por otras vías si aplica.

**Grupo WhatsApp (avisos agenda):** en `config/general` o env podés guardar el **JID** (`…@g.us`), el **enlace** `https://chat.whatsapp.com/…` o el **código** del enlace; el bot resuelve enlace/código a JID con Baileys al enviar. En el teléfono no se muestra el JID. Con la sesión Baileys del bot (`auth_info_baileys`), en la PC: `npm run wa:grupo-jid -- --list` o `npm run wa:grupo-jid -- --invite CODIGO`. Parar `node bot.js` antes del script. Ver `scripts/whatsapp-grupo-jid.js`.

### `servicios/{servicioId}`

IDs alineados con el bot y el panel: `lena`, `cerco`, `pergola`, `fogonero`, `bancos`.

| Campo | Tipo | Uso |
|-------|------|-----|
| `nombre` | string | Etiqueta |
| `activo` | bool | Si `false`, el bloque inyectado indica no ofrecer |
| `tieneEnvio` | bool | Solo relevante típicamente para leña |
| `infoEnvio` | string | Texto de zonas/cargos |
| `precios` | array `{ descripcion, precio, unidad }` | Lista para el LLM |
| `marcador` | string | ej. `[IMG:lena]` |
| `ultimaActualizacion` | timestamp | Panel al guardar |

**Escritura:** panel Precios y servicios o Asistente Vicky. **Lectura bot:** al arranque y por recarga runtime cuando `config/general.recargarBotAt` cambia; se anexa al system prompt como `[DATOS_SERVICIOS_FIRESTORE]`. Tras cambiar precios, conviene mantener **redeploy durable** de `vicky-bot` aunque la revisión en marcha ya pueda recargar.

### `chats/{jid}`

`jid` = JID de WhatsApp (ej. `549...@s.whatsapp.net`) **o** Instagram `ig:{scopedUserId}`.

| Campo | Notas |
|-------|--------|
| `ultimoMensaje`, `ultimoMensajeAt`, `mensajesCount`, `tel`, `nombre`, `estado`, `servicioPendiente`, `humanoAtendiendo`, `silenciadoHasta`, **`cierreEntregaAsistido`**, **`cierreEntregaAsistidoAt`**, … | Bot + panel (`cierreEntregaAsistido`: modo “Vicky cierra entrega” tras admin `#final_entrega`; se limpia al persistir `[ENTREGA:…]` OK) |
| `canal` | `instagram` cuando `jid` empieza con `ig:` (log al escribir mensajes) |

**Subcolección** `mensajes/{autoId}` — log de mensajes (contenido, tipo, dirección, timestamp, marcadores).

### `clientes/{tel}`

ID de documento: dígitos de línea WhatsApp (sin `@s.whatsapp.net`) **o** `ig:{scopedUserId}` para contactos Instagram. Sync desde bot + visualización/edición panel. Campos opcionales `canal` (`instagram`), `instagramUserId`, `remoteJid` (p. ej. `276…@lid` o `549…@s.whatsapp.net`).

| Campo CRM (opcional) | Tipo | Valores / notas |
|---------------------|------|-----------------|
| `telefono` | string (opcional) | Dígitos de la línea (suele coincidir con el id del doc cuando el chat es `@lid` mapeado). |
| `whatsappLid` | string (opcional) | Identificador LID sin `@lid`; enlaza la ficha `clientes/{tel}` con el hilo real del cliente. |
| `remoteJid` | string | JID técnico del hilo (`...@s.whatsapp.net`, `...@lid` o `ig:...`); se usa para abrir el chat correcto desde el panel. |
| `nombre` | string (opcional) | Nombre comercial/manual del cliente; prioridad visual en CRM. |
| `pushName` | string (opcional) | Nombre detectado desde WhatsApp o agenda del teléfono. Fallback visual si `nombre` todavía no fue completado. |
| `potencial` | string | `frio`, `tibio`, `caliente` |
| `statusCrm` | string | `pendiente_cotizacion`, `seguimiento`, `concreto`, `en_obra` |
| `urgencia` | string | `alta`, `media`, `baja` |
| `proximoContactoAt` | Timestamp | Próxima tarea de seguimiento; el bot la crea al cotizar, agendar o detectar intención fuerte. |
| `zona` | string | Texto libre; filtro campaña `#RUTA` |
| `interes` | array of string | ej. `lena`, `cerco`, `pergola`, `fogonero`, `bancos`, `madera`, `mantenimiento`; el CRM filtra por servicio pendiente o interés, y `#RUTA` puede matchear servicio también por este array |
| `tipoLenaPreferido` | string (opcional) | `hogar`, `salamandra` o `parrilla`; el panel y filtros de logística; el bot puede actualizarlo al registrar `[PEDIDO_LENA:…\|tipo]` |
| `lat`, `lng` | number (opcional) | Coordenadas para mapa logístico y `#ruta_geo`; manual, **Guardar** desde pin ámbar en `/logistica-mapa`, o lote **`npm run geocode:clientes`** en el repo del bot (`scripts/geocodificar-clientes-direccion.js`). En la ficha **Cliente**, **Ver en mapa** abre **Logística — mapa** centrado (`/logistica-mapa?lat=…&lng=…&tel=…`). El mapa enlaza `tel` de la URL con el pin del CRM comparando **misma línea** (p. ej. `351…` en el query vs `549351…` en el id de Firestore: últimos 10 u 8 dígitos; Instagram `ig:` solo por id exacto). **Siempre dibuja el pin azul del cliente del enlace** aunque los filtros lo oculten. **Dedupe** por clave canónica (últimos 10 dígitos en WhatsApp) para un solo azul y sin ámbar/cola naranja encima. La cola y la búsqueda por tel resuelven con dígitos completos o clave corta. En esa pantalla, los pins **azul** (CRM) y **ámbar** (aprox. por dirección) se **arrastran**; los cambios quedan pendientes hasta **Guardar cambios** en la barra del mapa (o **Descartar movimientos** para volver a la última versión guardada). Recién entonces se escriben `lat`/`lng` en `clientes/{id}` y se **limpian** los parámetros `lat`/`lng`/`tel` de la URL (desaparece el refuerzo violeta si aún estaba). **Quitar pin:** botón rojo **Eliminar pin** en el **panel “Pin seleccionado”** (al hacer **clic** en un pin azul en `/logistica-mapa`). En Next.js no hay que poner `useSearchParams()` en las dependencias del efecto que redibuja Leaflet: reinstancia el objeto y dispara `clearLayers` en casi cada render (rompe arrastre, panel y popups). El mapa usa claves estables (`lat`/`lng`/`tel` como strings, `geocodeOkKey` solo para geocodificaciones OK) y `pendingByTel` solo por ref. |
| `direccion` | string (opcional) | Calle y número / dirección de entrega; `[DIRECCION:…]` o panel |
| `barrio` | string (opcional) | Barrio o sector; marcador `[BARRIO:…]` o panel |
| `localidad` | string (opcional) | Ciudad o localidad (ej. Villa Allende); `[LOCALIDAD:…]` o panel |
| `referencia` | string (opcional) | Entre calles, portón, lote; `[REFERENCIA:…]` o panel |
| `notasUbicacion` | string (opcional) | Otros datos para ubicar (acceso, horario en puerta); `[NOTAS_UBICACION:…]` o panel |

El geocodificador (cron / `npm run geocode:clientes`) arma la búsqueda con **dirección + barrio + localidad + zona + referencia + notas** (truncado) + Córdoba, Argentina.

El bot puede rellenar CRM con marcadores internos en Gemini: `[CRM:…]`, `[DIRECCION:…]`, `[ZONA:…]`, `[BARRIO:…]`, `[LOCALIDAD:…]`, `[REFERENCIA:…]`, `[NOTAS_UBICACION:…]` (se eliminan antes de enviar al cliente). El CRM comercial es general para todos los servicios; la logística de leña queda separada en `consultasLena` / `/logistica-zonas` y `colaLena`.

**Identidad en CRM:** el panel muestra `nombre` o `pushName` y prioriza `telefono` como teléfono visible. Si solo existe `@lid`, lo muestra como identificador técnico, no como número telefónico. La búsqueda del CRM incluye `nombre`, `pushName`, `telefono`, `remoteJid` y `whatsappLid`.

**Chats `@lid`:** el id interno del chat no es el celular. El bot carga `lid_mapeo/*` al arranque, aprende LID→tel desde `contacts.upsert` de Baileys, y escribe la ficha en `clientes/{dígitos línea}`. Asociación manual admin: WhatsApp `!vicky #p lidmap LID_DIGITS TEL_DOC` (ej. `543516170743`) o `npm run seed:lid-mapeo -- LID TEL` en el repo del bot.

### `lid_mapeo/{lid}`

Mapeo persistente **LID de WhatsApp** (solo dígitos, sin `@lid`) → **teléfono** usado como id de `clientes/{tel}`.

| Campo | Tipo | Notas |
|-------|------|--------|
| `telefono` | string | Dígitos (ej. criterio operativo `543516170743`). |
| `actualizadoEn` | Timestamp | Auditoría. |

### `datos_entrega_cliente/{id}`

Registro cuando el cliente envía en un mensaje teléfono + dirección + franja y el bot notifica operación (`[NOTIFICAR_DATOS_ENTREGA]` o heurística). Lista en el panel **Agenda de entregas**. No sustituye `entregas_agenda` (día en calendario): Vicky debe emitir `[ENTREGA:…]` cuando haya fecha cerrada (regla 21c en fallback `bot.js`).

| Campo | Tipo | Notas |
|-------|------|--------|
| `jid` | string | JID del chat (p. ej. `…@lid`). |
| `telefonoLinea` | string (opcional) | Dígitos resueltos para CRM. |
| `nombre` | string (opcional) | Si constaba en contexto. |
| `mensajeCliente` | string | Texto entrante (truncado servidor). |
| `origen` | string | `gemini_marcador` \| `heuristica`. |
| `estado` | string | ej. `recibido`. |
| `creadoEn` | Timestamp | |

### `rutas_logistica/{rutaId}`

Polilínea de reparto / corredor para campaña **geo** (`#ruta_geo` en WhatsApp admin). El panel crea y edita; el bot lee con Admin SDK.

| Campo | Tipo | Notas |
|-------|------|--------|
| `nombre` | string | Etiqueta humana (aparece en plantilla `{zona}` al enviar campaña geo). |
| `polyline` | array `{ lat, lng }` | Mínimo **2** puntos; orden = trazo de la ruta. |
| `bufferMetros` | number | Distancia máxima (metros) del cliente a la polilínea para incluirlo en la campaña. |
| `activa` | bool (opcional) | Referencia operativa; el filtro usa siempre el doc solicitado por id. |
| `creadoEn` | Timestamp (opcional) | Auditoría. |
| `creadoPorUid` | string (opcional) | Firebase Auth uid del admin. |
| `notas` | string (opcional) | Texto libre. |

**Campaña:** solo entran clientes con `lat`/`lng` válidos en `clientes/*` y dentro del corredor; mismos filtros de servicio/tipo leña y silencios que `#RUTA` por zona. Ver **Logística — ruta / campaña geo** en el dashboard.

### `mensajes_programados/{id}`

Mensajes a enviar en una fecha/hora (`runAt`), creados por lógica del bot (p. ej. marcador `[AGENDAR:…]`) o por el dashboard. Campos típicos: `jid`, `texto`, `runAt`, `estado` (`pendiente` \| `enviado` \| `error`), `creadoEn`, `origen`. El cron HTTP del servicio Cloud Run procesa pendientes y actualiza estado.

**Contrato del bot:** el cron lee `texto` y `runAt` como `Timestamp`; `runAtMs` por sí solo no dispara envíos.

### `entregas_agenda/{id}`

Eventos de **entrega u obra con día concreto** para el calendario del panel (**Agenda de entregas**, `/agenda-entregas`). Tras cada **alta**, si en `config/general` está configurado **`whatsappGrupoJidAgendaEntregas`** (JID `…@g.us`) y **`notificarAgendaEntregasGrupoActivo`** no es `false`, el bot envía un mensaje resumen a ese **grupo WhatsApp** (la sesión Baileys debe ser miembro del grupo). Fallback env: **`WHATSAPP_GRUPO_JID_AGENDA_ENTREGAS`**. Deduplicación: **`notificadoGrupoAgenda`** / **`notificadoGrupoAgendaEn`**. El bot puede crear filas con el marcador interno **`[ENTREGA:YYYY-MM-DD|HH:mm o --|título]`** (ver `vicky-gemini-turn.js` + regla en `bot.js`). **Modo admin WhatsApp:** **`#entrega YYYY-MM-DD HH:mm|-- título`** con **puente `#c`** al cliente (mismo chat objetivo) o, sin puente, empezando el título con el **JID** (`…@s.whatsapp.net` o `…@lid`) y un espacio antes del título; **`#entrega`** + **solo 10–15 dígitos** de teléfono (sin guiones) → el bot resuelve cliente (WhatsApp + `clientes/…`), lee últimos mensajes en Firestore + CRM y **Gemini** infiere `fechaDia` / hora / título (`origen`: `whatsapp_admin_entrega_gemini`); si no hay fecha clara, responde aviso y conviene carga manual. **Listado por WhatsApp:** **`#entrega lista`** — próximos eventos con `fechaDia` ≥ hoy (zona **America/Argentina/Cordoba**), sin canceladas; **`#entrega lista todas`** incluye canceladas. **Menú admin** (frase secreta sola → opción *3*): asistente por pasos (tel → línea `YYYY-MM-DD …` → *OK*) con `origen` **`whatsapp_admin_menu_entrega`**. Al *OK* final, el bot **fusiona** el doc `clientes/{tel}` de Firestore con la memoria en proceso para rellenar **dirección**, **producto** (misma lógica que el bloque copiable), **notas** (nombre, zona, barrio, localidad, notas de ubicación) y **telefonoContacto**; en Cloud Run la memoria suele ir vacía, por eso sin lectura de `clientes/*` esos campos no se completan aunque existan en el panel. Chats **`@lid`**: la ficha no es `clientes/{lid}`; el bot resuelve por **`lid_mapeo`**, campo **`whatsappLid`** o **`remoteJid`** igual que el resto del CRM. Si en el paso *detalle* pegás el bloque y trae líneas `Dirección:` / `Producto:` con texto real, también se guardan en la agenda aunque el CRM venga vacío. Alias **`!!entrega`** si `#` lo altera WhatsApp. No confundir con **`#g`** (solo instructivo Gemini). El panel puede dar de alta manualmente, **editar** campos (día, hora, título, JID, contacto, dirección, producto, notas), **eliminar** el documento (borrado en Firestore) o marcar **`hecha`** / **`cancelada`** (sigue en colección; cancelada deja de mostrarse en el calendario salvo vistas que incluyan canceladas).

**Coincidencia teléfono ↔ ficha:** al resolver `clientes/{id}` por variantes de dígitos (wizard menú *3*, `resolverJidClientePorVariantesTelefono`, `getClienteDocDataParaAvisoAgenda`), si la ficha tiene `remoteJid` terminado en `@s.whatsapp.net`, **solo** se acepta si el usuario de ese JID coincide con los dígitos buscados (no alcanza que el `docId` coincida por cola de dígitos si el JID apunta a otro WhatsApp). Si no hay JID `@s` válido, se usan `docId` y `telefono`. En el menú *3*, el **Tel** del bloque copiable es siempre el número que escribió el admin; nombre/pushName que parecen solo teléfono no se muestran como “Nombre” ni en el título sugerido.

| Campo | Tipo | Notas |
|-------|------|--------|
| `fechaDia` | string | `YYYY-MM-DD` (clave para consultas por mes). |
| `horaTexto` | string (opcional) | Texto libre corto, ej. `09:00`; vacío o `--` = día sin hora fija. |
| `titulo` | string | Resumen visible en el calendario. |
| `notas` | string (opcional) | Detalle interno. |
| `telefonoContacto` | string (opcional) | Línea de contacto: el bot intenta rellenarlo con mapeo LID→WA, JID `@s.whatsapp.net`, o los dígitos del admin (wizard menú *3* o `#entrega` + solo tel); el panel **Agenda** también puede editarlo. En el aviso al grupo, si no hay número claro y el chat es `@lid`, el texto indica revisar panel/CRM. |
| `direccion` | string (opcional) | Dirección operativa del día (copia; la ficha **Cliente** sigue siendo fuente CRM principal). |
| `producto` | string (opcional) | Producto y características a entregar (texto libre). |
| `jid` | string (opcional) | JID WhatsApp / `ig:…` para enlace al chat en el panel. |
| `kg` | number (opcional) | Kg si aplica. |
| `origen` | string | ej. `panel`, `gemini_entrega`, `whatsapp_admin_entrega`, `whatsapp_admin_entrega_gemini` (#entrega + solo tel → Gemini infiere fecha desde hilo), `whatsapp_admin_menu_entrega` (menú admin opción 3). |
| `estado` | string | `pendiente` \| `hecha` \| `cancelada`. |
| `notificadoGrupoAgenda` | bool (opcional) | `false` al crear; el bot pone `true` tras enviar el aviso al grupo WA. |
| `notificadoGrupoAgendaEn` | Timestamp (opcional) | Cuándo se confirmó el envío al grupo. |
| `juanNotificadoAt` | Timestamp (opcional) | Cuándo se notificó al encargado de reparto (Juan). `null` si aún no. |
| `recordatorioClienteDocId` | string (opcional) | ID del `mensajes_programados` del recordatorio al cliente. `null` si no se creó. |
| `creadoEn`, `actualizadoEn` | Timestamp | Auditoría. |

Verificación en consola o local: `npm run verify:cliente-agenda -- <dígitos>` (script en `scripts/verificar-cliente-agenda.js`) imprime `clientes/*` y filas de `entregas_agenda` con el mismo JID.

**No reemplaza** la cola grupal de leña (`colaLena`): pedidos ≤200 kg siguen en **Cola de leña** hasta que operativamente asignes un día (manual o con `[ENTREGA:…]`).

Si en **Instrucciones AI** reemplazás el `sistemaPrompt` completo en Firestore, copiá también la línea del marcador **`[ENTREGA:…]`** desde el fallback en `bot.js` (misma redacción que en producción), si no Gemini no lo emitirá.

La **regla 17b** del fallback en `bot.js` (comprobantes de transferencia: no pedirlos salvo cliente con al menos una transferencia previa documentada) forma parte del comportamiento operativo; si tu `sistemaPrompt` en Firestore **reemplaza** todo el texto, incorporá esa regla o redeploy solo alinea el arranque desde el archivo.

### `colaLena/{pedidoId}`

Pedidos pequeños de leña (≤200 kg por marcador); **fuente operativa del bot** sigue siendo `cola_lena.json` en GCS + RAM. Firestore es **espejo** para el panel **Cola logística de leña** y para marcar estados operativos.

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` (doc) | string | Estable: `cola_{dígitosWhatsApp}` (mismo criterio que el tel en JID, sin `@s.whatsapp.net`). |
| `remoteJid` | string | JID WhatsApp del cliente. |
| `nombre`, `direccion`, `zona` | string | CRM / cola. |
| `cantidadKg` | number | Kg del pedido en cola. Puede ser **0** (pendiente) en alta manual `#cola_lena` solo con tel/CRM sin kg en historial; no suma al umbral hasta actualizar. El umbral de disparo de ruta es **`config/general.colaLenaUmbralDisparoRutaKg`** (default 1000). |
| `lat`, `lng` | number (opcional) | Copia de coordenadas de `clientes/{tel}` al armar la ruta (optimización); el mapa logístico puede usarlos si el panel los muestra. |
| `tipoLena` | string (opcional) | `hogar`, `salamandra` o `parrilla` si Gemini emitió `[PEDIDO_LENA:kg\|dir\|tipo]`. |
| `tel` | string (opcional) | Dígitos para búsqueda y display en panel. |
| `fechaPedido` | Timestamp | En Firestore; en GCS el JSON puede llevar ISO string. |
| `estado` | string | `en_cola` → `notificado` → `entregado` (panel puede actualizar estado). |
| `ordenRuta` | number (opcional) | 1…N cuando el bot alcanzó el umbral de kg y optimizó el orden (**Directions `optimize:true`** o vecino más cercano); **no** aplica en `en_cola` (el sync del bot borra estos campos en Firestore para ítems en cola). |
| `rutaGrupoId` | string (opcional) | Identificador del lote al disparar la ruta (ej. `rg_{timestamp}`). |

**Escritura bot:** `syncColaLena` en lotes (≤400 docs por tanda), `merge: true`. No borra documentos de clientes que ya no están en el array en memoria (solo actualiza el snapshot enviado). Tras cada cambio de cola: GCS + sync; al conectar/reconectar WhatsApp, si hay pedidos, se vuelve a sincronizar.

**Disparo “zona cercana” (`config/general`):** con `colaLenaUmbralClusterZonaKg` (ej. 800) y prefijo común entre el primer token de `zona` o `dirección` de cada pedido (`colaLenaClusterZonaMinPrefijo`, default 6), el bot arma ruta aunque no se haya llegado a `colaLenaUmbralDisparoRutaKg`. Poné **`colaLenaUmbralClusterZonaKg: 0`** para desactivar. Tras armar la ruta: plantilla `colaLenaPlantillaWAClienteRutaArmada` a cada cliente (`{nombre}`, `{zona}`, `{kg}`), aviso al admin y copia opcional a `colaLenaTelefonoAvisoRutaCopia` (solo dígitos, ej. Juan).

### `consultasLena/{consultaId}`

Consultas manuales de clientes interesados en leña que todavía **no** son pedidos confirmados ni parte de `colaLena`. Las carga Vicky desde el panel cuando un cliente pide menos de un despacho mínimo o queda pendiente de agrupar por zona.

| Campo | Tipo | Notas |
|-------|------|--------|
| `remoteJid` | string | JID WhatsApp del cliente (`…@s.whatsapp.net`). |
| `tel` | string | Dígitos del teléfono; se usa para cruzar con `clientes/{tel}`. |
| `nombre` | string | Nombre visible en el panel. |
| `zona` | string | Zona libre para agrupar consultas y calcular umbral. |
| `cantidadKg` | number | Consulta manual, validada en panel entre 1 y 499 kg. |
| `notas` | string \| null | Texto interno opcional. |
| `fechaConsulta` | Timestamp | Fecha de alta. |
| `estado` | string | `pendiente` → `zona_lista` / `admin_notificado` → `confirmado` → `enviado`. |
| `fechaNotificacionAdmin`, `fechaConfirmacion`, `fechaEnvio` | Timestamp opcional | Auditoría del flujo del panel. |
| `origen` | string | ej. `dashboard`, `dashboard_clientes`, `dashboard_cliente_detalle`. |
| `creadoEn`, `actualizadoEn` | Timestamp | Auditoría. |

La página **Zonas & Consultas** (`/logistica-zonas`) agrupa estados activos (`pendiente`, `zona_lista`, `admin_notificado`, `confirmado`) por `zona`, usa `config/general.colaLenaUmbralClusterZonaKg` (default 800) y escribe en `mensajes_programados` para avisar al admin o a clientes. No reemplaza `colaLena`: cuando el pedido ya está confirmado para despacho, el flujo operativo sigue en `colaLena` / agenda.

### `vicky_skills/{skillId}`

Skills internas de Vicky versionadas en Git (`apps/bot/vicky-skills`) y editables desde el panel **Instrucciones AI → Skills Vicky**.

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | string | `vendedor`, `funciones-dashboard`, etc. |
| `nombre` | string | Nombre visible e inyectado al prompt. |
| `contenido` | string | Markdown con reglas operativas para el bot. |
| `activo` | bool | Si es `false`, el bot no la inyecta. |
| `orden` | number | Orden de inyección en el system prompt. |
| `archivo` | string opcional | Archivo fuente en Git. |
| `origen` | string | `git`, `dashboard`, etc. |
| `actualizadoEn` | Timestamp | Auditoría. |

Subcolección `vicky_skills/{skillId}/versiones/{versionId}`: snapshots guardados por el dashboard antes de actualizar una skill.

El bot lee `vicky_skills/*` al armar Gemini. Si Firestore no tiene skills, usa fallback local desde `apps/bot/vicky-skills/*.md`.

### Asistente Vicky: `assistant_runs`, `assistant_changes`, `change_requests`

El dashboard monta un chat flotante global y escribe cambios operativos mediante APIs server-side (`apps/dashboard/src/app/api/assistant/*`) con Firebase Admin SDK. El usuario siempre confirma antes de aplicar.

`assistant_runs/{runId}`:

| Campo | Tipo | Notas |
|-------|------|-------|
| `message` | string | Pedido original del usuario. |
| `origin` | string | `dashboard`, `whatsapp_admin`, `cursor_chat` o `code`. |
| `user` | map | `uid`, `email`, `role`, `nombre`. |
| `status` | string | `planned`, `needs_more_detail`, `applying`, `applied`, `failed`, `rolled_back`. |
| `operations` | array | Cambios validados: destino Firestore, descripción, `before`/`after`, flags `requiresBotReload` / `requiresDeploy`. |
| `sync` | map | Estado de Firestore, recarga bot, GitHub Actions/Cloud Build y Cloud Run. |
| `createdAt`, `updatedAt`, `appliedAt`, `rolledBackAt` | Timestamp | Auditoría. |

`assistant_changes/{changeId}`:

| Campo | Tipo | Notas |
|-------|------|-------|
| `runId` | string | Relación con `assistant_runs`. |
| `operation` | map | Operación aplicada. |
| `before`, `after` | map/null | Snapshot para auditoría y rollback. |
| `rollbackStatus` | string | `available` o `rolled_back`. |
| `appliedBy`, `rolledBackBy` | map | Usuario del panel. |

`change_requests/{runId}`:

| Campo | Tipo | Notas |
|-------|------|-------|
| `message`, `origin`, `status`, `operationCount` | varios | Cola unificada de cambios para dashboard, WhatsApp admin, Cursor/chat o código. |
| `createdBy` | map | Usuario u origen. |
| `createdAt`, `updatedAt` | Timestamp | Auditoría. |

**Reglas:** lectura para usuarios autenticados del panel; escritura directa desde cliente denegada. Las APIs del dashboard aplican cambios con Admin SDK y registran auditoría.

### `adminWaSesion/{docId}`

Sesión del **modo admin por WhatsApp** (frase secreta, `#g`, puente `#c`, borrador Gemini, etc.) para que funcione con **varias réplicas** de Cloud Run: el estado no queda solo en memoria del contenedor.

| Campo | Notas |
|-------|--------|
| `remoteJid` | JID del chat donde se activó la sesión (ej. mismo número Business / “guardados” / admin). |
| `activadoEn` | `number` (ms) o Timestamp; validez **1 h** en código (`ADMIN_SESSION_TTL`). |
| `listaClientes` | mapa `{ "1": "jid", … }` para atajos numéricos. |
| `destinatarioPendiente` | `null` o `{ jid, etiqueta }` (flujo dos pasos). |
| `modoBridge`, `bridgeTarget`, `esperandoSelectorPuente` | Estado puente / lista (sí se replica). |
| `ultimoReporteIndice`, `ultimoReporteAt` | Tras *#reporte*: agregados para interpretar *detalle caliente*, *detalle estado X*, *detalle servicio Y*, *detalle log*, *detalle mensajes hoy* (también funciona sin índice previo). |
| `pListaIndex` | Cache de ítems para *#p lista* (sí se replica). |
| `esperandoMenuPrincipal` | Tras la frase secreta **sin** texto cola: menú numerado hasta elegir 1–4 o un comando con *#*. |
| `wizard` | Asistente por pasos (ej. `tipo: agenda_entrega`, `paso: tel \| detalle \| confirmar`, `jid`, fechas); se replica entre réplicas. |
| `esperandoInstructivoGemini`, `borradorGeminiPreview` | **No** se guardan en este doc (solo RAM del contenedor). Con *OK*, el bot escribe en `config/prompts.sistemaPrompt` y recarga Gemini en ese proceso. |

**Escritura:** solo el bot (Admin SDK). El panel no lee esta colección. Las reglas de cliente pueden denegar acceso; el Admin SDK no las aplica.

### `mensajes_log/{autoId}`

Log agregado para métricas (dashboard home y **#reporte** / *detalle mensajes hoy* en admin WhatsApp). Campos: `jid`, `tipo`, `direccion` (`entrante` \| `saliente`), `servicio` (copia de `servicioPendiente` del chat al loguear — agrupa “por servicio” el volumen del día), `timestamp`. Consulta día civil **America/Argentina/Cordoba** con rango `timestamp` (índice simple en `timestamp`).

### `usuarios/{uid}`

Gestión de usuarios del panel (Firebase Auth uid).

## Índices versionados

Archivo [`firebase/firestore.indexes.json`](../firebase/firestore.indexes.json) incluye compuestos necesarios para:

- `mensajes_programados`: consulta por `estado` + `runAt` (cron de envíos).
- `config/prompts/borradores`: `estado` + `creadoEn` descendente (panel).

Si la consola sugiere otro índice compuesto, agregalo ahí y volvé a `firebase deploy --only firestore`.

Si al desplegar aparece que hay índices en la nube que no están en el archivo, es opcional alinearlos con `firebase deploy --only firestore --force` (borra índices extra en el proyecto; usalo solo si sabés qué se elimina).

## Reglas de seguridad

[`firebase/firestore.rules`](../firebase/firestore.rules): lectura/escritura para `request.auth != null` en colecciones del panel; reglas específicas para `borradores` y `mensajes_programados` según el archivo. Endurecer con custom claims si abrís registro público.

## Despliegue desde Git

Ver [RUNBOOK_DEPLOY.md](../RUNBOOK_DEPLOY.md) — sección Firestore, cron y workflow GitHub.
