import Link from "next/link";
import MapView from "@/components/MapView";
import { StatCard, StatusBadge, formatDate } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { CATEGORIES } from "@/lib/constants";
import type { Incident } from "@/lib/types";
import { IncidentLink } from "@/components/ClickableRow";

export default async function AdminOverview() {
  const { supabase } = await requireProfile("admin");

  const [{ data }, { count: flagged }] = await Promise.all([
    supabase.from("incidents").select("*").order("created_at", { ascending: false }),
    supabase.from("anomalies").select("id", { count: "exact", head: true }).eq("reviewed", false),
  ]);
  const incidents = (data ?? []) as Incident[];

  const count = (s: string) => incidents.filter((i) => i.status === s).length;
  const byCategory = CATEGORIES.map((c) => ({ c, n: incidents.filter((i) => i.category === c).length }));
  const maxCat = Math.max(1, ...byCategory.map((x) => x.n));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total reports" value={incidents.length} />
        <StatCard label="New" value={count("new")} tone="blue" />
        <StatCard label="Unresolved" value={count("unresolved")} tone="amber" />
        <StatCard label="Resolved" value={count("resolved")} tone="green" />
        <Link href="/admin/anomalies"><StatCard label="Flagged, to review" value={flagged ?? 0} tone="red" /></Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Incident locations</h2>
          <MapView
            points={incidents.map((i) => ({
              id: i.id, lat: i.latitude, lng: i.longitude,
              label: `${i.category} · ${i.location_name}`, status: i.status,
            }))}
          />
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Reports by category</h2>
          <ul className="space-y-2">
            {byCategory.map(({ c, n }) => (
              <li key={c}>
                <div className="flex justify-between text-sm capitalize"><span>{c}</span><span>{n}</span></div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-indigo-300" style={{ width: `${(n / maxCat) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Latest reports</h2>
          <Link href="/admin/incidents" className="text-sm text-indigo-600 hover:underline">View all</Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {incidents.slice(0, 6).map((i) => (
            <li key={i.id}>
              <IncidentLink incidentId={i.id} className="flex w-full flex-wrap items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-indigo-50/40">
              <span className="font-medium text-indigo-700">#{i.id}</span>
              <span className="capitalize">{i.category}</span>
              <span className="text-slate-500">{i.location_name}</span>
              <span className="text-slate-400">{formatDate(i.created_at)}</span>
              <span className="ml-auto"><StatusBadge status={i.status} /></span>
              </IncidentLink>
            </li>
          ))}
          {incidents.length === 0 && <li className="py-4 text-sm text-slate-500">No reports yet.</li>}
        </ul>
      </div>
    </div>
  );
}
