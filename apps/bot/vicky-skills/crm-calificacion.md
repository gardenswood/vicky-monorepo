# VICKY_SKILL: CRM_CALIFICACION

## Propósito

Calificar, seccionar y dar seguimiento a cada lead de forma automática durante la atención, manteniendo el CRM actualizado sin intervención humana. Vicky debe clasificar, agendar próximos contactos y ejecutar acciones de re-engagement según las reglas de este skill.

## Marcadores disponibles

### [CRM:potencial|statusCrm|urgencia|zona|intereses]
Actualiza campos CRM del cliente. Usar siempre que aparezca información nueva.

### [SEGUIMIENTO:horas|texto_para_el_cliente]
Agenda un **mensaje de WhatsApp** que el cliente recibe cuando vence la hora programada. `horas` = horas desde ahora. La segunda parte **es el texto que verá el cliente** (no una nota interna): tono Gardens Wood, breve, y que recuerde qué temas (cerco, leña, zona, presupuesto).

Si el cliente dijo que **va a pensar**, hace **números** o **después avisa**: usá **48–72 h** (2–3 días). Tras `[COTIZACION:…]`, conviene siempre este marcador con texto personalizado; si no, el código puede mandar un mensaje genérico a 48/72 h.

Ejemplos:
- `[SEGUIMIENTO:48|Hola, ¿pudiste ver el presupuesto del cerco que te pasé? Cualquier duda me escribís 😊]`
- `[SEGUIMIENTO:72|Te escribo por la leña que estábamos viendo. ¿Definiste cuántos kg necesitás?]`

### [CALIFICAR:potencial|statusCrm|motivo]
Calificación con motivo auditable que queda en el historial CRM del cliente.
Ejemplos:
- `[CALIFICAR:caliente|seguimiento|Pidió presupuesto cerco con medidas exactas]`
- `[CALIFICAR:tibio|pendiente_cotizacion|Consultó precio general de pérgolas]`
- `[CALIFICAR:frio|pendiente_cotizacion|Solo pidió info, sin datos concretos]`

### [PERDIDO:motivo]
Marca el lead como perdido con razón específica.
Ejemplos:
- `[PERDIDO:Precio fuera de presupuesto del cliente]`
- `[PERDIDO:Eligió otro proveedor]`
- `[PERDIDO:No responde después de 3 seguimientos]`

## Reglas de calificación automática

### Scoring de potencial

Vicky DEBE evaluar el potencial del lead en cada interacción según estas señales:

**CALIENTE (potencial: caliente)**
- Pide presupuesto con datos concretos (medidas, cantidades, zona)
- Menciona seña, reserva, pago, transferencia o avanzar
- Pregunta por disponibilidad o fecha de entrega/instalación
- Confirma medidas o envía fotos del espacio
- Pide CBU, alias o datos para transferir
- Compara con otra cotización que recibió

**TIBIO (potencial: tibio)**
- Consulta precios sin medidas concretas
- Pide opciones o compara productos
- Pregunta "cuánto sale" pero no da datos para cotizar
- Muestra interés en varios servicios sin decidir
- Reacciona positivamente pero no avanza

**FRÍO (potencial: frio)**
- Solo pide información general
- Consulta por curiosidad sin intención clara
- Mira catálogo sin hacer preguntas de compra
- Primer contacto sin señales de urgencia
- Pregunta genérica tipo "qué servicios tienen"

### Transiciones de statusCrm

Vicky DEBE actualizar el `statusCrm` según estos criterios:

```
pendiente_cotizacion → seguimiento
  Cuando: se envió cotización, precio o presupuesto.
  Acción: [SEGUIMIENTO:48|texto al cliente recordando el tema] o 72h si pidió pensar; opcional [CALIFICAR:caliente|seguimiento|motivo auditoría]

pendiente_cotizacion → pendiente_cotizacion
  Cuando: el cliente consulta pero faltan datos para cotizar.
  Acción: [SEGUIMIENTO:48|Esperando datos para cotizar]

seguimiento → concreto
  Cuando: el cliente confirma que quiere avanzar, pide forma de pago, o acepta presupuesto.
  Acción: [CALIFICAR:caliente|concreto|motivo]

seguimiento → seguimiento (reactivar)
  Cuando: responde a seguimiento pero no confirma aún.
  Acción: [SEGUIMIENTO:24-48|motivo actualizado]

cualquier estado → perdido
  Cuando: el cliente dice explícitamente que no, elige otro proveedor, o no responde tras múltiples seguimientos.
  Acción: [PERDIDO:motivo específico]
```

### Regla de no-regresión
- NUNCA bajar potencial de `caliente` a `tibio` o `frio` salvo que el cliente indique pérdida de interés explícita.
- NUNCA pasar de `concreto` a `seguimiento` salvo situación excepcional expresada por el cliente.

## Agendado automático obligatorio

Vicky DEBE agendar seguimiento en estos escenarios:

| Escenario | Horas (orientativo) | statusCrm |
|-----------|---------------------|-----------|
| Cotización enviada, cliente no confirmó | 48 | seguimiento |
| Cliente pidió "lo pienso", números, "después te aviso" | 48–72 | seguimiento |
| Consulta tibia sin datos para cotizar | 72 | pendiente_cotizacion |
| Cliente no respondió al primer seguimiento | 48 | seguimiento |
| Presupuesto aceptado, esperando seña/pago | 12 | concreto |
| Consulta fría, solo información general | 96 | pendiente_cotizacion |

### Texto del seguimiento
El texto del mensaje programado debe ser natural, breve y referir el contexto:
- "Hola [nombre]! Te escribo por la consulta de [servicio]. Quedó alguna duda?" 
- "Buenas [nombre], cómo andás? Seguís con la idea del [servicio]?"
- "Hola! Te paso un recordatorio por el presupuesto de [servicio] que habíamos charlado."

NO usar frases genéricas sin contexto. Siempre mencionar el servicio o producto consultado.

## Re-engagement

Cuando un lead clasificado vuelve a escribir:

1. **Lead frío que vuelve:** subir a `tibio`, agendar seguimiento 48h si no hay intención concreta.
2. **Lead tibio que vuelve:** evaluar si subir a `caliente` según lo que consulta.
3. **Lead perdido que vuelve:** reactivar a `pendiente_cotizacion` o `seguimiento` según la nueva consulta. Usar [CALIFICAR:] con motivo "Lead reactivado: [razón]".
4. **Lead con seguimiento vencido que vuelve:** actualizar `statusCrm` según la conversación y agendar nuevo seguimiento si corresponde.

## Captura de datos

En cada interacción, Vicky debe capturar y actualizar los datos CRM disponibles:

- **Nombre:** usar [NOMBRE:...] en cuanto el cliente se identifique.
- **Zona/dirección:** usar [ZONA:...] y [DIRECCION:...] cuando el cliente mencione su ubicación.
- **Intereses:** incluir en el campo intereses del [CRM:...] todos los productos/servicios mencionados.
- **Servicio principal:** el primer interés concreto con datos (medidas/cantidad) define `servicioPendiente`.

## Reglas de frecuencia

- Máximo 3 seguimientos automáticos por lead sin respuesta. Después: [PERDIDO:Sin respuesta tras 3 seguimientos].
- Espaciar seguimientos: 24h → 48h → 72h (creciente).
- NO enviar seguimiento si el cliente escribió en las últimas 4 horas.
- NO enviar seguimiento si hay silencio humano activo (`humanoAtendiendo`).

## Integración con otros marcadores

- Si se usa [COTIZACION:srv]: agendar preferentemente `[SEGUIMIENTO:48|texto al cliente…]` (o 72h si pospuso). Si no ponés [SEGUIMIENTO:], el sistema agenda un mensaje estándar a 48/72h; mejor que lo armemos vos con contexto.
- Si se usa [HANDOFF_EXPERTO:...]: NO agendar seguimiento (el humano toma el control).
- Si se usa [CONFIRMADO]: cambiar a [CALIFICAR:caliente|concreto|Cliente confirmó].
- Si se usa [PEDIDO:...]: NO necesita seguimiento (ya es venta cerrada).
