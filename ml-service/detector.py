"""
Isolation Forest anomaly detection for campus incident reports.

Each incident is turned into a small set of explainable numeric features:
  - time of day (as sine/cosine so 23:00 and 01:00 are close) and weekend flag
  - how many reports came from the same location within +/-24 hours   (spikes)
  - how many reports of the same category+location within +/-72 hours (clusters)
  - how common this category is at this location overall                (rare combos)
  - how common this time of day is for this category                     (odd hours)
  - how busy this location is overall

The model gives every incident a raw score. We convert it to 0-100 (higher =
more unusual), flag the ones IsolationForest predicts as outliers (-1), and
write a plain-English reason for each flag.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

MODEL_VERSION = "iforest-v1"
LOCAL_TZ = "Africa/Lagos"

FEATURES = [
    "hour_sin", "hour_cos", "is_weekend",
    "loc_count_24h", "cat_loc_count_72h",
    "cat_loc_rarity", "cat_hour_rarity", "hour_rarity", "loc_rarity",
]


def _count_within(times: np.ndarray, window: np.timedelta64) -> np.ndarray:
    """For sorted datetimes, count how many fall within +/- window of each one (including itself)."""
    left = np.searchsorted(times, times - window, side="left")
    right = np.searchsorted(times, times + window, side="right")
    return right - left


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """df needs columns: id, category, location_name, incident_date."""
    out = df.copy()
    ts = pd.to_datetime(out["incident_date"], utc=True).dt.tz_convert(LOCAL_TZ)
    out["ts"] = ts
    out["hour"] = ts.dt.hour + ts.dt.minute / 60
    out["hour_sin"] = np.sin(2 * np.pi * out["hour"] / 24)
    out["hour_cos"] = np.cos(2 * np.pi * out["hour"] / 24)
    out["is_weekend"] = (ts.dt.dayofweek >= 5).astype(int)
    out["hour_bucket"] = (ts.dt.hour // 3).astype(int)  # 8 three-hour slots

    out = out.sort_values("ts").reset_index(drop=True)
    times_ns = out["ts"].dt.tz_convert("UTC").dt.tz_localize(None).values

    out["loc_count_24h"] = 0
    for _, idx in out.groupby("location_name").groups.items():
        idx = np.asarray(idx)
        out.loc[idx, "loc_count_24h"] = _count_within(times_ns[idx], np.timedelta64(24, "h"))

    out["cat_loc_count_72h"] = 0
    for _, idx in out.groupby(["category", "location_name"]).groups.items():
        idx = np.asarray(idx)
        out.loc[idx, "cat_loc_count_72h"] = _count_within(times_ns[idx], np.timedelta64(72, "h"))

    n = len(out)
    pair_counts = out.groupby(["category", "location_name"])["id"].transform("count")
    cat_counts = out.groupby("category")["id"].transform("count")
    cat_hour_counts = out.groupby(["category", "hour_bucket"])["id"].transform("count")
    loc_counts = out.groupby("location_name")["id"].transform("count")

    hour_counts = out.groupby("hour_bucket")["id"].transform("count")

    out["pair_count"] = pair_counts
    out["cat_loc_freq"] = pair_counts / n
    out["cat_hour_freq"] = cat_hour_counts / cat_counts
    out["loc_freq"] = loc_counts / n
    out["hour_freq"] = hour_counts / n

    # "Surprisal" = -log(frequency): rare values become large numbers, which the
    # model separates far more easily than tiny fractions close to zero.
    out["cat_loc_rarity"] = -np.log(out["cat_loc_freq"])
    out["cat_hour_rarity"] = -np.log(out["cat_hour_freq"])
    out["hour_rarity"] = -np.log(out["hour_freq"])
    out["loc_rarity"] = -np.log(out["loc_freq"])
    return out


@dataclass
class DetectionOutput:
    scored: pd.DataFrame  # all incidents with score columns
    flagged: pd.DataFrame  # only the flagged ones, with reasons
    train_ms: float
    predict_ms: float


def to_0_100(raw: np.ndarray) -> np.ndarray:
    """score_samples(): lower = more anomalous. Map to 0-100 where higher = more unusual."""
    lo, hi = raw.min(), raw.max()
    if hi - lo < 1e-12:
        return np.zeros_like(raw)
    return 100 * (hi - raw) / (hi - lo)


def explain(row: pd.Series, feats: pd.DataFrame) -> str:
    reasons: list[str] = []
    typical_loc = max(1, int(feats["loc_count_24h"].median()))
    if row["loc_count_24h"] >= max(3, feats["loc_count_24h"].quantile(0.95)):
        reasons.append(
            f"{int(row['loc_count_24h'])} reports at {row['location_name']} within 24 hours "
            f"(typical: {typical_loc})"
        )
    if row["cat_loc_count_72h"] >= max(3, feats["cat_loc_count_72h"].quantile(0.95)):
        reasons.append(
            f"{int(row['cat_loc_count_72h'])} {row['category']} reports at {row['location_name']} within 3 days"
        )
    if row["cat_hour_freq"] < 0.05:
        reasons.append(
            f"{row['category'].capitalize()} around {row['ts'].strftime('%H:%M')} is rare "
            f"(only {row['cat_hour_freq']:.0%} of {row['category']} reports happen at this time)"
        )
    if row["pair_count"] <= 2:
        reasons.append(f"{row['category'].capitalize()} is rarely reported at {row['location_name']}")
    if not reasons:
        reasons.append("Unusual combination of category, time and location compared with past reports")
    return "; ".join(reasons[:2])


def detect(df: pd.DataFrame, contamination: float = 0.05, random_state: int = 42) -> DetectionOutput:
    feats = build_features(df)
    X = StandardScaler().fit_transform(feats[FEATURES].astype(float).values)

    model = IsolationForest(n_estimators=200, contamination=contamination, random_state=random_state)
    t0 = time.perf_counter()
    model.fit(X)
    t1 = time.perf_counter()
    raw = model.score_samples(X)
    pred = model.predict(X)  # -1 = anomaly, 1 = normal
    t2 = time.perf_counter()

    feats["raw_score"] = raw
    feats["anomaly_score"] = np.round(to_0_100(raw), 2)
    feats["is_anomaly"] = pred == -1
    feats["level"] = np.where(feats["anomaly_score"] >= 75, "high", "medium")

    flagged = feats[feats["is_anomaly"]].copy()
    flagged["reason"] = flagged.apply(lambda r: explain(r, feats), axis=1)

    return DetectionOutput(
        scored=feats,
        flagged=flagged.sort_values("anomaly_score", ascending=False),
        train_ms=round((t1 - t0) * 1000, 1),
        predict_ms=round((t2 - t1) * 1000, 1),
    )
