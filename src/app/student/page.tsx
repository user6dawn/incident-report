import Link from "next/link";
import MapView from "@/components/MapView";
import { StatCard, StatusBadge, formatDate } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import type { Incident } from "@/lib/types";
import ClickableRow from "@/components/ClickableRow";

export default async function StudentDashboard({
  searchParams,
}: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;
  const { supabase, profile } = await requireProfile("student");

  // RLS only returns this student's reports, including their anonymous ones.
  const { data } = await supabase
    .from("incidents").select("*").order("created_at", { ascending: false });
  const incidents = (data ?? []) as Incident[];

  const resolved = incidents.filter((i) => i.status === "resolved").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile.full_name.split(" ")[0] || "student"}</h1>
        </div>
        <Link href="/student/report" className="btn-primary">+ Report an incident</Link>
      </div>

      {submitted && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Report #{submitted} submitted. You can follow its status below.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total reports" value={incidents.length} />
        <StatCard label="Resolved" value={resolved} tone="green" />
        <StatCard label="Unresolved" value={incidents.length - resolved} tone="amber" />
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Where your incidents happened</h2>
        <MapView
          points={incidents.map((i) => ({
            id: i.id, lat: i.latitude, lng: i.longitude,
            label: `${i.category} · ${i.location_name}`, status: i.status,
          }))}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px]">
          <thead className="table-head">
            <tr>
              <th className="table-th">#</th>
              <th className="table-th">Category</th>
              <th className="table-th">Location</th>
              <th className="table-th">Date</th>
              <th className="table-th">Anonymous</th>
              <th className="table-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 && (
              <tr><td colSpan={6} className="table-td py-8 text-center text-slate-500">No reports yet.</td></tr>
            )}
            {incidents.map((i) => (
              <ClickableRow key={i.id} incidentId={i.id}>
                <td className="table-td text-slate-500">{i.id}</td>
                <td className="table-td capitalize">{i.category}</td>
                <td className="table-td">{i.location_name}</td>
                <td className="table-td">{formatDate(i.incident_date)}</td>
                <td className="table-td">{i.is_anonymous ? "Yes" : "No"}</td>
                <td className="table-td"><StatusBadge status={i.status} /></td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
