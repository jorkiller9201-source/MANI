# Configure SMTP secrets on Azure Container App mani-web (password reset emails).
# Usage (do NOT commit passwords):
#   .\infra\azure\set-smtp.ps1 -SmtpUser "jorkiller9201@gmail.com" -SmtpPassword "xxxx xxxx xxxx xxxx" -Provider Gmail
#   .\infra\azure\set-smtp.ps1 -SmtpUser "jorge_gutierrez1992@hotmail.com" -SmtpPassword "tu-clave" -Provider Outlook

param(
  [Parameter(Mandatory = $true)][string]$SmtpUser,
  [Parameter(Mandatory = $true)][string]$SmtpPassword,
  [ValidateSet("Gmail", "Outlook")][string]$Provider = "Gmail",
  [string]$SmtpFrom = "",
  [string]$AppName = "mani-web",
  [string]$ResourceGroup = "rg-mani-nova3"
)

$ErrorActionPreference = "Stop"

if ($Provider -eq "Gmail") {
  $hostName = "smtp.gmail.com"
} else {
  $hostName = "smtp-mail.outlook.com"
}

if (-not $SmtpFrom) { $SmtpFrom = $SmtpUser }

Write-Host "Setting SMTP on $AppName ($Provider -> $hostName) ..."
az containerapp update -n $AppName -g $ResourceGroup `
  --set-env-vars `
    "SMTP_HOST=$hostName" `
    "SMTP_PORT=587" `
    "SMTP_USER=$SmtpUser" `
    "SMTP_PASSWORD=$SmtpPassword" `
    "SMTP_FROM=$SmtpFrom" `
    "SMTP_USE_TLS=true" `
    "APP_ENV=production" | Out-Null

Write-Host "Done. Wait ~20s for revision, then test Forgot password on the live site."
