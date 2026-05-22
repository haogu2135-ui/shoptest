# CDR Web Tool

Standalone Spring Boot web tool for uploading a phone-number text file, choosing a query date and worker count, calling a Huawei SOAP `QueryCDR` endpoint in batches, and downloading categorized results as a zip file.

## Build

```bash
mvn package
```

The packaged jar is written to:

```text
target/cdr-web-tool-0.0.1-SNAPSHOT.jar
```

## Run

Windows PowerShell:

```powershell
$env:CDR_SOAP_URL="http://your-cdr-host/bmapp/services/BbServices"
$env:CDR_PASSWORD="your-cdr-password"
java -jar target/cdr-web-tool-0.0.1-SNAPSHOT.jar
```

Open:

```text
http://localhost:8090
```

## Configuration

All settings can be overridden by environment variables. `CDR_SOAP_URL` and `CDR_PASSWORD` are required at runtime.

```text
SERVER_PORT=8090
CDR_SOAP_URL=http://your-cdr-host/bmapp/services/BbServices
CDR_LOGIN_SYSTEM_CODE=102
CDR_PASSWORD=your-cdr-password
CDR_OPERATOR_ID=101
CDR_START_TIME=20260501000000
CDR_MAX_WORKERS=200
CDR_BATCH_SIZE=200
CDR_TIMEOUT_SECONDS=10
CDR_MIN_BATCH_MILLIS=1000
CDR_MAX_NUMBERS=100000
```

The result zip contains:

```text
voice.txt
SMS.txt
MMS.txt
GPRS.txt
withservice.txt
noservice.txt
failed.txt
summary.txt
```
