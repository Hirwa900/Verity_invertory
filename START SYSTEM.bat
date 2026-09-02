@echo off
title VERITY INVENTORY - Stock Management System

start "VERITY Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

timeout /t 5 /nobreak >nul

start "VERITY Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 8 /nobreak >nul

start http://localhost:5173

exit