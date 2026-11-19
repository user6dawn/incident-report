"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { STATUSES } from "@/lib/constants";

export async function updateStatus(formData: FormData) {
  const { supabase } = await requireProfile("admin");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) throw new Error("Invalid status");

  const { error } = await supabase.from("incidents").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}

export async function setReviewed(formData: FormData) {
  const { supabase } = await requireProfile("admin");
  const id = Number(formData.get("id"));
  const reviewed = formData.get("reviewed") === "true";
  const { error } = await supabase.from("anomalies").update({ reviewed }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}

export type DetectionResult =
  | { ok: true; incidents: number; flagged: number; train_ms: number; predict_ms: number }
  | { ok: false; error: string };

/** Asks the Python service to re-score every incident with Isolation Forest. */
export async function runDetection(): Promise<DetectionResult> {
  await requireProfile("admin");
  const url = process.env.ML_SERVICE_URL;
  if (!url) return { ok: false, error: "ML_SERVICE_URL is not set in .env.local" };

  try {
    const res = await fetch(`${url}/detect`, {
      method: "POST",
      headers: { "x-api-key": process.env.ML_API_KEY ?? "" },
      cache: "no-store",
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, error: body.detail ?? `Service returned ${res.status}` };
    revalidatePath("/admin", "layout");
    return { ok: true, ...body };
  } catch {
    return { ok: false, error: `Could not reach the ML service at ${url}. Is it running?` };
  }
}
