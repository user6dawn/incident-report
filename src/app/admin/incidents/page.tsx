import { LevelBadge, StatusBadge, formatDate } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { CATEGORIES, STATUSES } from "@/lib/constants";
import type { Anomaly, Incident } from "@/lib/types";
import ClickableRow from "@/components/ClickableRow";

type Row = Incident & {
  profiles: { full_name: string } | null;
  anomalies: Pick<Anomaly, "anomaly_score" | "level"> | Pick<Anomaly, "anomaly_score" | "level">[] | null;
};

export default async function IncidentsPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; category?: string }> }) {
  const { status, category } = await searchParams;
  const { supabase } = await requireProfile("admin");

  let query = supabase
    .from("incidents")
    .select("*, profiles:incident_profiles(full_name), anomalies(anomaly_score, level)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);
  const { data } = await query;
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Incidents</h1>

      <form className="flex flex-wrap gap-3">
        <select name="status" defaultValue={status ?? ""} className="input w-auto capitalize">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="category" defaultValue={category ?? ""} className="input w-auto capitalize">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[760px]">
          <thead className="table-head">
            <tr>
              <th className="table-th">#</th>
              <th className="table-th">Category</th>
              <th className="table-th">Location</th>
              <th className="table-th">Reporter</th>
              <th className="table-th">Date</th>
              <th className="table-th">Flag</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="table-td py-8 text-center text-slate-500">No incidents match.</td></tr>
            )}
            {rows.map((i) => {
              const a = Array.isArray(i.anomalies) ? i.anomalies[0] : i.anomalies;
              return (
                <ClickableRow key={i.id} incidentId={i.id}>
                  <td className="table-td">
                    <span className="font-medium text-indigo-700">#{i.id}</span>
                  </td>
                  <td className="table-td capitalize">{i.category}</td>
                  <td className="table-td">{i.location_name}</td>
                  <td className="table-td">
                    {i.is_anonymous ? <span className="italic text-slate-400">Anonymous</span> : i.profiles?.full_name ?? "—"}
                  </td>
                  <td className="table-td">{formatDate(i.incident_date)}</td>
                  <td className="table-td">{a ? <LevelBadge level={a.level} score={a.anomaly_score} /> : ""}</td>
                  <td className="table-td"><StatusBadge status={i.status} /></td>
                </ClickableRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
