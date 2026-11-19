"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import MapView from "./MapView";
import { LevelBadge, StatusBadge, formatDate } from "./ui";
import { createClient } from "@/lib/supabase/client";
import { STATUSES } from "@/lib/constants";
import type { Anomaly, Incident, Status } from "@/lib/types";
import { setReviewed, updateStatus } from "@/app/admin/actions";

type Detail = Incident & {
  profiles: { full_name: string; matric_no: string | null } | null;
  anomalies: Anomaly | Anomaly[] | null;
  evidence: { id: number; file_path: string; file_name: string; url?: string }[];
};

/**
 * Pop-up with an incident's details. Opens whenever the URL has ?incident=<id>.
 * Students see their own incidents read-only (database security rules decide access);
 * admins can also change the status and review the anomaly flag.
 */
export default function IncidentModal({ role }: { role: "student" | "admin" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = Number(params.get("incident")) || null;

  const [incident, setIncident] = useState<Detail | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "missing">("idle");
  const [status, setStatus] = useState<Status>("new");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("incident");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const load = useCallback(async (incidentId: number) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("incidents")
      .select("*, profiles:incident_profiles(full_name, matric_no), anomalies(*), evidence(id, file_path, file_name)")
      .eq("id", incidentId)
      .maybeSingle();
    if (!data) {
      setIncident(null);
      setState("missing");
      return;
    }
    const detail = data as Detail;
    // Evidence is private: make short-lived download links.
    detail.evidence = await Promise.all(
      detail.evidence.map(async (e) => {
        const { data: signed } = await supabase.storage.from("evidence").createSignedUrl(e.file_path, 3600);
        return { ...e, url: signed?.signedUrl };
      }),
    );
    setIncident(detail);
    setStatus(detail.status);
    setState("idle");
  }, []);

  useEffect(() => {
    setMessage(null);
    if (!id) {
      setIncident(null);
      return;
    }
    setState("loading");
    load(id);
  }, [id, load]);

  // Close on Escape and stop the page behind from scrolling.
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [id, close]);

  if (!id) return null;

  const anomaly = incident
    ? (Array.isArray(incident.anomalies) ? incident.anomalies[0] : incident.anomalies) ?? null
    : null;

  function saveStatus() {
    if (!incident) return;
    const form = new FormData();
    form.set("id", String(incident.id));
    form.set("status", status);
    startSaving(async () => {
      try {
        await updateStatus(form);
        setMessage({ ok: true, text: `Status changed to ${status}.` });
        await load(incident.id);
        router.refresh(); // update the tables and counts behind the modal
      } catch {
        setMessage({ ok: false, text: "Could not save the status. Please try again." });
      }
    });
  }

  function toggleReviewed() {
    if (!anomaly || !incident) return;
    const form = new FormData();
    form.set("id", String(anomaly.id));
    form.set("reviewed", String(!anomaly.reviewed));
    startSaving(async () => {
      await setReviewed(form);
      await load(incident.id);
      router.refresh();
    });
  }

  const reporter = !incident
    ? ""
    : incident.is_anonymous
      ? role === "admin" ? "Anonymous" : "You (sent anonymously)"
      : role === "admin"
        ? `${incident.profiles?.full_name || "—"}${incident.profiles?.matric_no ? ` (${incident.profiles.matric_no})` : ""}`
        : "You";

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true"
         aria-labelledby="incident-modal-title">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={close} />

      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Incident #{id}</p>
            <h2 id="incident-modal-title" className="mt-0.5 text-lg font-semibold capitalize text-slate-800">
              {incident ? `${incident.category} · ${incident.location_name}` : state === "missing" ? "Not available" : "Loading…"}
            </h2>
            {incident && (
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={incident.status} />
                {anomaly && role === "admin" && <LevelBadge level={anomaly.level} score={anomaly.anomaly_score} />}
              </div>
            )}
          </div>
          <button onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5">
          {state === "loading" && !incident && (
            <div className="space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
            </div>
          )}

          {state === "missing" && (
            <p className="text-sm text-slate-500">This incident does not exist, or you do not have access to it.</p>
          )}

          {incident && (
            <div className="space-y-5">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-400">Happened</dt><dd className="text-slate-700">{formatDate(incident.incident_date)}</dd></div>
                <div><dt className="text-slate-400">Reported</dt><dd className="text-slate-700">{formatDate(incident.created_at)}</dd></div>
                <div><dt className="text-slate-400">Reported by</dt><dd className={incident.is_anonymous ? "italic text-slate-500" : "text-slate-700"}>{reporter}</dd></div>
                <div><dt className="text-slate-400">Last updated</dt><dd className="text-slate-700">{formatDate(incident.updated_at)}</dd></div>
              </dl>

              <div>
                <h3 className="mb-1 text-sm text-slate-400">Description</h3>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{incident.description}</p>
              </div>

              <div>
                <h3 className="mb-1 text-sm text-slate-400">Evidence</h3>
                {incident.evidence.length === 0 ? <p className="text-sm text-slate-400">None attached.</p> : (
                  <ul className="flex flex-wrap gap-2">
                    {incident.evidence.map((e) => (
                      <li key={e.id}>
                        {e.url
                          ? <a href={e.url} target="_blank" rel="noreferrer" className="btn-secondary py-1.5 text-xs">📎 {e.file_name}</a>
                          : <span className="text-sm text-slate-500">{e.file_name}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <MapView height={200} points={[{
                id: incident.id, lat: incident.latitude, lng: incident.longitude,
                label: incident.location_name, status: incident.status,
              }]} />

              {/* Admin: anomaly flag */}
              {role === "admin" && anomaly && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                  <h3 className="mb-1 text-sm font-semibold text-slate-700">Anomaly flag</h3>
                  <p className="text-sm text-slate-700">{anomaly.reason}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Score {Number(anomaly.anomaly_score).toFixed(1)} / 100
                  </p>
                  <button onClick={toggleReviewed} disabled={saving} className="btn-secondary mt-3 py-1.5 text-xs">
                    {anomaly.reviewed ? "Mark as not reviewed" : "Mark as reviewed"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin: status control */}
        {role === "admin" && incident && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Status</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Incident status">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={status === s}
                  onClick={() => setStatus(s)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize transition ${
                    status === s
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100"
                      : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className={`text-sm ${message?.ok ? "text-green-700" : "text-red-600"}`}>{message?.text}</span>
              <button onClick={saveStatus} disabled={saving || status === incident.status} className="btn-primary">
                {saving ? "Saving…" : "Save status"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
