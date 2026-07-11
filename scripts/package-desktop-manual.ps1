$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $root "release"
$outputDir = Join-Path $releaseDir "manual-win-unpacked"
$stageDir = Join-Path $root ".tmp-desktop-package"
$appStageDir = Join-Path $stageDir "app"
$cacheZip = Get-ChildItem "$env:LOCALAPPDATA\electron\Cache" -Recurse -Filter "electron-v31.7.7-win32-x64.zip" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1 -ExpandProperty FullName
$sevenZip = Get-ChildItem "$env:LOCALAPPDATA\electron-builder\Cache\7zip@1.0.0" -Recurse -Filter "7za.exe" |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $cacheZip) {
  throw "未找到 Electron 缓存压缩包 electron-v31.7.7-win32-x64.zip"
}

if (-not $sevenZip) {
  throw "未找到 7za.exe"
}

Write-Host "[manual-pack] release dir: $releaseDir"
Write-Host "[manual-pack] electron zip: $cacheZip"
Write-Host "[manual-pack] 7za: $sevenZip"

Remove-Item -LiteralPath $outputDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stageDir -Recurse -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
New-Item -ItemType Directory -Path $appStageDir -Force | Out-Null

Write-Host "[manual-pack] unpacking electron runtime..."
& $sevenZip x $cacheZip "-o$outputDir" -y | Out-Null

Write-Host "[manual-pack] staging app files..."
New-Item -ItemType Directory -Path (Join-Path $appStageDir "apps\desktop") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $appStageDir "apps\web") -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $root "apps\desktop\main.cjs") -Destination (Join-Path $appStageDir "apps\desktop\main.cjs")
Copy-Item -LiteralPath (Join-Path $root "apps\desktop\preload.cjs") -Destination (Join-Path $appStageDir "apps\desktop\preload.cjs")
Copy-Item -LiteralPath (Join-Path $root "package.json") -Destination (Join-Path $appStageDir "package.json")
Copy-Item -LiteralPath (Join-Path $root "desktop-config.default.json") -Destination (Join-Path $outputDir "desktop-config.json")
Copy-Item -LiteralPath (Join-Path $root "desktop-config.default.json") -Destination (Join-Path $outputDir "resources\desktop-config.json")
Copy-Item -LiteralPath (Join-Path $root "apps\web\dist") -Destination (Join-Path $appStageDir "apps\web") -Recurse

$asarPath = Join-Path $outputDir "resources\app.asar"
Write-Host "[manual-pack] packing app.asar..."
npx asar pack $appStageDir $asarPath

$electronExe = Join-Path $outputDir "electron.exe"
$appExe = Join-Path $outputDir "Linksee Chat.exe"
if (Test-Path $appExe) {
  Remove-Item -LiteralPath $appExe -Force
}
Rename-Item -LiteralPath $electronExe -NewName "Linksee Chat.exe"

Remove-Item -LiteralPath $stageDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "[manual-pack] done: $appExe"
