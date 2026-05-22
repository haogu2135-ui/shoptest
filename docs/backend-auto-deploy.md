# Backend auto deploy

The backend server is configured separately from the frontend server. CI builds the Spring Boot jar, uploads it to the backend machine, then restarts the systemd service. Runtime secrets such as database, JWT, payment, and SMTP values stay on the backend server in `/etc/shoptest/backend.env`.

## Backend server one-time setup

On the backend server:

```bash
sudo useradd --system --home /opt/shoptest --shell /usr/sbin/nologin shoptest || true
sudo mkdir -p /opt/shoptest/uploads /etc/shoptest
sudo chown -R shoptest:shoptest /opt/shoptest
sudo cp deploy/backend.env.example /etc/shoptest/backend.env
sudo nano /etc/shoptest/backend.env
sudo cp deploy/shoptest-backend.service /etc/systemd/system/shoptest-backend.service
sudo systemctl daemon-reload
sudo systemctl enable shoptest-backend
```

Install Java 11 on the backend server. The first successful deploy uploads `/opt/shoptest/shop.jar` and restarts `shoptest-backend`.

If the deploy user is not `root`, configure passwordless sudo for `mkdir`, `mv`, `chmod`, optional `chown`, and `systemctl`, or use `root` as `BACKEND_DEPLOY_USER`.

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
```

The workflow `.github/workflows/deploy-backend.yml` runs on every push to `main`, and it can also be started manually from GitHub Actions.

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
