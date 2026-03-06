@echo off
title SiniDipotongin - Server
echo.
echo  =====================================
echo   SiniDipotongin - Memulai Server...
echo  =====================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
