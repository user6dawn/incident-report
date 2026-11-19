"""
Anomaly-detection API.

    uvicorn main:app --reload --port 8000

POST /detect  (header  x-api-key: <ML_API_KEY>)
    Loads every incident from Supabase, scores them with Isolation Forest and
    writes flagged ones to the `anomalies` table. Admins' "reviewed" marks are kept.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException

from detector import MODEL_VERSION, detect
from supabase_rest import Supabase

load_dotenv()

CONTAMINATION = float(os.environ.get("CONTAMINATION", "0.05"))
MIN_INCIDENTS = int(os.environ.get("MIN_INCIDENTS", "20"))

app = FastAPI(title="Incident Anomaly Detection", version=MODEL_VERSION)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_VERSION, "contamination": CONTAMINATION}


@app.post("/detect")
def run_detection(x_api_key: str = Header(default="")) -> dict:
    expected = os.environ.get("ML_API_KEY", "")
    if not expected or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    db = Supabase()
    rows = db.select_all("incidents", "id,category,location_name,incident_date")
    if len(rows) < MIN_INCIDENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {MIN_INCIDENTS} incidents to learn normal patterns (have {len(rows)}).",
        )

    out = detect(pd.DataFrame(rows), contamination=CONTAMINATION)
    now = datetime.now(timezone.utc).isoformat()

    flagged_rows = [
        {
            "incident_id": int(r.id),
            "anomaly_score": float(r.anomaly_score),
            "raw_score": float(r.raw_score),
            "level": r.level,
            "reason": r.reason,
            "model_version": MODEL_VERSION,
            "detected_at": now,
        }
        for r in out.flagged.itertuples()
    ]
    # `reviewed` is not sent, so an admin's earlier review mark survives re-runs.
    db.upsert("anomalies", flagged_rows, on_conflict="incident_id")

    # Remove old, unreviewed flags that the model no longer considers unusual.
    ids = ",".join(str(r["incident_id"]) for r in flagged_rows)
    filters = {"reviewed": "eq.false"}
    if ids:
        filters["incident_id"] = f"not.in.({ids})"
    else:
        filters["id"] = "gt.0"
    db.delete("anomalies", filters)

    return {
        "incidents": len(rows),
        "flagged": len(flagged_rows),
        "train_ms": out.train_ms,
        "predict_ms": out.predict_ms,
    }
