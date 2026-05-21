param(
    [string]$ConfigPath = "deploy/frontend-upload.local.env",
    [string]$FrontendDir = "frontend"
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Config file not found: $Path. Copy deploy/frontend-upload.env.example to deploy/frontend-upload.local.env and fill in your server info."
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

$config = Read-EnvFile -Path $ConfigPath

$deployHost = $config["DEPLOY_HOST"]
$deployUser = $config["DEPLOY_USER"]
$deployPassword = $config["DEPLOY_PASSWORD"]
$deployPort = if ($config["DEPLOY_PORT"]) { $config["DEPLOY_PORT"] } else { "22" }
$deployTarget = if ($config["DEPLOY_TARGET"]) { $config["DEPLOY_TARGET"] } else { "/var/www/shoptest/" }

if (-not $deployHost -or $deployHost -eq "your.server.public.ip") {
    throw "DEPLOY_HOST is required in $ConfigPath."
}
if (-not $deployUser) {
    throw "DEPLOY_USER is required in $ConfigPath."
}
if (-not $deployPassword -or $deployPassword -eq "replace-with-server-password") {
    throw "DEPLOY_PASSWORD is required in $ConfigPath. If you use SSH keys, leave it empty and remove this check yourself."
}

Require-Command -Name "npm.cmd" -InstallHint "Install Node.js, then run this script again."
Require-Command -Name "rsync" -InstallHint "Install rsync locally, or run this script from Git Bash/MSYS2/WSL where rsync is available."
Require-Command -Name "sshpass" -InstallHint "Password-based rsync requires sshpass. For production, SSH key auth is safer."

Push-Location $FrontendDir
try {
    npm.cmd ci
    npm.cmd run build
}
finally {
    Pop-Location
}

$sourcePath = $FrontendDir.TrimEnd("\", "/") + "/build/"
$sourceTestPath = Join-Path $FrontendDir "build"
if (-not (Test-Path $sourceTestPath)) {
    throw "Frontend build output not found: $sourceTestPath"
}

$destination = "${deployUser}@${deployHost}:$deployTarget"
$rsyncOptions = Split-CommandArgs $config["RSYNC_OPTIONS"]
if ($rsyncOptions.Count -eq 0) {
    $rsyncOptions = @("-av", "--delete")
}

$sshOptions = @("-p", $deployPort)
$sshOptions += Split-CommandArgs $config["SSH_EXTRA_OPTIONS"]
$sshCommand = "ssh " + ($sshOptions -join " ")

$rsyncArgs = @("-e", $sshCommand)
$rsyncArgs += $rsyncOptions
$rsyncArgs += @($sourcePath, $destination)

Write-Host "Uploading static frontend to $destination"
$previousSshPass = $env:SSHPASS
$env:SSHPASS = $deployPassword
try {
    & sshpass -e rsync @rsyncArgs
}
finally {
    if ($null -ne $previousSshPass) {
        $env:SSHPASS = $previousSshPass
    } else {
        Remove-Item Env:\SSHPASS -ErrorAction SilentlyContinue
    }
}

Write-Host "Static frontend deployed successfully."
