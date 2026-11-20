# Setup guide: run the project on any computer

## Quick start
| | Windows | macOS / Linux |
|---|---|---|
| 1. Get the code | Download the ZIP from GitHub and unzip it, or `git clone https://github.com/user6dawn/incident-report.git` | `git clone https://github.com/user6dawn/incident-report.git` |
| 2. Set up (once) | Double-click **`setup.bat`** | `chmod +x setup.sh start.sh && ./setup.sh` |
| 3. Start | Double-click **`start.bat`** | `./start.sh` |
| 4. Open | http://localhost:3000 | http://localhost:3000 |

The setup script checks and installs everything below, asks for your Supabase keys once,
and creates the settings files for you. Run it again at any time; it keeps what is already done.

> **Windows tip:** keep the project in a short path such as `C:\projects\incident-system`.
> Very long folder paths can stop scikit-learn from loading.

---

## 1. Software to install
The setup script finds these and offers to install any that are missing (with `winget` on
Windows or Homebrew on macOS). You can also install them yourself:

| Software | Version | Needed for | Download |
|---|---|---|---|
| **Node.js** (includes npm) | 20 or newer (LTS) | The website | https://nodejs.org |
| **Python** | 3.10 – 3.13 (3.11 recommended) | The ML service | https://www.python.org/downloads/ (Windows: tick **"Add python.exe to PATH"**) |
| **Git** | any | Optional: downloading updates | https://git-scm.com |
| **A web browser** | any modern one | Using the site | — |

## 2. Online accounts
| Service | Needed? | What for |
|---|---|---|
| **Supabase** (free) | **Required** | Database, logins and evidence file storage |
| GitHub | Optional | Getting the code with `git clone` |
| Vercel / Render (free) | Optional | Hosting the website / ML service online |

### Prepare Supabase (once per Supabase project)
1. Create a project at https://supabase.com.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Project Settings → API** (or **API Keys**): copy the **Project URL**, the **anon / publishable** key,
   and the **service_role / secret** key. The setup script asks for these three values.

> The **service_role** key bypasses all security rules. It goes only into `ml-service/.env`,
> which Git never uploads. Never share it or put it in the website settings.

## 3. Packages the setup installs automatically
**Website** (from `package.json`, installed by `npm ci`):

| Package | Purpose |
|---|---|
| next 15, react 19, react-dom 19 | Web framework |
| @supabase/supabase-js, @supabase/ssr | Database and login |
| leaflet, react-leaflet | Maps |
| tailwindcss, typescript, eslint (+ types) | Styling and build tools |

**ML service** (from `ml-service/requirements.txt`, installed into `ml-service/venv`):

| Package | Version | Purpose |
|---|---|---|
| fastapi | 0.115.6 | The API |
| uvicorn[standard] | 0.34.0 | Runs the API |
| scikit-learn | 1.6.1 | Isolation Forest model |
| pandas | 2.2.3 | Data handling |
| numpy | 2.2.2 | Maths |
| httpx | 0.28.1 | Talks to Supabase |
| python-dotenv | 1.0.1 | Reads `.env` settings |

## 4. Settings files the setup creates
| File | Contains |
|---|---|
| `.env.local` | Supabase URL, anon key, ML service URL, ML API key |
| `ml-service/.env` | Supabase URL, **service_role key**, the same ML API key, model settings |

Templates: `.env.example` and `ml-service/.env.example`.

## 5. After setup
- **First admin:** register on the site with `admin@bingham.edu.ng`; that email becomes an admin automatically.
  To use a different admin email, change it in `supabase/schema.sql` and re-run that part in the SQL Editor.
- **Sample data:** setup can load ~600 sample incidents and 20 demo students. To do it later:
  ```bash
  cd ml-service
  venv\Scripts\activate        # macOS/Linux: source venv/bin/activate
  python seed.py               # sample incidents   (python seed.py --clear to remove)
  python seed_users.py         # demo students      (python seed_users.py --clear to remove)
  ```
- **Model evaluation (Chapter 4):** `python evaluate.py` inside the activated `ml-service` environment.

## 6. Common problems
| Problem | Fix |
|---|---|
| `setup.bat` window closes instantly | Right-click `setup.ps1` → **Run with PowerShell**, or run `powershell -ExecutionPolicy Bypass -File setup.ps1` |
| "node/python is not recognized" after installing | Close the window and run setup again (the new PATH needs a fresh window) |
| `import sklearn` fails: "filename or extension is too long" | Move the project to a shorter path such as `C:\projects\` |
| "Could not read the incidents table" | Run `supabase/schema.sql` in the Supabase SQL Editor, or check the keys in `ml-service/.env` |
| "Could not reach the ML service" | Start it with `start.bat` / `./start.sh` (it runs on port 8000) |
| Port 3000 or 8000 already in use | Close the other program using it, or restart the computer |
