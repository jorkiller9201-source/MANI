# Deploy MANI to Azure Container Apps
# Prerequisites: az login, Docker running
param(
  [string]$SubscriptionId = "37390f8f-27a2-49df-a3d1-57a834407342",
  [string]$Location = "eastus",
  [string]$ResourceGroup = "rg-mani-nova3",
  [string]$AcrName = "acrmaninova3",
  [string]$EnvName = "cae-mani",
  [string]$AppName = "mani-web",
  [string]$ImageName = "mani:latest"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "==> Subscription $SubscriptionId"
az account set --subscription $SubscriptionId

Write-Host "==> Resource group $ResourceGroup ($Location)"
az group create --name $ResourceGroup --location $Location | Out-Null

Write-Host "==> Azure Container Registry $AcrName"
az acr create --resource-group $ResourceGroup --name $AcrName --sku Basic --admin-enabled true | Out-Null

$tag = "v$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$tagged = "mani:$tag"
Write-Host "==> Build/push image $tagged (unique tag so Container Apps pulls a new revision)"
# Prefer local docker build+push when ACR Tasks are blocked on the subscription.
$loginServer = az acr show -n $AcrName --query loginServer -o tsv
az acr login -n $AcrName | Out-Null
docker build -t "$loginServer/$tagged" -t "$loginServer/mani:latest" $Root
docker push "$loginServer/$tagged"
docker push "$loginServer/mani:latest"

$acrUser = az acr credential show -n $AcrName --query username -o tsv
$acrPass = az acr credential show -n $AcrName --query "passwords[0].value" -o tsv
$fullImage = "$loginServer/$tagged"
$ImageName = $tagged

Write-Host "==> Container Apps environment $EnvName"
az extension add --name containerapp --upgrade --yes 2>$null | Out-Null
az provider register --namespace Microsoft.App --wait 2>$null | Out-Null
az provider register --namespace Microsoft.OperationalInsights --wait 2>$null | Out-Null

az containerapp env create `
  --name $EnvName `
  --resource-group $ResourceGroup `
  --location $Location | Out-Null

$secret = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })

Write-Host "==> Deploy Container App $AppName"
az containerapp create `
  --name $AppName `
  --resource-group $ResourceGroup `
  --environment $EnvName `
  --image $fullImage `
  --registry-server $loginServer `
  --registry-username $acrUser `
  --registry-password $acrPass `
  --target-port 8080 `
  --ingress external `
  --cpu 1.0 `
  --memory 2.0Gi `
  --min-replicas 1 `
  --max-replicas 1 `
  --env-vars `
    "APP_ENV=production" `
    "DEBUG=false" `
    "HORIZONS_FORCE_OFFLINE=false" `
    "DATABASE_URL=sqlite:////app/data/mani.db" `
    "SECRET_KEY=$secret" `
    "PUBLIC_URL=https://placeholder" `
    "CORS_ALLOW_ORIGINS=*" `
    "API_PROXY_TARGET=http://127.0.0.1:8100"

$fqdn = az containerapp show -n $AppName -g $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv
$url = "https://$fqdn"

Write-Host "==> Patch PUBLIC_URL / CORS to $url"
az containerapp update -n $AppName -g $ResourceGroup `
  --set-env-vars "PUBLIC_URL=$url" "CORS_ALLOW_ORIGINS=$url" | Out-Null

Write-Host ""
Write-Host "MANI live: $url"
Write-Host "Health:    $url/health"
