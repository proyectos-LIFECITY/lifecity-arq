@echo off
setlocal EnableExtensions
title LifeCity ARQ - Instalador
set "SRC=%~dp0"
set "DEST=%LOCALAPPDATA%\LifeCity ARQ"

echo ==================================================
echo    LifeCity ARQ  -  Instalador
echo    Plataforma colaborativa de diseno MEP 2D
echo ==================================================
echo.

REM ---- 1) Verificar Python -------------------------------------------
set "PYOK="
where python >nul 2>nul && set "PYOK=1"
if not defined PYOK where py >nul 2>nul && set "PYOK=1"
if not defined PYOK (
  echo  [!] No se encontro Python, y es necesario para ejecutar la app.
  echo.
  echo      Instalalo con este comando (PowerShell / CMD):
  echo         winget install -e --id Python.Python.3.12
  echo      o descargalo de https://www.python.org/downloads/
  echo      IMPORTANTE: marca la casilla "Add Python to PATH".
  echo.
  start "" "https://www.python.org/downloads/"
  echo  Vuelve a ejecutar INSTALAR.bat cuando Python este instalado.
  echo.
  pause
  exit /b 1
)
echo  [1/3] Python detectado. OK.

REM ---- 2) Copiar la app a una ubicacion estable ----------------------
echo  [2/3] Instalando en:  %DEST%
if not exist "%DEST%" mkdir "%DEST%"
robocopy "%SRC%." "%DEST%" /E /NFL /NDL /NJH /NJS /NP /XD ".git" "dist" "marketing" /XF "INSTALAR.bat" >nul

REM ---- 3) Acceso directo en el Escritorio ----------------------------
set "LNK=%USERPROFILE%\Desktop\LifeCity ARQ.lnk"
powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut('%LNK%'); $s.TargetPath='%DEST%\Iniciar LifeCity ARQ.bat'; $s.WorkingDirectory='%DEST%'; $s.IconLocation='%SystemRoot%\System32\shell32.dll,13'; $s.Description='LifeCity ARQ - Diseno MEP 2D'; $s.Save()"
echo  [3/3] Acceso directo creado en el Escritorio.
echo.
echo  Instalacion completa.
echo.

choice /C SN /M "Iniciar LifeCity ARQ ahora (S/N)"
if errorlevel 2 goto :fin
start "" "%DEST%\Iniciar LifeCity ARQ.bat"

:fin
echo.
echo  Abre la app cuando quieras desde el icono "LifeCity ARQ" del Escritorio.
echo  Usuario demo:  ana@lifecity.com.co  /  electrico
echo.
pause
