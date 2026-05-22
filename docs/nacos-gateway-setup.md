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
NACOS_SERVER_ADDR=127.0.0.1:8848
NACOS_NAMESPACE=
NACOS_GROUP=DEFAULT_GROUP
NACOS_DISCOVERY_IP=
NACOS_DISCOVERY_PORT=8081
NACOS_EPHEMERAL=true
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DATABASE=0
MAIL_CODE_REDIS_ENABLED=true
MAIL_CODE_REDIS_KEY_PREFIX=shop:mail-code
MAIL_CODE_PEPPER=use-the-same-secret-on-every-backend-instance
```

`MAIL_CODE_PEPPER` must be stable across all backend instances. If it is empty,
the backend falls back to `JWT_SECRET`; if both are empty, a single local process
still works, but verification may fail across multiple registered instances.

Gateway:

```text
SPRING_APPLICATION_NAME=shop-gateway
GATEWAY_PORT=8080
NACOS_DISCOVERY_ENABLED=true
NACOS_SERVER_ADDR=127.0.0.1:8848
NACOS_NAMESPACE=
NACOS_GROUP=DEFAULT_GROUP
GATEWAY_CORS_ALLOWED_ORIGIN_PATTERNS=http://localhost:*,http://127.0.0.1:*
```

Frontend:

```text
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_API_GATEWAY_ENABLED=true
REACT_APP_API_GATEWAY_PREFIX=/gateway
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
GET /admin/registry
```

This returns the configured Nacos server address, discovery/register flags,
known services, and the current `shop-backend` instances discovered through
Spring Cloud `DiscoveryClient`.

The Admin UI page `管理后台 -> 服务注册` also checks whether the frontend is
configured to call Gateway (`REACT_APP_API_BASE_URL=http://localhost:8080` and
`REACT_APP_API_GATEWAY_ENABLED=true`). If this check is orange, the frontend may
still be calling the backend directly and bypassing Nacos/Gateway.

## Production Nginx

Point the frontend edge proxy at Gateway, not the backend:

```text
BACKEND_ORIGIN=http://10.0.0.20:8080
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
