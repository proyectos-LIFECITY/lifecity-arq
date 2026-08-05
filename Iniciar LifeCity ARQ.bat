@echo off
title LifeCity ARQ - Plataforma MEP 2D
echo Iniciando LifeCity ARQ (servidor web local :8130)...
cd /d "%~dp0"
start "LifeCity ARQ Web (:8130)" python serve.py
timeout /t 3 >nul
start "" "http://localhost:8130/login.html"
exit
