@echo off
rem Double-click to set up the project on Windows (runs setup.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
