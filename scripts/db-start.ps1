param(
  [string]$ContainerName = "baumkalk-db",
  [string]$DataVolume = "baumkalk-db-data",
  [string]$PostgresUser = "postgres",
  [string]$PostgresPassword = "postgres",
  [string]$PostgresDb = "baumkalk",
  [int]$Port = 5432,
  [switch]$Reset
)

$ErrorActionPreference = "Stop"

Write-Host "Starting local PostgreSQL via Docker..."

if (-not (docker volume ls --format "{{.Name}}" | Select-String -SimpleMatch $DataVolume)) {
  Write-Host "Creating named Docker volume: $DataVolume"
  docker volume create $DataVolume | Out-Null
}

$containerExists = docker ps -a --format "{{.Names}}" | Select-String -SimpleMatch $ContainerName
if ($containerExists) {
  if ($Reset) {
    Write-Host "Reset requested: removing existing container $ContainerName"
    docker rm -f $ContainerName 2>$null | Out-Null
  } else {
    $isRunning = docker ps --format "{{.Names}}" | Select-String -SimpleMatch $ContainerName
    if ($isRunning) {
      Write-Host "Container '$ContainerName' is already running."
      Write-Host ("DATABASE_URL=""postgresql://{0}:{1}@localhost:{2}/{3}?schema=public""" -f $PostgresUser, $PostgresPassword, $Port, $PostgresDb)
      exit 0
    }
    Write-Host "Starting existing container '$ContainerName'..."
    docker start $ContainerName | Out-Null
    Write-Host "PostgreSQL running."
    Write-Host ("DATABASE_URL=""postgresql://{0}:{1}@localhost:{2}/{3}?schema=public""" -f $PostgresUser, $PostgresPassword, $Port, $PostgresDb)
    exit 0
  }
}

docker run --name $ContainerName `
  -e POSTGRES_USER=$PostgresUser `
  -e POSTGRES_PASSWORD=$PostgresPassword `
  -e POSTGRES_DB=$PostgresDb `
  -p ${Port}:5432 `
  -v ${DataVolume}:/var/lib/postgresql/data `
  -d postgres:16

Write-Host "PostgreSQL running."
Write-Host ("DATABASE_URL=""postgresql://{0}:{1}@localhost:{2}/{3}?schema=public""" -f $PostgresUser, $PostgresPassword, $Port, $PostgresDb)

