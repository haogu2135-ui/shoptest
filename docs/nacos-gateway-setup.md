# Nacos + Spring Cloud Gateway Setup

This project now supports a gradual service-discovery architecture:

```text
React frontend
  -> shop-gateway:8080
  -> Nacos service discovery
  -> shop-backend:8081
  -> Redis shared email-code state
```

The backend is still a monolith for now, registered in Nacos as `shop-backend`.
The frontend calls one unified gateway entrypoint, and Gateway forwards to the
current backend service. Redis stores email verification codes, resend cooldowns,
and mail-login rate limits so multiple `shop-backend` instances can verify codes
consistently after Nacos load balancing.

## Route Map

```text
/gateway/app/**          -> lb://shop-backend
/gateway/identity/**     -> lb://shop-backend
/gateway/catalog/**      -> lb://shop-backend
/gateway/customer/**     -> lb://shop-backend
/gateway/commerce/**     -> lb://shop-backend
/gateway/order/**        -> lb://shop-backend
/gateway/payment/**      -> lb://shop-backend
/gateway/support/**      -> lb://shop-backend
/gateway/notification/** -> lb://shop-backend
/gateway/logistics/**    -> lb://shop-backend
/gateway/admin/**        -> lb://shop-backend
/ws/support              -> lb:ws://shop-backend
/uploads/**              -> lb://shop-backend
```

The frontend keeps calling normal business paths in code, such as `/products`
or `/orders`. `frontend/src/utils/apiDispatcher.ts` rewrites those calls to
gateway paths, for example:

```text
/products       -> /gateway/catalog/products
/orders         -> /gateway/order/orders
/payments       -> /gateway/payment/payments
/auth/login     -> /gateway/identity/auth/login
/admin/orders   -> /gateway/admin/admin/orders
```

## Local Run: Manual Processes

Start Nacos:

```powershell
docker compose -f deploy/docker-compose.nacos-gateway.yml up -d nacos
```

Start the backend and register it into Nacos:

```powershell
.\mvnw.cmd spring-boot:run
```

Start Gateway:

```powershell
cd shop-gateway
..\mvnw.cmd spring-boot:run
```

Start the frontend:

```powershell
cd frontend
npm start
```

Default addresses:

```text
Nacos:    http://localhost:8848/nacos
Gateway:  http://localhost:8080
Backend:  http://localhost:8081
Frontend: http://localhost:3000
```

## Local Run: Docker Compose

Build the backend and gateway jars first:

```powershell
.\mvnw.cmd -DskipTests package
.\mvnw.cmd -f shop-gateway\pom.xml -DskipTests package
```

Create private env files:

```powershell
Copy-Item deploy\backend.env.example deploy\backend.env
Copy-Item deploy\gateway.env.example deploy\gateway.env
Copy-Item frontend\.env.gateway.example frontend\.env.local
```

Edit `deploy/backend.env` and fill database/JWT/payment secrets. Then run:

```powershell
docker compose -f deploy/docker-compose.nacos-gateway.yml up -d --build
```

This starts:

```text
shop-nacos
shop-redis
shop-backend
shop-gateway
```

## Key Environment Variables

Backend:

```text
SPRING_APPLICATION_NAME=shop-backend
SERVER_PORT=8081
NACOS_DISCOVERY_ENABLED=true
NACOS_REGISTER_ENABLED=true
NACOS_SERVER_ADDR=nacos.internal.example:8848
NACOS_NAMESPACE=
NACOS_GROUP=DEFAULT_GROUP
NACOS_DISCOVERY_IP=
NACOS_DISCOVERY_PORT=8081
NACOS_EPHEMERAL=true
PAYMENT_SIMULATION_ENABLED=false
PAYMENT_SIMULATION_ALLOW_PRODUCTION=false
CONFIG_CENTER_APPLY_NACOS_ON_STARTUP=false
REDIS_HOST=redis.internal.example
REDIS_PORT=6379
REDIS_PASSWORD=replace-with-production-redis-password
REDIS_DATABASE=0
MAIL_CODE_REDIS_ENABLED=true
MAIL_CODE_REDIS_KEY_PREFIX=shop:mail-code
MAIL_CODE_PEPPER=use-the-same-secret-on-every-backend-instance
MAIL_BRAND_NAME=ShopMX
APP_MAIL_ACCOUNTS_0_HOST=smtp.example.com
APP_MAIL_ACCOUNTS_0_PORT=465
APP_MAIL_ACCOUNTS_0_USERNAME=no-reply@example.com
APP_MAIL_ACCOUNTS_0_PASSWORD=use-mail-app-password
APP_MAIL_ACCOUNTS_0_FROM=no-reply@example.com
APP_MAIL_ACCOUNTS_0_SSL=true
APP_MAIL_ACCOUNTS_0_STARTTLS=false
```

`MAIL_CODE_PEPPER` must be stable across all backend instances. If it is empty,
the backend falls back to `JWT_SECRET`; if both are empty, a single local process
still works, but verification may fail across multiple registered instances.
The same SMTP account pool is also used for order status emails, and production
readiness blocks startup validation when no complete SMTP account is configured.

Gateway:

```text
SPRING_APPLICATION_NAME=shop-gateway
GATEWAY_PORT=8080
NACOS_DISCOVERY_ENABLED=true
NACOS_REGISTER_ENABLED=true
NACOS_SERVER_ADDR=nacos.internal.example:8848
NACOS_NAMESPACE=
NACOS_GROUP=DEFAULT_GROUP
GATEWAY_BACKEND_SERVICE_ID=shop-backend
GATEWAY_CORS_ALLOWED_ORIGIN_PATTERNS=http://localhost:*,http://127.0.0.1:*
```

Frontend:

```text
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_API_GATEWAY_ENABLED=true
REACT_APP_API_GATEWAY_PREFIX=/gateway
```

To point the local frontend at the remote Nacos/Gateway environment:

```text
REACT_APP_API_BASE_URL=http://gateway.internal.example:8080
REACT_APP_API_GATEWAY_ENABLED=true
REACT_APP_API_GATEWAY_PREFIX=/gateway
```

The remote Nacos server is available at:

```text
Nacos:   http://nacos.internal.example:8848/nacos
Gateway: http://gateway.internal.example:8080
```

Useful remote checks:

```powershell
Invoke-RestMethod 'http://nacos.internal.example:8848/nacos/v1/ns/service/list?pageNo=1&pageSize=100'
Invoke-RestMethod 'http://nacos.internal.example:8848/nacos/v1/ns/instance/list?serviceName=shop-gateway&groupName=DEFAULT_GROUP'
Invoke-RestMethod 'http://nacos.internal.example:8848/nacos/v1/ns/instance/list?serviceName=shop-backend&groupName=DEFAULT_GROUP'
Invoke-RestMethod 'http://gateway.internal.example:8080/actuator/health'
Invoke-WebRequest 'http://gateway.internal.example:8080/gateway/status/readiness'
Invoke-RestMethod 'http://gateway.internal.example:8080/gateway/catalog/products?discount=true'
```

To run a local Gateway against the remote Nacos registry, keep the frontend on
local Gateway:

```text
REACT_APP_API_BASE_URL=http://127.0.0.1:8080
REACT_APP_API_GATEWAY_ENABLED=true
REACT_APP_API_GATEWAY_PREFIX=/gateway
```

Start Gateway with remote discovery and without registering the local Gateway
instance back into the shared Nacos registry:

```powershell
cd shop-gateway
$env:NACOS_SERVER_ADDR="nacos.internal.example:8848"
$env:NACOS_REGISTER_ENABLED="false"
..\mvnw.cmd spring-boot:run
```

If the frontend shows a catalog load failure while command-line requests work,
check the browser CORS response headers. Gateway is configured with
`DedupeResponseHeader` so that `Access-Control-Allow-Origin` and
`Access-Control-Allow-Credentials` remain single-valued when both Gateway and
the backend add CORS headers. Gateway and backend also expose `X-Request-Id` so
the browser can show the same request id that appears in Gateway/backend logs.
After redeploying Gateway, verify the GET response does not contain comma-joined
duplicate CORS values.

For request tracing, send an optional `X-Request-Id` header from a client or let
Gateway generate one. Gateway forwards the same safe id to the backend and both
services include it in the response header and log pattern:

```powershell
$response = Invoke-WebRequest 'http://localhost:8080/gateway/catalog/products' -Headers @{ 'X-Request-Id' = 'debug-001' }
$response.Headers['X-Request-Id']
```

Backend API errors use a consistent JSON shape. The legacy-compatible `error`
field is still present, and the same `requestId` is included for log lookup:

```json
{
  "error": "Order not found",
  "message": "Order not found",
  "status": 404,
  "statusText": "Not Found",
  "path": "/payments/order/9",
  "requestId": "debug-001",
  "timestamp": "2026-05-23T19:50:00Z"
}
```

To temporarily bypass Gateway and call the backend directly:

```text
REACT_APP_API_BASE_URL=http://localhost:8081
REACT_APP_API_GATEWAY_ENABLED=false
NACOS_DISCOVERY_ENABLED=false
NACOS_REGISTER_ENABLED=false
```

## Verify Backend Registration

Backend health endpoints are exposed for deployment checks:

```text
GET http://localhost:8081/actuator/health
GET http://localhost:8081/actuator/info
```

After logging in as an admin, the management console also has:

```text
GET /admin/system/status
GET /admin/system/readiness
GET /admin/registry
GET /admin/registry/readiness
```

`/admin/system/status` returns runtime, memory, disk, masked datasource, Nacos
configuration, and live database/Redis checks. `/admin/system/readiness` returns
the same payload but uses HTTP status for automation: `200` when required
dependencies are ready, `503` when the database check fails or Redis is required
but unavailable.

`/admin/registry` returns the configured Nacos server address,
discovery/register flags, known services, and the current `shop-backend`
instances discovered through Spring Cloud `DiscoveryClient`.

`/admin/registry/readiness` returns the same diagnostic payload but uses HTTP
status for automation: `200` when the backend is registered and visible through
discovery, `503` when Nacos discovery is disabled, registration is disabled, the
current backend instance is not visible, or discovery checks fail.

The backend deployment activation script also checks Nacos after restarting
`shoptest-backend`. When registration is enabled, deployment fails and rolls back
if `/nacos/v1/ns/instance/list` does not return a `shop-backend` instance on the
configured port.

The Admin UI page `管理后台 -> 服务注册` also checks whether the frontend is
configured to call Gateway (`REACT_APP_API_BASE_URL=http://gateway.internal.example:8080` and
`REACT_APP_API_GATEWAY_ENABLED=true`). If this check is orange, the frontend may
still be calling the backend directly and bypassing Nacos/Gateway.

## Verify Gateway Dispatch

Gateway exposes a lightweight diagnostics endpoint:

```text
GET http://localhost:8080/gateway/status
```

Use it to confirm:

```text
status
nacos.discoveryEnabled
routeCount
missingRequiredRouteIds
routes
backendService.serviceId
backendService.visible
backendService.instanceCount
diagnostics.backendRegistryViaGateway
```

When Nacos discovery is disabled locally, `status` is `DEGRADED` on purpose
because `lb://` routes cannot resolve registered services. After Nacos is
running and `NACOS_DISCOVERY_ENABLED=true`, the status should become `UP` as
long as all required routes are loaded.

Useful end-to-end checks:

```text
GET http://localhost:8080/gateway/status
GET http://localhost:8080/gateway/status/readiness
GET http://localhost:8080/actuator/health
GET http://localhost:8080/actuator/gateway/routes
GET http://localhost:8080/gateway/admin/admin/system/status
GET http://localhost:8080/gateway/admin/admin/system/readiness
GET http://localhost:8080/gateway/admin/admin/registry
GET http://localhost:8080/gateway/admin/admin/registry/readiness
```

`/gateway/status/readiness` is intended for deployment checks. It returns `200`
only when Gateway routes are loaded, Nacos discovery is enabled, and the
configured backend service is visible in Nacos. Otherwise it returns `503` with
the same JSON diagnostics as `/gateway/status`.

## Production Nginx

Point the frontend edge proxy at Gateway, not the backend:

```text
BACKEND_ORIGIN=http://gateway.internal.example:8080
```

The existing Nginx template uses `BACKEND_ORIGIN` for `/api`, `/ws`, and
`/uploads`. With Gateway enabled, frontend production calls look like:

```text
/api/gateway/catalog/products
```

Nginx strips `/api` and Gateway receives:

```text
/gateway/catalog/products
```

## Splitting Services Later

When you split a domain out of the monolith:

1. Create a new Spring Boot service, for example `shop-catalog`.
2. Add `spring-cloud-starter-alibaba-nacos-discovery`.
3. Set `spring.application.name=shop-catalog`.
4. Move the related controllers while keeping paths like `/products`.
5. Change Gateway route `uri` from `lb://shop-backend` to `lb://shop-catalog`.
6. Leave frontend business calls unchanged.

Example:

```yaml
- id: shop-catalog
  uri: lb://shop-catalog
  predicates:
    - Path=/gateway/catalog/**
  filters:
    - StripPrefix=2
```
