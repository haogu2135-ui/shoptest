# Static Frontend + Nginx Deployment

This deployment keeps the 2-core / 1 GB server focused on Nginx and the Spring Boot API. The React storefront is built into static files and does not run as a Node process in production.

## Should Nginx Be On Another Server?

Usually no for the first production version. Nginx serving a React build is very light; the real pressure on a 2-core / 1 GB server comes from the Java API, MySQL, image uploads, and uncached dynamic requests.

Use this order:

1. First choice: one low-cost server runs Nginx static files plus Spring Boot API. Do not run `npm start` in production.
2. Better split: frontend server runs only Nginx static files; backend server runs Spring Boot and MySQL/API. Customers still see one domain because Nginx proxies `/api`, `/ws`, and `/uploads`.
3. Best scale path: move static files and images to CDN/object storage, keep the backend API private behind Nginx or a load balancer.

If the current machine is 2-core / 1 GB, the most useful immediate change is removing the Node frontend process. Moving Nginx itself to another machine only matters after static traffic or image traffic becomes large.

## Build Frontend

Build on your local machine or in GitHub Actions:

```bash
cd frontend
npm ci
npm run build
```

Production builds use `/api` by default, so the browser calls the same domain and Nginx forwards API traffic to Spring Boot. Support chat WebSocket traffic uses `/ws/support` by default, matching the Nginx `/ws/` proxy block.

The build also includes `frontend/public/runtime-config.js` as `runtime-config.js`. Edit this file on the deployed server when the storefront needs to switch API routing without rebuilding:

```js
window.__SHOP_RUNTIME_CONFIG__ = {
  apiBaseUrl: "/api",
  supportWebSocketUrl: "/ws/support",
  apiGatewayEnabled: true,
  apiGatewayPrefix: "/gateway",
};
```

Use `apiBaseUrl` for HTTP API calls and `supportWebSocketUrl` for customer-service chat. The Nginx templates intentionally serve `runtime-config.js` with `no-store` headers so backend address changes are picked up on the next page load.

On Windows you can also build and prepare the static artifact:

```powershell
.\scripts\BuildStaticFrontend.ps1
```

This creates `artifacts/frontend-build`.

To build and upload directly to a server with rsync, create a private config file first:

```powershell
Copy-Item deploy\frontend-upload.env.example deploy\frontend-upload.local.env
notepad deploy\frontend-upload.local.env
```

Then run:

```powershell
.\scripts\DeployStaticFrontend.ps1
```

For Linux or CI runners:

```bash
bash scripts/deploy-static-frontend.sh
```

`deploy/frontend-upload.local.env` is ignored by git. Both scripts run `npm ci`, `npm run build`, then upload `frontend/build/` to `DEPLOY_USER@DEPLOY_HOST:DEPLOY_TARGET`. Password upload uses `sshpass`, so the local machine or CI runner must have `rsync` and `sshpass` installed.

## GitHub Actions Auto Deploy

The workflow `.github/workflows/deploy-frontend.yml` runs on every push to `main` and can also be started manually from the GitHub Actions page.

Configure these repository secrets in GitHub:

- `FRONTEND_DEPLOY_HOST`: server public IP or domain
- `FRONTEND_DEPLOY_USER`: usually `root`
- `FRONTEND_DEPLOY_PASSWORD`: SSH password

Optional secrets:

- `FRONTEND_DEPLOY_PORT`: default `22`
- `FRONTEND_DEPLOY_TARGET`: default `/var/www/shoptest/`

If required secrets are missing, the workflow skips deployment with a warning instead of failing. After secrets are configured, pushing to `main` automatically builds `frontend` and uploads `frontend/build/` to the server.

## Upload Static Files

Copy the contents of `frontend/build` to the server:

```bash
sudo mkdir -p /var/www/shoptest
sudo rsync -av --delete frontend/build/ /var/www/shoptest/
```

Do not run `npm start` or `serve -s build` on the 1 GB server.

## Install Nginx Config

Copy `deploy/nginx/shoptest-static.conf` to Nginx:

```bash
sudo cp deploy/nginx/shoptest-static.conf /etc/nginx/sites-available/shoptest
sudo ln -sf /etc/nginx/sites-available/shoptest /etc/nginx/sites-enabled/shoptest
sudo nginx -t
sudo systemctl reload nginx
curl -I http://127.0.0.1/healthz
```

Replace `server_name _;` with your real domain when DNS is ready.

The template exposes `GET/HEAD /healthz` as a lightweight Nginx-level health check and returns `204 No Content`. Use this for load balancers or uptime checks when you only need to confirm the public storefront edge is alive. Use `/api/actuator/health` when the check must include the Spring Boot backend.

## Run Backend With Low Memory

Run Spring Boot on localhost port `8081`:

```bash
export SERVER_ADDRESS=127.0.0.1
export JWT_SECRET='replace-with-at-least-32-random-characters'
export PAYMENT_SIMULATION_ENABLED='false'
export PAYMENT_SIMULATION_ALLOW_PRODUCTION='false'
export CONFIG_CENTER_APPLY_NACOS_ON_STARTUP='false'
export DB_URL='jdbc:mysql://158.101.11.223:3306/shop?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true'
export DB_USERNAME='shop'
export DB_PASSWORD='shop_password'
export REDIS_HOST='158.101.11.223'
export REDIS_PORT='6379'
export REDIS_PASSWORD='shop_redis_password'
export NACOS_DISCOVERY_ENABLED='true'
export NACOS_REGISTER_ENABLED='true'
export NACOS_SERVER_ADDR='158.101.11.223:8848'

java -Xms128m -Xmx512m -jar shop.jar
```

Use a systemd service for production so the backend restarts automatically.

## Request Routing

Nginx serves:

- `/` from `/var/www/shoptest/index.html`
- `/healthz` as an Nginx-level `204 No Content` health check
- `/static/**` from hashed React assets with long cache
- `/api/**` to Spring Cloud Gateway, for example `http://158.101.11.223:8080/**`
- `/ws/**` to Spring Cloud Gateway WebSocket routes
- `/uploads/**` to Spring Cloud Gateway uploaded media routes

The customer sees one storefront domain, while the server avoids running a Node frontend process.

## Split Frontend And Backend Machines

Use this when the 2-core / 1 GB machine should only serve the storefront and proxy traffic to a stronger backend machine.

Architecture:

- Frontend machine: Nginx only, serving `artifacts/frontend-build`
- Backend machine: Spring Boot on `:8081`, plus database or a private database connection
- Browser URL: still one storefront domain, for example `https://pet.686888666.xyz`
- Internal proxy: `/api/**`, `/ws/**`, and `/uploads/**` go from Nginx to Spring Cloud Gateway

### Frontend Machine

Copy the repository deployment folder and the built artifact to the frontend server:

```bash
rsync -av deploy/ user@frontend-server:/opt/shoptest/deploy/
rsync -av --delete artifacts/frontend-build/ user@frontend-server:/opt/shoptest/artifacts/frontend-build/
```

Create `/opt/shoptest/deploy/.env`:

```bash
SERVER_NAME=pet.686888666.xyz
BACKEND_ORIGIN=http://158.101.11.223:8080
CLIENT_MAX_BODY_SIZE=6m
```

Start Nginx as the static frontend container:

```bash
cd /opt/shoptest/deploy
docker compose -f docker-compose.frontend-edge.yml up -d
```

The template `deploy/nginx/shoptest-edge.conf.template` is rendered by the official Nginx container at startup. Keep `BACKEND_ORIGIN` pointed at Spring Cloud Gateway when `runtime-config.js` has `apiGatewayEnabled: true`.

### Backend Machine

Run Spring Boot on the backend machine and allow access only from the frontend server security group/firewall.

Copy `deploy/backend.env.example` to `/etc/shoptest/backend.env`, then edit secrets, database credentials, and domain:

```bash
sudo mkdir -p /etc/shoptest
sudo cp deploy/backend.env.example /etc/shoptest/backend.env
sudo chmod 600 /etc/shoptest/backend.env
```

Install the low-memory service:

```bash
sudo mkdir -p /opt/shoptest
sudo cp target/shop-0.0.1-SNAPSHOT.jar /opt/shoptest/shop.jar
sudo cp deploy/shoptest-backend.service /etc/systemd/system/shoptest-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now shoptest-backend
```

For this split mode, `SERVER_ADDRESS=0.0.0.0` is acceptable only if the firewall restricts port `8081` to the frontend server. If backend and Nginx are on the same machine, use `SERVER_ADDRESS=127.0.0.1`.

Or run the backend as a container:

```bash
./mvnw clean package -DskipTests
cp deploy/backend.env.example deploy/backend.env
cp deploy/backend-compose.env.example deploy/.env
cd deploy
docker compose -f docker-compose.backend.yml up -d --build
```

`deploy/.env` controls compose-level values such as `BACKEND_BIND_IP` and `BACKEND_HOST_PORT`; `deploy/backend.env` controls Spring Boot values such as database credentials, JWT secret, and CORS origins. Keep `SERVER_PORT=8081` for the container unless you also change the container port mapping.

## Resource Notes For 2-Core / 1 GB

- Keep frontend as static files. Never run `npm start`, `react-scripts start`, or `serve -s build` in production.
- Cap Java memory with `-Xmx512m` or lower if MySQL is on the same machine.
- Prefer CDN/object storage for `/uploads` once pet gallery or product media grows.
- Keep database on a separate managed service if budget allows; MySQL plus Java on 1 GB is the tightest part.
- Put only Nginx on the public internet; keep Spring Boot and MySQL private.
