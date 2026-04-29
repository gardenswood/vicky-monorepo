# Docker VPS

Base inicial para desplegar Vicky en un VPS.

## Servicios

- `bot`: Bot WhatsApp Vicky.
- `dashboard`: Panel admin Next.js.

## Pendiente antes de usar en Hostinger

1. Confirmar dominios/subdominios.
2. Definir si Nginx corre en el host o como contenedor.
3. Crear archivos `.env` reales en el VPS, sin subirlos a Git.
4. Confirmar persistencia de sesion WhatsApp/Baileys y credenciales Google.
5. Probar build de cada app localmente.
6. Confirmar estrategia de backup Firestore/GCS antes del primer deploy.

## Comando esperado

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

No ejecutar en produccion sin revisar variables y dominios.