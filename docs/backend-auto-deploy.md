# Backend auto deploy

The backend server is configured separately from the frontend server. CI builds the Spring Boot jar, uploads it to the backend machine, then restarts the systemd service. Runtime secrets such as database, JWT, payment, and SMTP values stay on the backend server in `/etc/shoptest/backend.env`.

## Backend server one-time setup

Install Java 11 on the backend server, then create the runtime env file. The deploy script can create the service user and systemd unit automatically, but it intentionally refuses to start if secrets still use placeholders.

```bash
sudo mkdir -p /opt/shoptest/uploads /etc/shoptest
sudo tee /etc/shoptest/backend.env >/dev/null <<'ENV'
SERVER_ADDRESS=0.0.0.0
SERVER_PORT=8081
SPRING_APPLICATION_NAME=shop-backend
APP_RUNTIME_MODE=production
JWT_SECRET=replace-with-at-least-32-random-characters
PAYMENT_CALLBACK_SECRET=replace-with-at-least-32-random-characters
DB_URL=jdbc:mysql://127.0.0.1:3306/shop?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
DB_USERNAME=shop
DB_PASSWORD=replace-me
CORS_ALLOWED_ORIGIN_PATTERNS=https://your-frontend-domain.example
WEBSOCKET_ALLOWED_ORIGIN_PATTERNS=https://your-frontend-domain.example
JPA_SHOW_SQL=false
HIBERNATE_SQL_LOG_LEVEL=WARN
HIBERNATE_BINDER_LOG_LEVEL=WARN
MYBATIS_MAPPER_LOG_LEVEL=WARN
NACOS_DISCOVERY_ENABLED=false
NACOS_REGISTER_ENABLED=false
NACOS_SERVER_ADDR=
NACOS_NAMESPACE=
NACOS_GROUP=DEFAULT_GROUP
NACOS_CLUSTER_NAME=DEFAULT
NACOS_SERVICE_NAME=shop-backend
NACOS_DISCOVERY_IP=
NACOS_DISCOVERY_PORT=8081
NACOS_IP=
NACOS_PORT=8081
NACOS_USERNAME=
NACOS_PASSWORD=
NACOS_METADATA_REGION=default
NACOS_METADATA_ZONE=default
ENV
sudo nano /etc/shoptest/backend.env
sudo chmod 0640 /etc/shoptest/backend.env
```

The first successful deploy uploads `/opt/shoptest/shop.jar`, writes `/etc/systemd/system/shoptest-backend.service`, enables `shoptest-backend`, restarts it, and runs the optional health check. If the new jar health check fails and a previous jar exists, the remote activation script rolls back to `/opt/shoptest/shop.jar.previous`, restarts the service, verifies the rollback with the same health check, and still exits with a failed deploy status so CI reports that the new release was not applied.

If the deploy user is not `root`, configure passwordless sudo for `mkdir`, `mv`, `cp`, `chmod`, `chown`, `install`, `tee`, `systemctl`, `useradd`, and `groupadd`, or use `root` as `BACKEND_DEPLOY_USER`.

## GitHub Secrets

Required:

```text
BACKEND_DEPLOY_HOST=backend server public IP
BACKEND_DEPLOY_USER=root
BACKEND_DEPLOY_PASSWORD=backend server SSH password
```

Optional:

```text
BACKEND_DEPLOY_PORT=22
BACKEND_DEPLOY_TARGET_DIR=/opt/shoptest
BACKEND_DEPLOY_SERVICE=shoptest-backend
BACKEND_REMOTE_TEMP_DIR=/tmp/shoptest-backend-deploy
BACKEND_JAR_NAME=shop.jar
BACKEND_DEPLOY_OWNER=shoptest:shoptest
BACKEND_HEALTHCHECK_URL=http://127.0.0.1:8081/app/config
BACKEND_RUNTIME_ENV_FILE=/etc/shoptest/backend.env
BACKEND_SERVICE_USER=shoptest
BACKEND_SERVICE_GROUP=shoptest
BACKEND_JAVA_BIN=/usr/bin/java
BACKEND_JAVA_OPTS=-Xms128m -Xmx512m -XX:MaxMetaspaceSize=192m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8
BACKEND_REGISTER_SERVICE=true
BACKEND_ENABLE_SERVICE=true
BACKEND_HEALTHCHECK_RETRIES=10
BACKEND_HEALTHCHECK_INTERVAL_SECONDS=3
```

The workflow `.github/workflows/deploy-backend.yml` runs on every push to `main`, and it can also be started manually from GitHub Actions.

## Nacos service discovery

Nacos runtime values belong in the backend server file `/etc/shoptest/backend.env`, not in GitHub Secrets. GitHub Actions only needs SSH deployment credentials; the application reads Nacos configuration after systemd starts it on the backend server.

For a single backend machine, keep Nacos disabled:

```text
NACOS_DISCOVERY_ENABLED=false
NACOS_REGISTER_ENABLED=false
```

When a gateway, frontend edge service, or another backend service should discover this API through Nacos, update `/etc/shoptest/backend.env` on the backend server:

```text
SPRING_APPLICATION_NAME=shop-backend
NACOS_DISCOVERY_ENABLED=true
NACOS_REGISTER_ENABLED=true
NACOS_SERVER_ADDR=10.0.0.8:8848
NACOS_NAMESPACE=prod
NACOS_GROUP=DEFAULT_GROUP
NACOS_CLUSTER_NAME=DEFAULT
NACOS_SERVICE_NAME=shop-backend
NACOS_DISCOVERY_IP=10.0.0.20
NACOS_DISCOVERY_PORT=8081
NACOS_USERNAME=nacos-user
NACOS_PASSWORD=nacos-password
NACOS_METADATA_REGION=mx
NACOS_METADATA_ZONE=primary
```

Use the backend server private IP for `NACOS_DISCOVERY_IP` when consumers are in the same VPC. Use the public IP only when consumers cannot route to the private network. `NACOS_IP` and `NACOS_PORT` are still accepted as aliases for older env files. If `NACOS_DISCOVERY_ENABLED=true` or `NACOS_REGISTER_ENABLED=true`, the deploy activation script validates that `NACOS_SERVER_ADDR`, `NACOS_SERVICE_NAME`, and numeric `NACOS_DISCOVERY_PORT` / `NACOS_PORT` are configured before it replaces the running jar.

After changing `/etc/shoptest/backend.env`, restart and verify:

```bash
sudo systemctl restart shoptest-backend
journalctl -u shoptest-backend -n 100 --no-pager | grep -Ei 'nacos|register|shop-backend'
curl -fsS http://127.0.0.1:8081/app/config
```

In the Nacos console, check `Service Management -> Services` with namespace `prod`, group `DEFAULT_GROUP`, service `shop-backend`, and verify that the registered IP and port match the value your consumers can reach.

## Service registration behavior

All deploy entry points upload `scripts/backend-remote-activate.sh` to the backend server and run it after the jar upload. That script is the single source of truth for service registration:

- creates the `shoptest` service user and group when the deploy user is `root`
- writes a hardened systemd unit with `EnvironmentFile=/etc/shoptest/backend.env`
- validates required runtime keys before replacing the active jar
- moves the uploaded jar into `/opt/shoptest/shop.jar`
- enables and restarts the `shoptest-backend` service
- runs the configured health check and rolls back to the previous jar on failure
- verifies rollback health before leaving the previous jar in service

Useful server-side checks:

```bash
systemctl status shoptest-backend --no-pager
journalctl -u shoptest-backend -n 100 --no-pager
systemctl cat shoptest-backend
curl -fsS http://127.0.0.1:8081/app/config
```

## Local deploy

Windows PowerShell:

```powershell
Copy-Item deploy\backend-upload.env.example deploy\backend-upload.local.env
notepad deploy\backend-upload.local.env
powershell -ExecutionPolicy Bypass -File scripts\DeployBackend.ps1
```

Bash:

```bash
cp deploy/backend-upload.env.example deploy/backend-upload.local.env
nano deploy/backend-upload.local.env
bash scripts/deploy-backend.sh
```

The `.local.env` file is ignored by git.
