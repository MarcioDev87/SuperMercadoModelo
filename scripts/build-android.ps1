param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https?://')]
  [string]$ServerUrl
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot 'capacitor.config.json'
$jdk21 = Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($jdk21) { $env:JAVA_HOME = $jdk21.FullName }
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$config.server.url = $ServerUrl.TrimEnd('/')
$config.server.cleartext = $ServerUrl.StartsWith('http://')
$config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding utf8

Push-Location $projectRoot
try {
  npx cap sync android
  Push-Location (Join-Path $projectRoot 'android')
  try {
    .\gradlew.bat assembleDebug
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

Write-Host "APK: $projectRoot\android\app\build\outputs\apk\debug\app-debug.apk"
