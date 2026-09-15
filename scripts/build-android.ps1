param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https?://')]
  [string]$ServerUrl,

  [ValidatePattern('^[a-zA-Z][a-zA-Z0-9_.]+$')]
  [string]$AppId = 'br.com.supermercadomodelo.app',

  [string]$AppName = 'Super Mercado Modelo',

  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot 'capacitor.config.json'
$gradlePath = Join-Path $projectRoot 'android\app\build.gradle'
$stringsPath = Join-Path $projectRoot 'android\app\src\main\res\values\strings.xml'
$jdk21 = Get-ChildItem 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($jdk21) { $env:JAVA_HOME = $jdk21.FullName }
$originalConfig = [IO.File]::ReadAllBytes($configPath)
$originalGradle = [IO.File]::ReadAllBytes($gradlePath)
$originalStrings = [IO.File]::ReadAllBytes($stringsPath)
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$config.appId = $AppId
$config.appName = $AppName
$config.server.url = $ServerUrl.TrimEnd('/')
$config.server.cleartext = $ServerUrl.StartsWith('http://')
$config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding utf8
(Get-Content -LiteralPath $gradlePath -Raw) -replace 'applicationId "[^"]+"', "applicationId `"$AppId`"" | Set-Content -LiteralPath $gradlePath -Encoding utf8
$escapedName = [System.Security.SecurityElement]::Escape($AppName)
$strings = Get-Content -LiteralPath $stringsPath -Raw
$strings = $strings -replace '<string name="app_name">.*?</string>', "<string name=`"app_name`">$escapedName</string>"
$strings = $strings -replace '<string name="title_activity_main">.*?</string>', "<string name=`"title_activity_main`">$escapedName</string>"
$strings = $strings -replace '<string name="package_name">.*?</string>', "<string name=`"package_name`">$AppId</string>"
$strings = $strings -replace '<string name="custom_url_scheme">.*?</string>', "<string name=`"custom_url_scheme`">$AppId</string>"
$strings | Set-Content -LiteralPath $stringsPath -Encoding utf8

Push-Location $projectRoot
try {
  npx cap sync android
  if ($LASTEXITCODE -ne 0) { throw "Capacitor sync falhou com código $LASTEXITCODE." }
  Push-Location (Join-Path $projectRoot 'android')
  try {
    .\gradlew.bat --no-daemon clean assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "Gradle falhou com código $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
} finally {
  [IO.File]::WriteAllBytes($configPath, $originalConfig)
  [IO.File]::WriteAllBytes($gradlePath, $originalGradle)
  [IO.File]::WriteAllBytes($stringsPath, $originalStrings)
  Pop-Location
}

$builtApk = Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
if ($OutputPath) {
  $resolvedOutput = if ([IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $projectRoot $OutputPath }
  $outputDirectory = Split-Path -Parent $resolvedOutput
  if ($outputDirectory) { New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null }
  Copy-Item -LiteralPath $builtApk -Destination $resolvedOutput -Force
  Write-Host "APK: $resolvedOutput"
} else {
  Write-Host "APK: $builtApk"
}
