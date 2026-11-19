"""
Offline evaluation of the anomaly detector on synthetic data with known anomalies.
Prints precision, recall, F1, a confusion matrix and timing — results for Chapter 4.

    python evaluate.py
    python evaluate.py --contamination 0.04
"""

import argparse
import time

import numpy as np
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score

from detector import detect
from synthetic import generate


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--contamination", type=float, default=0.05)
    ap.add_argument("--runs", type=int, default=5, help="different random datasets to average over")
    args = ap.parse_args()

    p, r, f, totals = [], [], [], np.zeros((2, 2), dtype=int)
    train_ms, predict_ms = [], []
    for seed in range(args.runs):
        data = generate(seed=seed)
        out = detect(data[["id", "category", "location_name", "incident_date"]], args.contamination)
        labels = data[["id", "is_anomaly", "kind"]].rename(columns={"is_anomaly": "label"})
        merged = out.scored.merge(labels, on="id")
        y_pred = merged["is_anomaly"].astype(int).values  # model prediction
        y_true = merged["label"].astype(int).values        # planted ground truth

        p.append(precision_score(y_true, y_pred, zero_division=0))
        r.append(recall_score(y_true, y_pred, zero_division=0))
        f.append(f1_score(y_true, y_pred, zero_division=0))
        totals += confusion_matrix(y_true, y_pred, labels=[0, 1])
        train_ms.append(out.train_ms)
        predict_ms.append(out.predict_ms)

        if seed == 0:
            n = len(merged)
            t0 = time.perf_counter()
            detect(data[["id", "category", "location_name", "incident_date"]], args.contamination)
            full_ms = (time.perf_counter() - t0) * 1000
            caught = merged[merged["label"] == 1].groupby("kind")["is_anomaly"].mean()

    print(f"\nIsolation Forest evaluation  (contamination={args.contamination}, {args.runs} synthetic datasets)")
    print("-" * 64)
    print(f"Precision : {np.mean(p):.3f}  (+/- {np.std(p):.3f})")
    print(f"Recall    : {np.mean(r):.3f}  (+/- {np.std(r):.3f})")
    print(f"F1-score  : {np.mean(f):.3f}  (+/- {np.std(f):.3f})")
    print("\nConfusion matrix (summed over runs)")
    print("                 predicted normal   predicted anomaly")
    print(f"actual normal    {totals[0, 0]:>16} {totals[0, 1]:>19}")
    print(f"actual anomaly   {totals[1, 0]:>16} {totals[1, 1]:>19}")
    print("\nRecall by planted anomaly type (dataset 1)")
    for kind, rate in caught.items():
        print(f"  {kind:<26} {rate:.0%}")
    print("\nTiming")
    print(f"  Training      : {np.mean(train_ms):.1f} ms")
    print(f"  Prediction    : {np.mean(predict_ms):.1f} ms for {n} incidents")
    print(f"  Full pipeline : {full_ms:.1f} ms (features + training + scoring)\n")


if __name__ == "__main__":
    main()
