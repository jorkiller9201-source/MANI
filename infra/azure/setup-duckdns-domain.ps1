# Bind DuckDNS subdomain to Azure Container App mani-web + HTTPS + PUBLIC_URL/CORS
# Prerequisites: DuckDNS account with subdomain created; token from https://www.duckdns.org/
param(
  [Parameter(Mandatory = $true)][string]$DuckToken,
  [string]$Subdomain = "mani-nova3",
  [string]$ResourceGroup = "rg-mani-nova3",
  [string]$AppName = "mani-web",
  [string]$EnvName = "cae-mani"
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")

$hostname = "$Subdomain.duckdns.org"
$staticIp = az containerapp env show -n $EnvName -g $ResourceGroup --query "properties.staticIp" -o tsv
if (-not $staticIp) { throw "No static IP on environment $EnvName" }

Write-Host "DuckDNS $hostname -> $staticIp"
$updateUrl = "https://www.duckdns.org/update?domains=$Subdomain&token=$DuckToken&ip=$staticIp"
$duckResult = (Invoke-WebRequest -Uri $updateUrl -UseBasicParsing -TimeoutSec 30).Content.Trim()
if ($duckResult -ne "OK") { throw "DuckDNS update failed: $duckResult" }
Write-Host "DuckDNS OK"

Write-Host "Waiting DNS..."
$deadline = (Get-Date).AddMinutes(3)
do {
  Start-Sleep -Seconds 5
  try {
    $resolved = [System.Net.Dns]::GetHostAddresses($hostname) | ForEach-Object { $_.IPAddressToString }
  } catch { $resolved = @() }
  Write-Host ("  resolved={0}" -f ($resolved -join ","))
} while (($resolved -notcontains $staticIp) -and (Get-Date) -lt $deadline)

if ($resolved -notcontains $staticIp) {
  Write-Warning "DNS not yet pointing to $staticIp; continuing anyway"
}

Write-Host "Adding hostname on Container App..."
az containerapp hostname add -n $AppName -g $ResourceGroup --hostname $hostname 2>$null | Out-Null

Write-Host "Binding managed certificate (HTTP validation)..."
az containerapp hostname bind -n $AppName -g $ResourceGroup --hostname $hostname `
  --environment $EnvName --validation-method HTTP -o table

$publicUrl = "https://$hostname"
az containerapp update -n $AppName -g $ResourceGroup `
  --set-env-vars "PUBLIC_URL=$publicUrl" "CORS_ALLOW_ORIGINS=$publicUrl,https://mani-web.ashysky-26ab9584.eastus.azurecontainerapps.io,http://localhost:3100" `
  -o none

Write-Host ""
Write-Host "DONE. URL: $publicUrl"
Write-Host "Probe: Invoke-RestMethod $publicUrl/health"
