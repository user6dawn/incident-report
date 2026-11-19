"""
Load synthetic sample incidents into Supabase so the dashboards and the model have data.

    python seed.py            # insert ~600 sample incidents
    python seed.py --clear    # delete all sample incidents (description starts with [SAMPLE])

Sample reports are stored as anonymous with no author, and the answer key of which
ones are planted anomalies is written to sample_labels.csv for your own checks.
"""

import argparse

from dotenv import load_dotenv

from supabase_rest import Supabase
from synthetic import generate

load_dotenv()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clear", action="store_true")
    args = ap.parse_args()
    db = Supabase()

    if args.clear:
        db.delete("incidents", {"description": "like.[SAMPLE]*"})
        print("Deleted sample incidents.")
        return

    data = generate()
    statuses = ["resolved"] * 6 + ["unresolved"] * 3 + ["new"]
    rows = [
        {
            "category": r.category, "description": r.description, "location_name": r.location_name,
            "latitude": r.latitude, "longitude": r.longitude, "incident_date": r.incident_date,
            "is_anonymous": True, "status": statuses[i % len(statuses)],
        }
        for i, r in enumerate(data.itertuples())
    ]
    db.insert("incidents", rows)
    data[["incident_date", "category", "location_name", "is_anomaly", "kind"]].to_csv("sample_labels.csv", index=False)
    print(f"Inserted {len(rows)} sample incidents ({int(data.is_anomaly.sum())} planted anomalies).")
    print("Answer key written to sample_labels.csv")


if __name__ == "__main__":
    main()
