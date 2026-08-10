# =============================================================
#  LifeCity ARQ - Empaquetador
#  Genera dist\LifeCity-ARQ.zip listo para subir/compartir
#  (GitHub Release, Drive, tu servidor, etc.)
#  Uso:  clic derecho > "Ejecutar con PowerShell"
#        o:  powershell -ExecutionPolicy Bypass -File build-package.ps1
# =============================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$zip = Join-Path $dist 'LifeCity-ARQ.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }

# Carpeta temporal de armado: LifeCity ARQ\<archivos>
$stage = Join-Path $env:TEMP ('LifeCityARQ-stage-' + [guid]::NewGuid().ToString('N'))
$appDir = Join-Path $stage 'LifeCity ARQ'
New-Item -ItemType Directory -Force -Path $appDir | Out-Null

# Copiar la app (sin .git, dist, marketing, ni este script)
robocopy $root $appDir /E /XD '.git' 'dist' 'marketing' /XF 'build-package.ps1' | Out-Null

# Comprimir
Compress-Archive -Path $appDir -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host ""
Write-Host "  Paquete creado:" -ForegroundColor Green
Write-Host "  $zip  ($mb MB)"
Write-Host ""
Write-Host "  Subelo a un enlace de descarga y pegalo en el correo de invitacion."
