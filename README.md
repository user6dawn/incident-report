# Automated Incident Response Management System

Web-based incident reporting and management for Bingham University, with
Isolation Forest anomaly detection.

```
incident-system/
├── src/                 Next.js web app (students + admins)
├── supabase/schema.sql  Database tables, security rules, storage bucket
└── ml-service/          Python FastAPI anomaly-detection service
```

## Features
- **Students:** register and sign in, report incidents (category, time, campus location, map pin,
  evidence upload), report **anonymously**, dashboard with totals, resolved and unresolved counts, a map and statuses.
- **Admins:** overview (statistics, map, reports by category), incident list with filters, incident
  detail (evidence, status update), student list, **flagged incidents** with 0–100 anomaly scores.
- **Anonymity:** an anonymous report stores no reporter ID. The private link that lets the
  author track it lives in a table admins cannot read, enforced by Row Level Security.
- **Anomaly detection:** Isolation Forest over time-of-day, location spikes, category/location
  clusters and rarity features. Every flag has a plain-English reason.

## 1. Supabase setup
1. Create a project at supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql` and run it.
3. **Authentication > Providers > Email**: enabled. For local testing you can turn off
   "Confirm email" so new accounts can sign in immediately.
4. **Project Settings > API**: copy the Project URL, the `anon` key and the `service_role` key.

## 2. Run the web app
```bash
copy .env.example .env.local     # then fill in the values
npm install
npm run dev                      # http://localhost:3000
```
Register an account, then make it an admin in the SQL Editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```
Register a second account to use as a student.

## 3. Run the anomaly service
```bash
cd ml-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env           # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ML_API_KEY
python seed.py                   # optional: load ~600 sample incidents
python seed_users.py             # optional: 20 demo students who own some of them (password in the script)
uvicorn main:app --reload --port 8000
```
Then in the web app: **Flagged > Run anomaly detection**.

> **Windows note:** if `import sklearn` fails with *"filename or extension is too long"*,
> the project folder path is too long. Move the project to a shorter path such as `C:\projects\`.

## 4. Evaluate the model (Chapter 4)
```bash
cd ml-service
python evaluate.py                       # precision, recall, F1, confusion matrix, timing
python evaluate.py --contamination 0.08  # compare settings
```
Results on the synthetic data (5 datasets, about 600 incidents each):

| contamination | precision | recall | F1 |
|---|---|---|---|
| 0.05 (default) | 0.71 | 0.68 | 0.70 |
| 0.06 | 0.63 | 0.74 | — |
| 0.08 | 0.58 | 0.90 | — |

Scoring 600 incidents takes about 30 ms, and training takes about 170 ms.

## How the score works
- `IsolationForest.score_samples()` gives a raw score (lower = more unusual).
- It is rescaled to **0–100** (higher = more unusual) across the current batch.
- Incidents the model predicts as outliers (`predict() == -1`, controlled by `CONTAMINATION`)
  are flagged: **High** if the score is 75 or more, otherwise **Medium**.
- A flag is a prompt for review. It does **not** mean the report is false.

## Deployment
- Web app: push to GitHub, import into **Vercel**, and add the variables from `.env.example`.
- ML service: deploy `ml-service/` to **Render** or **Railway** (start command
  `uvicorn main:app --host 0.0.0.0 --port $PORT`), then set `ML_SERVICE_URL` in Vercel to its URL.

## Before going live
Campus coordinates in `src/lib/constants.ts` (and `ml-service/synthetic.py`) are placeholders
near Karu. Move them to the real building locations.
