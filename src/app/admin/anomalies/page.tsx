import { Suspense } from "react";
import { LevelBadge, StatusBadge, formatDate } from "@/components/ui";
import ClickableRow from "@/components/ClickableRow";
import { requireProfile } from "@/lib/auth";
import { FLAGGED_SORTS, type FlaggedSort } from "@/lib/constants";
import type { Anomaly, Incident } from "@/lib/types";
import { setReviewed } from "../actions";
import FlaggedToolbar from "./FlaggedToolbar";
import RunDetectionButton from "./RunDetectionButton";

type Row = Anomaly & { incidents: Pick<Incident, "id" | "category" | "location_name" | "incident_date" | "status"> | null };

type Params = { q?: string; level?: string; show?: string; status?: string; category?: string; sort?: string };

export default async function AnomaliesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { q = "", level, show, status, category, sort } = await searchParams;
  const { supabase } = await requireProfile("admin");

  // Flags are a small set (about 5% of reports), so load them all and filter here.
  const { data } = await supabase
    .from("anomalies")
    .select("*, incidents(id, category, location_name, incident_date, status)");
  const all = (data ?? []) as Row[];

  const term = q.trim().toLowerCase().replace(/^#/, "");
  const rows = all
    .filter((a) => (show === "all" ? true : show === "reviewed" ? a.reviewed : !a.reviewed))
    .filter((a) => !level || a.level === level)
    .filter((a) => !status || a.incidents?.status === status)
    .filter((a) => !category || a.incidents?.category === category)
    .filter((a) => {
      if (!term) return true;
      const haystack = [
        String(a.incident_id), a.incidents?.category, a.incidents?.location_name, a.reason,
      ].join(" ").toLowerCase();
      return haystack.includes(term);
    });

  const sortKey: FlaggedSort = sort && sort in FLAGGED_SORTS ? (sort as FlaggedSort) : "score_desc";
  const time = (iso?: string) => (iso ? new Date(iso).getTime() : 0);
  rows.sort((a, b) => {
    switch (sortKey) {
      case "score_asc": return a.anomaly_score - b.anomaly_score;
      case "date_desc": return time(b.incidents?.incident_date) - time(a.incidents?.incident_date);
      case "date_asc": return time(a.incidents?.incident_date) - time(b.incidents?.incident_date);
      case "detected_desc": return time(b.detected_at) - time(a.detected_at);
      default: return b.anomaly_score - a.anomaly_score;
    }
  });

  const toReview = all.filter((a) => !a.reviewed).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">Flagged incidents</h1>
        <RunDetectionButton />
      </div>

      <Suspense fallback={<div className="card h-28 animate-pulse" />}>
        <FlaggedToolbar />
      </Suspense>

      <p className="text-sm text-slate-500">
        Showing <strong className="text-slate-700">{rows.length}</strong> of {all.length} flags · {toReview} still to review
      </p>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[820px]">
          <thead className="table-head">
            <tr>
              <th className="table-th">Score</th>
              <th className="table-th">Incident</th>
              <th className="table-th">Reason</th>
              <th className="table-th">Happened</th>
              <th className="table-th">Status</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="table-td py-8 text-center text-slate-500">
                {all.length === 0
                  ? "Nothing flagged yet. Run detection to score the latest reports."
                  : "No flags match these filters."}
              </td></tr>
            )}
            {rows.map((a) => (
              <ClickableRow key={a.id} incidentId={a.incident_id} className={a.reviewed ? "opacity-60" : ""}>
                <td className="table-td"><LevelBadge level={a.level} score={a.anomaly_score} /></td>
                <td className="table-td">
                  <span className="font-medium text-indigo-700">#{a.incident_id}</span>{" "}
                  <span className="capitalize">{a.incidents?.category}</span>
                  <span className="text-slate-500"> · {a.incidents?.location_name}</span>
                </td>
                <td className="table-td max-w-sm">{a.reason}</td>
                <td className="table-td">{a.incidents && formatDate(a.incidents.incident_date)}</td>
                <td className="table-td">{a.incidents && <StatusBadge status={a.incidents.status} />}</td>
                <td className="table-td">
                  <form action={setReviewed}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="reviewed" value={String(!a.reviewed)} />
                    <button className="text-xs text-indigo-600 hover:underline">{a.reviewed ? "Undo" : "Mark reviewed"}</button>
                  </form>
                </td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
