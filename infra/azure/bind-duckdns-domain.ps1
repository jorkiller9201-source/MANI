# Bind a DuckDNS hostname to MANI Container App + managed TLS + PUBLIC_URL/CORS.
# Prerequisites: az login; DuckDNS A record already pointing to the env static IP.
# Usage:
#   .\infra\azure\bind-duckdns-domain.ps1 -Hostname mani-nova3.duckdns.org
# Optional (auto-refresh DuckDNS A record once):
#   .\infra\azure\bind-duckdns-domain.ps1 -Hostname mani-nova3.duckdns.org -DuckToken YOUR_TOKEN

param(
  [Parameter(Mandatory = $true)]
  [string]$Hostname,

  [string]$ResourceGroup = "rg-mani-nova3",
  [string]$AppName = "mani-web",
  [string]$Environment = "cae-mani",
  [string]$DuckToken = "",
  [ValidateSet("HTTP", "CNAME", "TXT")]
  [string]$ValidationMethod = "HTTP"
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")

$Hostname = $Hostname.Trim().ToLowerInvariant()
if ($Hostname -match "^https?://") {
  $Hostname = ([Uri]$Hostname).Host
}

Write-Host "Resolving Container Apps environment..."
$staticIp = az containerapp env show -n $Environment -g $ResourceGroup --query "properties.staticIp" -o tsv
$verifyId = az containerapp env show -n $Environment -g $ResourceGroup --query "properties.customDomainConfiguration.customDomainVerificationId" -o tsv
$appFqdn = az containerapp show -n $AppName -g $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv

Write-Host "  staticIp     = $staticIp"
Write-Host "  appFqdn      = $appFqdn"
Write-Host "  verifyId     = $verifyId"
Write-Host "  custom host  = $Hostname"
Write-Host "  validation   = $ValidationMethod"

$domainOnly = $Hostname -replace "\.duckdns\.org$", ""
if ($DuckToken) {
  # DuckDNS TXT applies to all sub-subdomains (asuid.<name>.duckdns.org), which Azure requires.
  Write-Host "Updating DuckDNS A+TXT for '$domainOnly' (asuid verification)..."
  $updateUrl = "https://www.duckdns.org/update?domains=$domainOnly&token=$DuckToken&ip=$staticIp&txt=$verifyId&verbose=true"
  $resp = Invoke-RestMethod -Uri $updateUrl -Method Get
  Write-Host "  DuckDNS response: $resp"
  if ("$resp" -notmatch "OK") {
    throw "DuckDNS update failed: $resp"
  }
  Start-Sleep -Seconds 8
}

Write-Host "Waiting briefly for DNS..."
Start-Sleep -Seconds 5
try {
  $resolved = Resolve-DnsName -Name $Hostname -Type A -ErrorAction Stop |
    Where-Object { $_.Type -eq "A" } |
    Select-Object -ExpandProperty IPAddress
  Write-Host "  DNS A = $($resolved -join ', ')"
  if ($resolved -notcontains $staticIp) {
    Write-Warning "DNS still not pointing to $staticIp. Bind may fail until TTL catches up."
  }
} catch {
  Write-Warning "Could not resolve $Hostname yet: $($_.Exception.Message)"
}

Write-Host "Adding hostname (if missing)..."
$existingJson = az containerapp hostname list -n $AppName -g $ResourceGroup -o json 2>$null
$names = @()
if ($existingJson) {
  $names = @( ($existingJson | ConvertFrom-Json) | ForEach-Object { $_.name } )
}
if ($names -notcontains $Hostname) {
  az containerapp hostname add -n $AppName -g $ResourceGroup --hostname $Hostname -o none
} else {
  Write-Host "  Hostname already present."
}

Write-Host "Binding managed certificate ($ValidationMethod)..."
az containerapp hostname bind `
  -n $AppName `
  -g $ResourceGroup `
  --hostname $Hostname `
  --environment $Environment `
  --validation-method $ValidationMethod `
  -o table

$publicUrl = "https://$Hostname"
$cors = "$publicUrl,https://$appFqdn,http://localhost:3100"
Write-Host "Updating PUBLIC_URL / CORS_ALLOW_ORIGINS..."
az containerapp update `
  -n $AppName `
  -g $ResourceGroup `
  --set-env-vars "PUBLIC_URL=$publicUrl" "CORS_ALLOW_ORIGINS=$cors" `
  -o none

Write-Host ""
Write-Host "DONE"
Write-Host "  Public URL : $publicUrl"
Write-Host "  Legacy URL : https://$appFqdn"
Write-Host "Probe after ~30s: Invoke-RestMethod $publicUrl/health"
