param(
    [string]$FrontendDir = "frontend",
    [string]$OutputDir = "artifacts/frontend-build"
)

$ErrorActionPreference = "Stop"

Push-Location $FrontendDir
try {
    npm.cmd ci
    npm.cmd run build
} finally {
    Pop-Location
}

if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}

New-Item -ItemType Directory -Force $OutputDir | Out-Null
Copy-Item -Recurse -Force "$FrontendDir/build/*" $OutputDir

Write-Host "Static frontend ready at $OutputDir"
