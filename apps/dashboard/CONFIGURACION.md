# Dashboard Vicky Bot - Guía de configuración y uso

## URLs de producción

| Servicio | URL |
|---------|-----|
| **Dashboard (panel admin)** | https://vicky-dashboard-uh3qtftq3q-uc.a.run.app |
| **Bot WhatsApp** | https://vicky-bot-uh3qtftq3q-uc.a.run.app |
| **Firestore Console** | https://console.firebase.google.com/project/webgardens-8655d/firestore |
| **Cloud Run Console** | https://console.cloud.google.com/run?project=webgardens-8655d |

## Credenciales del dashboard

- **Email:** admin@gardenswood.com
- **Password:** GardensWood2026!

> Cambiar la contraseña tras el primer login en Firebase Console → Authentication.

---

## Secciones del dashboard

| Página | Función |
|--------|---------|
| `/` | Analytics: KPIs, gráficos de mensajes, distribución por servicio, embudo de conversión |
| `/chats` | Todas las conversaciones con filtros por estado y servicio |
| `/chats/[jid]` | Vista tipo WhatsApp de una conversación, en tiempo real |
| `/clientes` | Base de datos de clientes con búsqueda, filtros y exportar CSV |
| `/clientes/[tel]` | Perfil completo del cliente, historial de pedidos, notas |
| `/cola-lena` | Gestión de la cola logística de leña (pedidos ≤200kg) |
| `/config/prompts` | Editor Monaco del SYSTEM_PROMPT que usa el bot |
| `/config/precios` | Editor visual de precios por servicio (6 servicios) |
| `/config/general` | Delays, modelo Gemini, horarios de atención, número admin |
| `/usuarios` | Gestión de usuarios del panel (admin/operador/viewer) |

---

## Cómo conectar el bot con el dashboard

El bot `vicky-bot` en Cloud Run ya tiene la variable `FIREBASE_PROJECT_ID=webgardens-8655d`. Al arrancar:
1. Lee el `SYSTEM_PROMPT` desde `Firestore > config/prompts`
2. Lee la config general desde `Firestore > config/general`
3. Loguea cada mensaje en `Firestore > chats/{jid}/mensajes/`
4. Sincroniza clientes a `Firestore > clientes/{tel}`

Los chats aparecen en el dashboard en **tiempo real** (Firestore `onSnapshot`).

---

## Actualizar el bot en producción

Cada vez que se modifiquen `bot.js` o `firestore-module.js`:

```powershell
cd "Bot_WhatsApp_Lena"
gcloud run deploy vicky-bot --source . --region=us-central1 --platform=managed
```

## Actualizar el dashboard en producción

```powershell
cd "dashboard"
gcloud builds submit --config=cloudbuild.yaml --project=webgardens-8655d
```

---

## Firestore — colecciones

| Colección | Descripción |
|-----------|-------------|
| `config/prompts` | System prompt del bot, prompt admin, mensaje de bienvenida |
| `config/general` | Delays, modelo AI, horarios, teléfono admin |
| `servicios/{id}` | Precios por servicio (lena, cerco, pergola, fogonero, bancos, madera) |
| `chats/{jid}` | Metadata de cada chat (nombre, estado, último mensaje) |
| `chats/{jid}/mensajes/` | Mensajes individuales (entrante/saliente) |
| `clientes/{tel}` | Datos de clientes (nombre, dirección, pedidos, estado) |
| `colaLena/{id}` | Cola logística de leña ≤200kg |
| `usuarios/{uid}` | Usuarios del dashboard con roles |
| `mensajes_log/` | Log de mensajes para analytics de volumen |

## Roles de usuarios del dashboard

| Rol | Permisos |
|-----|----------|
| `admin` | Todo: leer, escribir, gestionar usuarios |
| `operador` | Leer + editar config, responder chats, silenciar bot |
| `viewer` | Solo lectura |

---

## Crear nuevo usuario del panel

```powershell
cd "dashboard"
npm run crear-admin
```

## Re-poblar Firestore con datos del bot

```powershell
cd "dashboard"
npm run seed
```
