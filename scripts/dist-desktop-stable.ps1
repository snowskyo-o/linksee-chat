$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content -Raw $packageJsonPath | ConvertFrom-Json
$appVersion = [string]$packageJson.version
if ([string]::IsNullOrWhiteSpace($appVersion)) {
  throw "Package version not found in package.json"
}

$releaseDir = Join-Path $projectRoot "release"
$desktopReleaseDir = Join-Path $releaseDir "desktop"
$versionReleaseDir = Join-Path $desktopReleaseDir $appVersion
$electronCacheZip = "C:\Users\14300\AppData\Local\electron\Cache\5e0e70a0e0fed4233dc44442e29139d03b0ea0c6387fd4fc014de101787c1422\electron-v31.7.7-win32-x64.zip"
$electronDist = Join-Path $projectRoot ".cache\electron-v31.7.7-win32-x64"

if (-not (Test-Path $electronCacheZip)) {
  throw "Electron cache zip not found: $electronCacheZip"
}

New-Item -ItemType Directory -Path (Split-Path -Parent $electronDist) -Force | Out-Null

if (-not (Test-Path (Join-Path $electronDist "electron.exe"))) {
  if (Test-Path $electronDist) {
    Remove-Item -LiteralPath $electronDist -Recurse -Force
  }
  New-Item -ItemType Directory -Path $electronDist -Force | Out-Null
  Expand-Archive -LiteralPath $electronCacheZip -DestinationPath $electronDist -Force
}

$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

Push-Location $projectRoot
try {
  New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
  New-Item -ItemType Directory -Path $desktopReleaseDir -Force | Out-Null

  npm run build:web
  if ($LASTEXITCODE -ne 0) {
    throw "build:web failed"
  }

  if (Test-Path $versionReleaseDir) {
    Remove-Item -LiteralPath $versionReleaseDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $versionReleaseDir -Force | Out-Null

  Write-Host "Packaging desktop app to $versionReleaseDir"

  & npx electron-builder --win portable --x64 "--config.electronDist=$electronDist" "--config.directories.output=$versionReleaseDir"
  if ($LASTEXITCODE -ne 0) {
    throw "electron-builder failed"
  }
} finally {
  Pop-Location
}
