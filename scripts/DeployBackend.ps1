param(
    [string]$ConfigPath = "deploy/backend-upload.local.env",
    [string]$ProjectDir = "."
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Config file not found: $Path. Copy deploy/backend-upload.env.example to deploy/backend-upload.local.env and fill in your backend server info."
    }

    $config = @{}
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }

        $separatorIndex = $line.IndexOf("=")
        if ($separatorIndex -lt 1) {
            throw "Invalid config line: $line"
        }

        $key = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $config[$key] = $value
    }

    return $config
}

function Split-CommandArgs {
    param([string]$Value)

    if (-not $Value) {
        return @()
    }

    return @($Value -split "\s+" | Where-Object { $_ })
}

function Require-Command {
    param(
        [string]$Name,
        [string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name was not found. $InstallHint"
    }
}

function Quote-RemoteValue {
    param([string]$Value)

    return "'" + ($Value -replace "'", "'\''") + "'"
}

$config = Read-EnvFile -Path $ConfigPath

$deployHost = $config["BACKEND_DEPLOY_HOST"]
$deployUser = $config["BACKEND_DEPLOY_USER"]
$deployPassword = $config["BACKEND_DEPLOY_PASSWORD"]
$deployPort = if ($config["BACKEND_DEPLOY_PORT"]) { $config["BACKEND_DEPLOY_PORT"] } else { "22" }
$targetDir = if ($config["BACKEND_DEPLOY_TARGET_DIR"]) { $config["BACKEND_DEPLOY_TARGET_DIR"] } else { "/opt/shoptest" }
$serviceName = if ($config["BACKEND_DEPLOY_SERVICE"]) { $config["BACKEND_DEPLOY_SERVICE"] } else { "shoptest-backend" }
$remoteTempDir = if ($config["BACKEND_REMOTE_TEMP_DIR"]) { $config["BACKEND_REMOTE_TEMP_DIR"] } else { "/tmp/shoptest-backend-deploy" }
$jarName = if ($config["BACKEND_JAR_NAME"]) { $config["BACKEND_JAR_NAME"] } else { "shop.jar" }
$owner = if ($config["BACKEND_DEPLOY_OWNER"]) { $config["BACKEND_DEPLOY_OWNER"] } else { "" }
$healthcheckUrl = if ($config["BACKEND_HEALTHCHECK_URL"]) { $config["BACKEND_HEALTHCHECK_URL"] } else { "" }
$mavenArgs = Split-CommandArgs $(if ($config["MAVEN_ARGS"]) { $config["MAVEN_ARGS"] } else { "-DskipTests package" })
$rsyncOptions = Split-CommandArgs $(if ($config["RSYNC_OPTIONS"]) { $config["RSYNC_OPTIONS"] } else { "-az --delay-updates" })
$sshExtraOptions = Split-CommandArgs $(if ($config["SSH_EXTRA_OPTIONS"]) { $config["SSH_EXTRA_OPTIONS"] } else { "-o StrictHostKeyChecking=accept-new" })

if (-not $deployHost -or $deployHost -eq "your.backend.server.public.ip") {
    throw "BACKEND_DEPLOY_HOST is required in $ConfigPath."
}
if (-not $deployUser) {
    throw "BACKEND_DEPLOY_USER is required in $ConfigPath."
}
if (-not $deployPassword -or $deployPassword -eq "replace-with-backend-server-password") {
    throw "BACKEND_DEPLOY_PASSWORD is required in $ConfigPath."
}

Require-Command -Name "rsync" -InstallHint "Install rsync locally, or run this script from Git Bash/MSYS2/WSL where rsync is available."
Require-Command -Name "ssh" -InstallHint "Install OpenSSH, then run this script again."
Require-Command -Name "sshpass" -InstallHint "Password-based rsync requires sshpass. For production, SSH key auth is safer."

$mavenCommand = $config["MAVEN_COMMAND"]
if (-not $mavenCommand) {
    if (Test-Path (Join-Path $ProjectDir "mvnw.cmd")) {
        $mavenCommand = (Join-Path $ProjectDir "mvnw.cmd")
    } elseif (Test-Path (Join-Path $ProjectDir "mvnw")) {
        $mavenCommand = (Join-Path $ProjectDir "mvnw")
    } else {
        $mavenCommand = "mvn"
    }
}

& $mavenCommand @mavenArgs

$jarSource = Join-Path $ProjectDir "target/shop-0.0.1-SNAPSHOT.jar"
if (-not (Test-Path $jarSource)) {
    throw "Backend jar not found: $jarSource"
}

$remote = "${deployUser}@${deployHost}"
$sshArgs = @("-p", $deployPort) + $sshExtraOptions
$sshCommand = "ssh " + ($sshArgs -join " ")

$previousSshPass = $env:SSHPASS
$env:SSHPASS = $deployPassword
try {
    Write-Host "Preparing backend server upload directory on $remote"
    & sshpass -e ssh @sshArgs $remote "mkdir -p $(Quote-RemoteValue $remoteTempDir)"

    Write-Host "Uploading backend jar to ${remote}:${remoteTempDir}/${jarName}.next"
    $rsyncArgs = @("-e", $sshCommand) + $rsyncOptions + @($jarSource, "${remote}:${remoteTempDir}/${jarName}.next")
    & sshpass -e rsync @rsyncArgs

    $targetDirQ = Quote-RemoteValue $targetDir
    $tempDirQ = Quote-RemoteValue $remoteTempDir
    $jarNameQ = Quote-RemoteValue $jarName
    $serviceNameQ = Quote-RemoteValue $serviceName
    $ownerQ = Quote-RemoteValue $owner
    $healthcheckQ = Quote-RemoteValue $healthcheckUrl
    $remoteScript = @"
set -euo pipefail
TARGET_DIR=$targetDirQ
TEMP_DIR=$tempDirQ
JAR_NAME=$jarNameQ
SERVICE_NAME=$serviceNameQ
OWNER=$ownerQ
HEALTHCHECK_URL=$healthcheckQ

if [ "`$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo -n"
fi

`$SUDO mkdir -p "`$TARGET_DIR"
`$SUDO mv "`$TEMP_DIR/`$JAR_NAME.next" "`$TARGET_DIR/`$JAR_NAME"
`$SUDO chmod 0644 "`$TARGET_DIR/`$JAR_NAME"
if [ -n "`$OWNER" ]; then
  `$SUDO chown "`$OWNER" "`$TARGET_DIR/`$JAR_NAME"
fi
`$SUDO systemctl daemon-reload
`$SUDO systemctl restart "`$SERVICE_NAME"
`$SUDO systemctl is-active --quiet "`$SERVICE_NAME"

if [ -n "`$HEALTHCHECK_URL" ]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl was not found on the backend server; skipped health check."
    exit 0
  fi
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS "`$HEALTHCHECK_URL" >/dev/null; then
      echo "Backend health check passed."
      exit 0
    fi
    sleep 3
  done
  echo "Backend health check failed: `$HEALTHCHECK_URL" >&2
  exit 1
fi
"@

    Write-Host "Activating backend service $serviceName"
    $remoteScript | & sshpass -e ssh @sshArgs $remote "bash -s"
}
finally {
    if ($null -ne $previousSshPass) {
        $env:SSHPASS = $previousSshPass
    } else {
        Remove-Item Env:\SSHPASS -ErrorAction SilentlyContinue
    }
}

Write-Host "Backend deployed successfully."
