# wwebjs-microservice (DB-enabled)

Microservicio Express + **whatsapp-web.js** con **PostgreSQL** para:
- Enviar mensajes (`/api/v1/messages/text`, `/api/v1/messages/template`)
- **Recibir mensajes y reenviar a tus webhooks** (configurables en DB)
- Gestión de **plantillas**, **secret** de firma y **targets** por API
- Docker Compose listo (Chromium, Postgres), logs con pino

> ⚠️ `whatsapp-web.js` es NO oficial. Úsalo bajo tu responsabilidad.

## Arranque
1. Copia `.env.example` a `.env` (ajusta si deseas).
2. `docker compose up --build -d`
3. `GET http://localhost:8080/api/v1/qr` → escanea QR con el número origen.
4. `GET http://localhost:8080/api/v1/health` → espera `ready: true`.

## Endpoints principales
- `GET  /api/v1/health`
- `GET  /api/v1/qr`
- `POST /api/v1/reinit`
- `POST /api/v1/messages/text`
- `POST /api/v1/messages/template`
- `GET  /api/v1/config`
- `PUT  /api/v1/config` (templates, rateLimit, webhook config)
- `PATCH/DELETE /api/v1/config/templates/:id`
- `GET  /api/v1/webhooks`
- `PUT  /api/v1/webhooks` (reemplaza targets y opcionalmente config de firma)
- `PUT  /api/v1/webhooks/secret` (actualiza secret en DB)

### Formato del webhook saliente
Compatible con el de Cloud API (ejemplo en `src/wapp.js` función `toMetaLikePayload`).

### Firma HMAC (opcional)
- Guarda `WEBHOOK_SECRET` en DB vía `PUT /api/v1/webhooks/secret` o en `.env`.
- Header enviado: `X-WApp-Signature-256: sha256=<hex>`.

## Base de datos
Se crean en arranque:
- `service_config(key,value jsonb, updated_at)`
- `webhook_target(id,url,is_active,created_at)`
- `webhook_header(id,target_id,name,value,is_active)`
- `webhook_delivery_log(id,target_id,request_body,status_code,error,created_at)`

## Licencia
Apache-2.0 (ajústala a tu preferencia).
