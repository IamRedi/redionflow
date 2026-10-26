param(
  [string]$ContainerName = "baumkalk-db",
  [switch]$Remove
)

$ErrorActionPreference = "Stop"

if ($Remove) {
  Write-Host "Removing local PostgreSQL container..."
  docker rm -f $ContainerName
  Write-Host "Removed."
  exit 0
}

Write-Host "Stopping local PostgreSQL container (data is kept)..."
docker stop $ContainerName
Write-Host "Stopped."

