"use client";

import { useState, useTransition } from "react";
import { runDetection, type DetectionResult } from "../actions";

export default function RunDetectionButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<DetectionResult | null>(null);

  return (
    <div className="text-right">
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() => start(async () => setResult(await runDetection()))}
      >
        {pending ? "Scoring reports…" : "Run anomaly detection"}
      </button>
      {result && (
        <p className={`mt-2 text-xs ${result.ok ? "text-slate-500" : "text-red-600"}`}>
          {result.ok
            ? `Scored ${result.incidents} reports, flagged ${result.flagged}. Training ${result.train_ms} ms, prediction ${result.predict_ms} ms.`
            : result.error}
        </p>
      )}
    </div>
  );
}
