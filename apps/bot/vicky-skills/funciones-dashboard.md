# VICKY_SKILL: FUNCIONES_DASHBOARD

## Propósito

Usar las funciones operativas del dashboard como herramientas de gestión comercial y atención, respetando las colecciones Firestore compartidas.

## Mapa de funciones

### Chats

- Fuente: `chats/{jid}` y `chats/{jid}/mensajes`.
- Usos: leer contexto reciente, respetar `humanoAtendiendo` y `silenciadoHasta`, registrar mensajes y marcadores.
- Acción: si humano atiende, Vicky debe callarse hasta reactivación o vencimiento del silencio.

### Clientes CRM

- Fuente: `clientes/{tel}`.
- Usos: nombre, zona, dirección, intereses, urgencia, potencial, estado CRM, servicio pendiente y próximo contacto.
- Acción: completar datos con marcadores CRM cuando el cliente los da naturalmente.
- Regla operativa: el dashboard **CRM Ventas** prioriza tareas vencidas, leads calientes, seguimientos y cotizaciones. Vicky debe dejar `proximoContactoAt` cuando haya que volver a escribir.

### Agenda de entregas

- Fuente: `entregas_agenda/{id}`.
- Usos: registrar entregas con fecha concreta, hora, título, dirección, producto, kg, teléfono y JID.
- Acción: usar `[ENTREGA:YYYY-MM-DD|HH:mm o --|título]` cuando haya entrega concreta.
- No confundir con recordatorios: `[AGENDAR:fecha|texto]` escribe en `mensajes_programados`.

### Mensajes programados

- Fuente: `mensajes_programados/{id}`.
- Campos obligatorios: `jid`, `texto`, `runAt`, `estado: pendiente`, `origen`.
- Usos: recordatorios, campañas, avisos al admin y mensajes escalonados.

### Cola de leña

- Fuente operativa del bot: GCS/RAM; espejo dashboard: `colaLena/{id}`.
- Usos: pedidos de leña confirmados listos para despacho.
- Acción: no editar la cola desde consultas pendientes; pasar por el flujo confirmado.
- Reparto: el bot puede disparar ruta por camión completo o por grupo de zona/corredor que alcance el umbral configurado, sin arrastrar pedidos de otros corredores que todavía no convienen.

### Consultas de leña por zona

- Fuente: `consultasLena/{id}`.
- Usos: interés manual pendiente por zona, acumulación de kg, aviso al admin y campañas cuando la zona está lista.
- Estados: `pendiente`, `zona_lista`, `admin_notificado`, `confirmado`, `enviado`.

### Configuración

- `config/general`: delays, bot activo, teléfonos admin, campañas, geocode, grupo agenda, umbrales de leña.
- `config/prompts`: instrucciones principales, admin, bienvenida y cierre de entrega.
- `config/promociones`: promociones/restricciones vigentes.
- `servicios/*`: catálogo, precios, envío, marcadores de imágenes y servicios activos.
- `vicky_skills/*`: capacidades internas versionadas para Vicky.

## Regla de sincronización

Todo cambio operativo importante debe quedar en Firebase para ejecución, en dashboard para gestión humana y en Git como snapshot auditable cuando modifique instrucciones, skills, precios, promociones o comportamiento estable.
