#!/usr/bin/env bash
# Campus Incident Management System - one-time setup for macOS / Linux.
#
#   chmod +x setup.sh start.sh
#   ./setup.sh
#
# Checks Node.js 20+, Python 3.10-3.13 and Git; installs the website (npm) and
# ML service (Python venv + pip) packages; creates .env.local and ml-service/.env
# (asking for your Supabase keys, generating a matching ML_API_KEY); optionally
# loads sample data.
set -uo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
ML="$ROOT/ml-service"

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[32m[ok]\033[0m %s\n' "$1"; }
warn() { printf '    \033[33m[!]\033[0m  %s\n' "$1"; }
fail() { printf '    \033[31m[x]\033[0m  %s\n' "$1"; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

install_hint() {
  # $1 = brew formula, $2 = apt package, $3 = label
  if [ "$(uname)" = "Darwin" ]; then
    if has brew; then
      read -r -p "    $3 is missing. Install it with Homebrew now? [Y/n] " a
      case "${a:-y}" in [Yy]*) brew install "$1"; return ;; esac
    else
      warn "Install Homebrew from https://brew.sh, or download $3 from its website."
    fi
  else
    warn "Install $3, e.g.:  sudo apt install $2   (or your distribution's equivalent)"
  fi
  has "${4:-node}" || fail "$3 is required. Install it, then run ./setup.sh again."
}

echo "Campus Incident Management System - setup"

# ------------------------------------------------------------------ 1. Tools
step "Checking required tools"

has node || install_hint node nodejs "Node.js 20+" node
NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js $(node -v) is too old. Install Node.js 20 or newer (https://nodejs.org)."
ok "Node.js $(node -v), npm $(npm -v)"

PY=""
for c in python3.11 python3.12 python3.13 python3.10 python3 python; do
  if has "$c"; then
    v="$("$c" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)"
    case "$v" in 3.10|3.11|3.12|3.13) PY="$c"; break ;; esac
  fi
done
if [ -z "$PY" ]; then
  install_hint python@3.11 "python3 python3-venv" "Python 3.10-3.13" python3
  PY=python3
fi
ok "$("$PY" --version)"

if has git; then ok "$(git --version)"; else warn "Git not found (optional: only needed for updates)."; fi

# ------------------------------------------------------------------ 2. Website packages
step "Installing website packages (npm) - this can take a few minutes"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi \
  || fail "npm install failed. Check your internet connection and try again."
ok "Website packages installed"

# ------------------------------------------------------------------ 3. ML service packages
step "Setting up the ML service (Python virtual environment + packages)"
VPY="$ML/venv/bin/python"
if [ ! -x "$VPY" ]; then
  "$PY" -m venv "$ML/venv" || fail "Could not create the virtual environment (on Debian/Ubuntu: sudo apt install python3-venv)."
fi
"$VPY" -m pip install --upgrade pip --quiet --disable-pip-version-check
"$VPY" -m pip install -r "$ML/requirements.txt" --quiet --disable-pip-version-check \
  || fail "pip install failed. Check your internet connection and try again."
"$VPY" -c "import sklearn, fastapi, pandas, numpy, httpx; print('    [ok] ML packages import correctly (scikit-learn ' + sklearn.__version__ + ')')" \
  || fail "ML packages did not load."

# ------------------------------------------------------------------ 4. Settings files
step "Creating settings files"
if [ -f .env.local ] && [ -f "$ML/.env" ]; then
  ok ".env.local and ml-service/.env already exist - keeping them"
else
  echo "    You need a Supabase project (free at supabase.com) with supabase/schema.sql already run."
  echo "    Find the values in Supabase > Project Settings > API (or API Keys)."
  read -r -p "    Supabase Project URL (https://xxxx.supabase.co): " SUPABASE_URL
  read -r -p "    Supabase anon / publishable key: " ANON_KEY
  read -r -s -p "    Supabase service_role / secret key (hidden): " SERVICE_KEY; echo
  SUPABASE_URL="${SUPABASE_URL%/}"
  case "$SUPABASE_URL" in https://*) ;; *) fail "The Supabase URL should start with https://";; esac
  API_KEY="$("$VPY" -c 'import secrets; print(secrets.token_urlsafe(32))')"
  cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
ML_SERVICE_URL=http://localhost:8000
ML_API_KEY=$API_KEY
EOF
  cat > "$ML/.env" <<EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
ML_API_KEY=$API_KEY
CONTAMINATION=0.05
MIN_INCIDENTS=20
EOF
  chmod 600 .env.local "$ML/.env"
  ok "Created .env.local and ml-service/.env (with a matching ML_API_KEY)"
fi

if COUNT="$(cd "$ML" && "$VPY" -c "from dotenv import load_dotenv; load_dotenv(); from supabase_rest import Supabase; print(len(Supabase().select_all('incidents','id')))" 2>/dev/null)"; then
  ok "Connected to Supabase ($COUNT incidents in the database)"
  read -r -p "    Load ~600 sample incidents and 20 demo students? (good for demos) [y/N] " a
  case "${a:-n}" in
    [Yy]*) step "Loading sample data"; (cd "$ML" && "$VPY" seed.py && "$VPY" seed_users.py) ;;
  esac
else
  warn "Could not read the 'incidents' table. Run supabase/schema.sql in the Supabase SQL Editor,"
  warn "or check the keys in ml-service/.env, then run ./setup.sh again."
fi

# ------------------------------------------------------------------ Done
step "Setup complete"
echo "    Start everything:   ./start.sh"
echo "    Website:            http://localhost:3000"
echo "    ML service:         http://localhost:8000/health"
echo "    First admin:        register with admin@bingham.edu.ng on the website"
