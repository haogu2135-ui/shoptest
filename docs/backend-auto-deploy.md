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
ADMIN_BOOTSTRAP_TOKEN=
PAYMENT_SIMULATION_ENABLED=false
PAYMENT_SIMULATION_ALLOW_PRODUCTION=false
PAYMENT_CHECKOUT_BASE_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CHECKOUT_SUCCESS_URL=
STRIPE_CHECKOUT_CANCEL_URL=
CONFIG_CENTER_APPLY_NACOS_ON_STARTUP=false
DB_URL=jdbc:mysql://db.internal.example:3306/shop?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&sslMode=VERIFY_IDENTITY&serverTimezone=UTC
DB_USERNAME=shop
DB_PASSWORD=replace-with-production-db-password
REDIS_HOST=redis.internal.example
REDIS_PORT=6379
REDIS_PASSWORD=replace-with-production-redis-password
REDIS_DATABASE=0
MAIL_CODE_REDIS_ENABLED=true
MAIL_CODE_REDIS_KEY_PREFIX=shop:mail-code
MAIL_CODE_PEPPER=replace-with-same-value-on-every-backend-instance
MAIL_BRAND_NAME=ShopMX
APP_MAIL_ACCOUNTS_0_HOST=smtp.example.com
APP_MAIL_ACCOUNTS_0_PORT=465
APP_MAIL_ACCOUNTS_0_USERNAME=no-reply@example.com
APP_MAIL_ACCOUNTS_0_PASSWORD=replace-with-mail-app-password
APP_MAIL_ACCOUNTS_0_FROM=no-reply@example.com
APP_MAIL_ACCOUNTS_0_SSL=true
APP_MAIL_ACCOUNTS_0_STARTTLS=false
LOGISTICS_API_URL=
LOGISTICS_API_KEY=
KUAIDI100_ENABLED=false
KUAIDI100_CUSTOMER=
KUAIDI100_KEY=
CORS_ALLOWED_ORIGIN_PATTERNS=https://your-frontend-domain.example
WEBSOCKET_ALLOWED_ORIGIN_PATTERNS=https://your-frontend-domain.example
JPA_SHOW_SQL=false
HIBERNATE_SQL_LOG_LEVEL=WARN
HIBERNATE_BINDER_LOG_LEVEL=WARN
MYBATIS_MAPPER_LOG_LEVEL=WARN
NACOS_DISCOVERY_ENABLED=true
NACOS_REGISTER_ENABLED=true
NACOS_SERVER_ADDR=nacos.internal.example:8848
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

For production, point MySQL, Redis, and Nacos to your internal hostnames or private IPs in `/etc/shoptest/backend.env`. The backend will not register in Nacos until it has fully started, so a database login failure appears in Nacos as an empty `shop-backend` instance list. Use the dedicated MySQL user `shop` and grant it from the backend server source IP:

```sql
CREATE USER IF NOT EXISTS 'shop'@'BACKEND_SOURCE_IP' IDENTIFIED BY 'replace-with-production-db-password';
GRANT ALL PRIVILEGES ON shop.* TO 'shop'@'BACKEND_SOURCE_IP';
FLUSH PRIVILEGES;
```

Then set `DB_USERNAME=shop`, a generated `DB_PASSWORD`, and a generated `REDIS_PASSWORD` in `/etc/shoptest/backend.env`. Do not use repository placeholders or old sample values. Configure either `PAYMENT_CHECKOUT_BASE_URL` with a real HTTPS payment provider or complete live Stripe settings (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CHECKOUT_SUCCESS_URL`, `STRIPE_CHECKOUT_CANCEL_URL`). Configure either `LOGISTICS_API_URL` with a real HTTPS tracking provider or `KUAIDI100_ENABLED=true` plus real `KUAIDI100_CUSTOMER` / `KUAIDI100_KEY`. Keep `ADMIN_BOOTSTRAP_TOKEN=` blank after the first admin account exists. Keep `PAYMENT_SIMULATION_ENABLED=false` and `PAYMENT_SIMULATION_ALLOW_PRODUCTION=false` in production; the deploy activation script refuses to replace the jar if the bootstrap token, payment simulation, CORS/WebSocket origins, SMTP, payment, or logistics configuration is not production-ready.

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

When Nacos is available at your internal registry host, keep discovery and registration enabled:

```text
NACOS_DISCOVERY_ENABLED=true
NACOS_REGISTER_ENABLED=true
NACOS_SERVER_ADDR=nacos.internal.example:8848
```

When a gateway, frontend edge service, or another backend service should discover this API through Nacos, update `/etc/shoptest/backend.env` on the backend server:

```text
SPRING_APPLICATION_NAME=shop-backend
NACOS_DISCOVERY_ENABLED=true
NACOS_REGISTER_ENABLED=true
NACOS_SERVER_ADDR=nacos.internal.example:8848
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

Use the backend server private IP for `NACOS_DISCOVERY_IP` when consumers are in the same VPC. Use the public IP only when consumers cannot route to the private network. `NACOS_IP` and `NACOS_PORT` are still accepted as aliases for older env files. If `NACOS_DISCOVERY_ENABLED=true` or `NACOS_REGISTER_ENABLED=true`, the deploy activation script validates that `NACOS_SERVER_ADDR`, `NACOS_SERVICE_NAME`, numeric `NACOS_DISCOVERY_PORT` / `NACOS_PORT`, and required DB/Redis runtime values are configured before it replaces the running jar.

After changing `/etc/shoptest/backend.env`, restart and verify:

```bash
sudo systemctl restart shoptest-backend
journalctl -u shoptest-backend -n 100 --no-pager | grep -Ei 'nacos|register|shop-backend'
curl -fsS http://127.0.0.1:8081/app/config
curl -fsS 'http://nacos.internal.example:8848/nacos/v1/ns/instance/list?serviceName=shop-backend&groupName=DEFAULT_GROUP'
```

In the Nacos console, check `Service Management -> Services` with namespace `prod`, group `DEFAULT_GROUP`, service `shop-backend`, and verify that the registered IP and port match the value your consumers can reach.

## Service registration behavior

All deploy entry points upload `scripts/backend-remote-activate.sh` to the backend server and run it after the jar upload. That script is the single source of truth for service registration:

- creates the `shoptest` service user and group when the deploy user is `root`
- writes a hardened systemd unit with `EnvironmentFile=/etc/shoptest/backend.env`
- validates required runtime keys before replacing the active jar
- moves the uploaded jar into `/opt/shoptest/shop.jar`
- enables and restarts the `shoptest-backend` service
- runs the configured health check and Nacos instance check, then rolls back to the previous jar on failure
- verifies rollback post-start checks before leaving the previous jar in service

Useful server-side checks:

```bash
systemctl status shoptest-backend --no-pager
journalctl -u shoptest-backend -n 100 --no-pager
systemctl cat shoptest-backend
curl -fsS http://127.0.0.1:8081/app/config
```

Local deploy-script regression checks:

```bash
bash -n scripts/backend-remote-activate.sh scripts/test-backend-remote-activate.sh
bash scripts/test-backend-remote-activate.sh
```

The GitHub Actions backend deployment and the Bash local deployment script run these checks before building or uploading a jar.

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
