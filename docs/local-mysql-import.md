# Local MySQL Import

This project can run against a local MySQL 8 instance using the defaults in
`src/main/resources/application.properties`:

- Database: `shop`
- Username: `root`
- Password: `84813378`
- Port: `3306`

## Start a Local Development Instance

If MySQL Server is installed but not registered as a Windows service, a local
data directory can be initialized and started from the repository root:

```powershell
.\scripts\StartLocalMysql.ps1
```

## Import Schema and Demo Data

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-22'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
$env:DB_PASSWORD='84813378'
.\mvnw.cmd -q dependency:build-classpath "-Dmdep.outputFile=target\classpath.txt"
$cp = Get-Content target\classpath.txt -Raw
javac -encoding UTF-8 -proc:none -cp $cp -d target\script-classes scripts\ImportMysqlData.java
java -cp "target\script-classes;$cp" scripts.ImportMysqlData
```

The import is idempotent: it creates the `shop` database if needed, applies the
schema, and inserts pet catalog and bundle sample data without deleting existing
rows.

`ImportMysqlData` respects the same environment variables as the backend:
`DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. You can also pass extra SQL file
paths to import only those files, in order:

```powershell
$env:DB_PASSWORD='84813378'
java -cp "target\script-classes;$cp" scripts.ImportMysqlData src/main/resources/schema.sql scripts/pet_catalog_test_data.sql
```
