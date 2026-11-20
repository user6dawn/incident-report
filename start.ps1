<#
  Starts the website (http://localhost:3000) and the ML service (http://localhost:8000),
  each in its own window. Run setup first. Close the two windows to stop them.
#>
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Ml = Join-Path $Root 'ml-service'
$venvPython = Join-Path $Ml 'venv\Scripts\python.exe'

if (-not (Test-Path (Join-Path $Root 'node_modules')) -or -not (Test-Path $venvPython)) {
  Write-Host "Packages are not installed yet. Run setup.bat (or setup.ps1) first." -ForegroundColor Yellow
  Read-Host "Press Enter to close"; exit 1
}
if (-not (Test-Path (Join-Path $Root '.env.local')) -or -not (Test-Path (Join-Path $Ml '.env'))) {
  Write-Host "Settings files are missing. Run setup.bat (or setup.ps1) first." -ForegroundColor Yellow
  Read-Host "Press Enter to close"; exit 1
}

Write-Host "Starting the ML service on http://localhost:8000 ..."
Start-Process powershell -WorkingDirectory $Ml -ArgumentList @(
  '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='ML service (port 8000)'; & '$venvPython' -m uvicorn main:app --port 8000"
)

Write-Host "Starting the website on http://localhost:3000 ..."
Start-Process powershell -WorkingDirectory $Root -ArgumentList @(
  '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='Website (port 3000)'; npm run dev"
)

# Open the browser once the website answers (up to ~90 seconds).
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest -Uri 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { Start-Process 'http://localhost:3000'; break }
  } catch { }
}
Write-Host "Running. Close the 'Website' and 'ML service' windows to stop."
