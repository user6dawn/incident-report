"""
Generates realistic sample incident data with *planted* anomalies, so the model
can be trained, demonstrated and evaluated (precision / recall / F1) without
real university data. State this clearly in your methodology chapter.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

# Same names as CAMPUS_LOCATIONS in the web app (src/lib/constants.ts).
LOCATIONS = {
    "Main Gate": (8.9912, 7.6085), "Admin Block": (8.9930, 7.6100), "Library": (8.9938, 7.6112),
    "Faculty of Computing": (8.9945, 7.6098), "Lecture Theatre": (8.9942, 7.6120),
    "Cafeteria": (8.9927, 7.6118), "Chapel": (8.9920, 7.6105), "Male Hostel": (8.9955, 7.6125),
    "Female Hostel": (8.9958, 7.6095), "Sports Complex": (8.9965, 7.6110),
    "Car Park": (8.9918, 7.6092), "Health Centre": (8.9933, 7.6130),
}

# Normal pattern per category: (weight, usual locations, usual hours)
PATTERNS = {
    "theft":      (0.30, ["Male Hostel", "Female Hostel", "Library", "Cafeteria", "Lecture Theatre"], range(9, 23)),
    "harassment": (0.12, ["Male Hostel", "Female Hostel", "Faculty of Computing", "Cafeteria"], range(14, 22)),
    "bullying":   (0.12, ["Male Hostel", "Female Hostel", "Lecture Theatre", "Sports Complex"], range(10, 21)),
    "vandalism":  (0.10, ["Car Park", "Male Hostel", "Lecture Theatre", "Sports Complex"], range(18, 24)),
    "accident":   (0.14, ["Car Park", "Main Gate", "Sports Complex"], range(7, 19)),
    "assault":    (0.06, ["Male Hostel", "Female Hostel"], range(19, 24)),
    "fire":       (0.04, ["Cafeteria", "Male Hostel", "Female Hostel"], range(8, 20)),
    "other":      (0.12, list(LOCATIONS), range(8, 20)),
}

WAT = timezone(timedelta(hours=1))  # Nigeria (West Africa Time)


def _row(rng, category, location, when, label, kind):
    lat, lng = LOCATIONS[location]
    return {
        "category": category,
        "location_name": location,
        "latitude": lat + rng.normal(0, 0.00012),
        "longitude": lng + rng.normal(0, 0.00012),
        "incident_date": when.isoformat(),
        "description": f"[SAMPLE] {category} reported at {location}.",
        "is_anomaly": label,
        "kind": kind,
    }


def generate(n_normal: int = 570, days: int = 180, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    start = datetime(2026, 5, 1, tzinfo=WAT)
    cats = list(PATTERNS)
    weights = np.array([PATTERNS[c][0] for c in cats])
    weights = weights / weights.sum()

    rows = []
    for _ in range(n_normal):
        cat = rng.choice(cats, p=weights)
        _, locs, hours = PATTERNS[cat]
        day = int(rng.integers(0, days))
        when = start + timedelta(days=day, hours=int(rng.choice(list(hours))), minutes=int(rng.integers(0, 60)))
        rows.append(_row(rng, cat, str(rng.choice(locs)), when, 0, "normal"))

    # ---- Planted anomalies (~5%) ----
    # 1) Bursts: many reports at one place within a few hours.
    for cat, loc, day, hour, k in [("theft", "Library", 40, 13, 6), ("vandalism", "Car Park", 95, 20, 5),
                                   ("harassment", "Female Hostel", 150, 18, 5)]:
        base = start + timedelta(days=day, hours=hour)
        for _ in range(k):
            rows.append(_row(rng, cat, loc, base + timedelta(minutes=int(rng.integers(0, 150))), 1, "burst"))

    # 2) Odd hours and rare category/location combinations.
    for cat, loc, day, hour in [("fire", "Library", 22, 3), ("accident", "Chapel", 60, 2),
                                ("assault", "Admin Block", 77, 4), ("fire", "Faculty of Computing", 110, 1),
                                ("theft", "Health Centre", 130, 4), ("accident", "Library", 170, 3),
                                ("assault", "Chapel", 12, 5), ("vandalism", "Health Centre", 140, 6),
                                ("bullying", "Admin Block", 88, 2), ("harassment", "Main Gate", 165, 4),
                                ("fire", "Sports Complex", 33, 2), ("assault", "Library", 101, 3),
                                ("vandalism", "Chapel", 55, 3), ("theft", "Admin Block", 120, 2),
                                ("accident", "Health Centre", 158, 1)]:
        when = start + timedelta(days=day, hours=hour, minutes=int(rng.integers(0, 60)))
        rows.append(_row(rng, cat, loc, when, 1, "odd_hour_or_rare_place"))

    df = pd.DataFrame(rows).sample(frac=1, random_state=seed).reset_index(drop=True)
    df.insert(0, "id", range(1, len(df) + 1))
    return df
