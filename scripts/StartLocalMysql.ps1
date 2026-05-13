param(
    [string]$MysqlHome = 'C:\Program Files\MySQL\MySQL Server 8.0',
    [string]$DataDir = (Join-Path (Resolve-Path .) 'mysql-data-dev'),
    [int]$Port = 3306,
    [string]$RootPassword = '84813378'
)

$ErrorActionPreference = 'Stop'

$mysqld = Join-Path $MysqlHome 'bin\mysqld.exe'
$mysql = Join-Path $MysqlHome 'bin\mysql.exe'
if (-not (Test-Path $mysqld)) {
    throw "mysqld.exe not found at $mysqld"
}
if (-not (Test-Path $mysql)) {
    throw "mysql.exe not found at $mysql"
}

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
    & $mysqld --no-defaults --initialize-insecure "--basedir=$MysqlHome" "--datadir=$DataDir"
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    Start-Process -FilePath $mysqld -ArgumentList "--no-defaults --basedir=`"$MysqlHome`" --datadir=`"$DataDir`" --port=$Port --bind-address=127.0.0.1 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci" -WindowStyle Hidden
    Start-Sleep -Seconds 5
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    throw "MySQL did not start on port $Port. Check $DataDir for the .err log."
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$passwordCheck = & $mysql --host=127.0.0.1 --port=$Port --user=root --password=$RootPassword --protocol=tcp -e "SELECT 1;" 2>$null
$passwordCheckExitCode = $LASTEXITCODE
if ($passwordCheckExitCode -ne 0) {
    & $mysql --host=127.0.0.1 --port=$Port --user=root --protocol=tcp -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$RootPassword'; FLUSH PRIVILEGES;" 2>$null
    $setPasswordExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($setPasswordExitCode -ne 0) {
        throw "Unable to authenticate as root. Check the configured RootPassword or reset the local MySQL data directory."
    }
} else {
    $ErrorActionPreference = $previousErrorActionPreference
}

Write-Host "MySQL is listening on 127.0.0.1:$Port using data dir $DataDir"
