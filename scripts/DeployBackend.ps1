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
$runtimeEnvFile = if ($config["BACKEND_RUNTIME_ENV_FILE"]) { $config["BACKEND_RUNTIME_ENV_FILE"] } else { "/etc/shoptest/backend.env" }
$serviceUser = if ($config["BACKEND_SERVICE_USER"]) { $config["BACKEND_SERVICE_USER"] } else { "shoptest" }
$serviceGroup = if ($config["BACKEND_SERVICE_GROUP"]) { $config["BACKEND_SERVICE_GROUP"] } else { $serviceUser }
$javaBin = if ($config["BACKEND_JAVA_BIN"]) { $config["BACKEND_JAVA_BIN"] } else { "/usr/bin/java" }
$javaOpts = if ($config["BACKEND_JAVA_OPTS"]) { $config["BACKEND_JAVA_OPTS"] } else { "-Xms128m -Xmx512m -XX:MaxMetaspaceSize=192m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8" }
$registerService = if ($config["BACKEND_REGISTER_SERVICE"]) { $config["BACKEND_REGISTER_SERVICE"] } else { "true" }
$enableService = if ($config["BACKEND_ENABLE_SERVICE"]) { $config["BACKEND_ENABLE_SERVICE"] } else { "true" }
$healthcheckRetries = if ($config["BACKEND_HEALTHCHECK_RETRIES"]) { $config["BACKEND_HEALTHCHECK_RETRIES"] } else { "10" }
$healthcheckIntervalSeconds = if ($config["BACKEND_HEALTHCHECK_INTERVAL_SECONDS"]) { $config["BACKEND_HEALTHCHECK_INTERVAL_SECONDS"] } else { "3" }
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
$activateScriptSource = Join-Path $ProjectDir "scripts/backend-remote-activate.sh"
if (-not (Test-Path $activateScriptSource)) {
    throw "Backend activation script not found: $activateScriptSource"
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

    Write-Host "Uploading backend service activation script"
    $rsyncScriptArgs = @("-e", $sshCommand) + $rsyncOptions + @($activateScriptSource, "${remote}:${remoteTempDir}/backend-remote-activate.sh")
    & sshpass -e rsync @rsyncScriptArgs

    $targetDirQ = Quote-RemoteValue $targetDir
    $tempDirQ = Quote-RemoteValue $remoteTempDir
    $jarNameQ = Quote-RemoteValue $jarName
    $serviceNameQ = Quote-RemoteValue $serviceName
    $ownerQ = Quote-RemoteValue $owner
    $healthcheckQ = Quote-RemoteValue $healthcheckUrl
    $runtimeEnvFileQ = Quote-RemoteValue $runtimeEnvFile
    $serviceUserQ = Quote-RemoteValue $serviceUser
    $serviceGroupQ = Quote-RemoteValue $serviceGroup
    $javaBinQ = Quote-RemoteValue $javaBin
    $javaOptsQ = Quote-RemoteValue $javaOpts
    $registerServiceQ = Quote-RemoteValue $registerService
    $enableServiceQ = Quote-RemoteValue $enableService
    $healthcheckRetriesQ = Quote-RemoteValue $healthcheckRetries
    $healthcheckIntervalSecondsQ = Quote-RemoteValue $healthcheckIntervalSeconds
    $activateScriptQ = Quote-RemoteValue "$remoteTempDir/backend-remote-activate.sh"
    $remoteCommand = @(
        "TARGET_DIR=$targetDirQ",
        "TEMP_DIR=$tempDirQ",
        "JAR_NAME=$jarNameQ",
        "SERVICE_NAME=$serviceNameQ",
        "OWNER=$ownerQ",
        "HEALTHCHECK_URL=$healthcheckQ",
        "RUNTIME_ENV_FILE=$runtimeEnvFileQ",
        "SERVICE_USER=$serviceUserQ",
        "SERVICE_GROUP=$serviceGroupQ",
        "JAVA_BIN=$javaBinQ",
        "JAVA_OPTS=$javaOptsQ",
        "REGISTER_SERVICE=$registerServiceQ",
        "ENABLE_SERVICE=$enableServiceQ",
        "HEALTHCHECK_RETRIES=$healthcheckRetriesQ",
        "HEALTHCHECK_INTERVAL_SECONDS=$healthcheckIntervalSecondsQ",
        "bash $activateScriptQ"
    ) -join " "

    Write-Host "Activating backend service $serviceName"
    & sshpass -e ssh @sshArgs $remote $remoteCommand
}
finally {
    if ($null -ne $previousSshPass) {
        $env:SSHPASS = $previousSshPass
    } else {
        Remove-Item Env:\SSHPASS -ErrorAction SilentlyContinue
    }
}

Write-Host "Backend deployed successfully."
