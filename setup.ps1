<#
  Campus Incident Management System - one-time setup for Windows.

  Easiest: double-click setup.bat (it runs this script).
  Or in PowerShell:   powershell -ExecutionPolicy Bypass -File .\setup.ps1

  What it does:
    1. Checks for Node.js 20+, Python 3.10-3.13 and Git; offers to install missing ones (winget).
    2. Installs the website packages (npm) and the ML service packages (Python venv + pip).
    3. Creates .env.local and ml-service\.env, asking for your Supabase keys and
       generating a matching ML_API_KEY for both.
    4. Optionally loads sample incidents and demo students.

  Optional parameters (for running without questions):
    -SupabaseUrl <url> -AnonKey <key> -ServiceRoleKey <key> -Yes -Seed -SkipSeed
#>
param(
  [string]$SupabaseUrl,
  [string]$AnonKey,
  [string]$ServiceRoleKey,
  [switch]$Yes,       # answer "yes" to install prompts
  [switch]$Seed,      # load sample data without asking
  [switch]$SkipSeed   # never load sample data
)

# 'Continue' so harmless warnings that tools print to stderr don't abort the script;
# every important step checks $LASTEXITCODE instead.
$ErrorActionPreference = 'Continue'
Set-Location -Path $PSScriptRoot
$Root = $PSScriptRoot
$Ml = Join-Path $Root 'ml-service'

function Step($text)  { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Ok($text)    { Write-Host "    [ok] $text" -ForegroundColor Green }
function Warn($text)  { Write-Host "    [!]  $text" -ForegroundColor Yellow }
function Fail($text)  { Write-Host "    [x]  $text" -ForegroundColor Red; Read-Host "Press Enter to close"; exit 1 }

function Ask-YesNo($question, [bool]$default = $true) {
  if ($Yes) { return $true }
  $hint = 'Y/n'; if (-not $default) { $hint = 'y/N' }
  $answer = Read-Host "    $question [$hint]"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $default }
  return $answer.Trim().ToLower().StartsWith('y')
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Has-Command($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Install-WithWinget($id, $label) {
  if (-not (Has-Command 'winget')) {
    Fail "$label is missing and winget is not available. Install $label manually (see SETUP.md), then run setup again."
  }
  if (-not (Ask-YesNo "$label is missing. Install it now with winget?")) {
    Fail "$label is required. Install it (see SETUP.md), then run setup again."
  }
  winget install --id $id -e --accept-source-agreements --accept-package-agreements
  Refresh-Path
}

function New-RandomKey {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([Convert]::ToBase64String($bytes)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Read-Secret($prompt) {
  $secure = Read-Host "    $prompt" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Write-Utf8NoBom($path, $text) {
  [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

Write-Host "Campus Incident Management System - setup" -ForegroundColor White

# ---------------------------------------------------------------- 1. Tools
Step "Checking required tools"

if ($Root.Length -gt 90) {
  Warn "This folder path is long ($($Root.Length) characters). Python's scikit-learn can fail to load"
  Warn "on Windows when paths are too long. If the ML step fails, move the project to e.g. C:\projects\"
}

# Node.js 20+
if (-not (Has-Command 'node')) { Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js' }
if (-not (Has-Command 'node')) { Fail "Node.js was installed but is not on PATH yet. Close this window and run setup again." }
$nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) {
  Warn "Node.js $(node -v) is too old (need 20 or newer)."
  Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js 20+'
  $nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
  if ($nodeMajor -lt 20) { Fail "Node.js is still older than 20. Close this window, then run setup again." }
}
Ok "Node.js $(node -v), npm $(npm -v)"

# Python 3.10 - 3.13 (prefer the py launcher, which can pick a version)
function Find-Python {
  $candidates = @(
    @{ exe = 'py'; args = @('-3.11') }, @{ exe = 'py'; args = @('-3.12') },
    @{ exe = 'py'; args = @('-3.13') }, @{ exe = 'py'; args = @('-3.10') },
    @{ exe = 'python'; args = @() },    @{ exe = 'python3'; args = @() }
  )
  foreach ($c in $candidates) {
    if (-not (Has-Command $c.exe)) { continue }
    $ver = & $c.exe @($c.args + @('-c', "import sys; print('%d.%d' % sys.version_info[:2])")) 2>$null
    if ($LASTEXITCODE -eq 0 -and ("$ver".Trim() -match '^3\.(1[0-3])$')) { return $c }
  }
  return $null
}
$Python = Find-Python
if (-not $Python) {
  Install-WithWinget 'Python.Python.3.11' 'Python 3.11'
  $Python = Find-Python
  if (-not $Python) { Fail "Python 3.10-3.13 was not found on PATH. Close this window and run setup again." }
}
$pyExe = $Python.exe; $pyArgs = $Python.args
Ok "$(& $pyExe @($pyArgs + @('--version')) 2>&1)"

# Git (optional - only needed to pull updates / push changes)
if (Has-Command 'git') { Ok "$(git --version)" } else { Warn "Git not found (optional: only needed to download updates or push changes)." }

# ---------------------------------------------------------------- 2. Website packages
Step "Installing website packages (npm) - this can take a few minutes"
if (Test-Path (Join-Path $Root 'package-lock.json')) { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
if ($LASTEXITCODE -ne 0) { Fail "npm install failed. Check your internet connection and run setup again." }
Ok "Website packages installed"

# ---------------------------------------------------------------- 3. ML service packages
Step "Setting up the ML service (Python virtual environment + packages)"
$venvPython = Join-Path $Ml 'venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
  & $pyExe @($pyArgs + @("-m", "venv", (Join-Path $Ml "venv")))
  if ($LASTEXITCODE -ne 0) { Fail "Could not create the Python virtual environment." }
}
& $venvPython -m pip install --upgrade pip --quiet --disable-pip-version-check
& $venvPython -m pip install -r (Join-Path $Ml 'requirements.txt') --quiet --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { Fail "pip install failed. Check your internet connection and run setup again." }
& $venvPython -c "import sklearn, fastapi, pandas, numpy, httpx; print('    [ok] ML packages import correctly (scikit-learn ' + sklearn.__version__ + ')')"
if ($LASTEXITCODE -ne 0) { Fail "ML packages did not load. If the error mentions a long filename, move the project to a shorter path such as C:\projects\" }

# ---------------------------------------------------------------- 4. Settings files
Step "Creating settings files"
$webEnv = Join-Path $Root '.env.local'
$mlEnv = Join-Path $Ml '.env'

if ((Test-Path $webEnv) -and (Test-Path $mlEnv)) {
  Ok ".env.local and ml-service\.env already exist - keeping them"
} else {
  Write-Host "    You need a Supabase project (free at supabase.com) with supabase\schema.sql already run."
  Write-Host "    Find the values in Supabase > Project Settings > API (or API Keys)."
  if (-not $SupabaseUrl)    { $SupabaseUrl    = Read-Host "    Supabase Project URL (https://xxxx.supabase.co)" }
  if (-not $AnonKey)        { $AnonKey        = Read-Host "    Supabase anon / publishable key" }
  if (-not $ServiceRoleKey) { $ServiceRoleKey = Read-Secret "Supabase service_role / secret key (hidden while typing)" }
  $SupabaseUrl = $SupabaseUrl.Trim().TrimEnd('/'); $AnonKey = $AnonKey.Trim(); $ServiceRoleKey = $ServiceRoleKey.Trim()
  if (-not $SupabaseUrl.StartsWith('https://')) { Fail "The Supabase URL should start with https://" }

  $apiKey = New-RandomKey
  Write-Utf8NoBom $webEnv @"
NEXT_PUBLIC_SUPABASE_URL=$SupabaseUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=$AnonKey
ML_SERVICE_URL=http://localhost:8000
ML_API_KEY=$apiKey
"@
  Write-Utf8NoBom $mlEnv @"
SUPABASE_URL=$SupabaseUrl
SUPABASE_SERVICE_ROLE_KEY=$ServiceRoleKey
ML_API_KEY=$apiKey
CONTAMINATION=0.05
MIN_INCIDENTS=20
"@
  Ok "Created .env.local and ml-service\.env (with a matching ML_API_KEY)"
}

# Check the ML service can reach Supabase
Push-Location $Ml
$check = & $venvPython -c "from dotenv import load_dotenv; load_dotenv(); from supabase_rest import Supabase; print(len(Supabase().select_all('incidents','id')))" 2>&1
$checkOk = ($LASTEXITCODE -eq 0)
Pop-Location
if ($checkOk) {
  Ok "Connected to Supabase ($($check | Select-Object -Last 1) incidents in the database)"
} else {
  Warn "Could not read the 'incidents' table. Either supabase\schema.sql has not been run in your"
  Warn "Supabase SQL Editor yet, or a key in ml-service\.env is wrong. Fix that, then run setup again."
}

# ---------------------------------------------------------------- 5. Sample data (optional)
if ($checkOk -and -not $SkipSeed) {
  $loadSample = $Seed
  if (-not $Seed) { $loadSample = Ask-YesNo "Load ~600 sample incidents and 20 demo students? (good for demos)" $false }
  if ($Yes -and -not $Seed) { $loadSample = $false }  # -Yes only answers install prompts
  if ($loadSample) {
    Step "Loading sample data"
    Push-Location $Ml
    & $venvPython seed.py
    & $venvPython seed_users.py
    Pop-Location
  }
}

# ---------------------------------------------------------------- Done
Step "Setup complete"
Write-Host "    Start everything:   double-click start.bat   (or: .\start.ps1)"
Write-Host "    Website:            http://localhost:3000"
Write-Host "    ML service:         http://localhost:8000/health"
Write-Host "    First admin:        register with admin@bingham.edu.ng on the website"
Write-Host ""
if (-not $Yes) { Read-Host "Press Enter to close" }
