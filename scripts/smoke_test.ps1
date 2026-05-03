param(
  [Parameter(Mandatory=$true)][string]$ApiBase
)

$ErrorActionPreference = 'Stop'

function Test-Endpoint {
  param([string]$Name,[string]$Url)
  Write-Host "[TEST] $Name => $Url"
  $resp = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 20
  Write-Host "[OK] $Name" -ForegroundColor Green
  return $resp
}

$health = Test-Endpoint -Name 'Health' -Url "$ApiBase/api/health"
if ($health.status -ne 'ok') { throw 'health check failed' }

$tools = Test-Endpoint -Name 'Tools list' -Url "$ApiBase/api/tools"
if (-not $tools) { throw 'tools list is empty' }

$workflows = Test-Endpoint -Name 'Workflows list' -Url "$ApiBase/api/workflows"

Write-Host "\nSmoke test completed." -ForegroundColor Cyan
Write-Host "Health timestamp: $($health.timestamp)"
Write-Host "Tools count: $($tools.Count)"
if ($workflows -is [System.Array]) {
  Write-Host "Workflows count: $($workflows.Count)"
}
