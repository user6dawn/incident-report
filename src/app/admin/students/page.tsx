import { formatDate } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

type Row = Profile & { incidents: { id: number; status: string }[] };

export default async function StudentsPage() {
  const { supabase } = await requireProfile("admin");

  // Anonymous reports have no reporter_id, so they are never counted against a student.
  const { data } = await supabase
    .from("incident_profiles")
    .select("*, incidents(id, status)")
    .eq("role", "student")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Students</h1>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px]">
          <thead className="table-head">
            <tr>
              <th className="table-th">Name</th>
              <th className="table-th">Matric no.</th>
              <th className="table-th">Joined</th>
              <th className="table-th">Reports</th>
              <th className="table-th">Resolved</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="table-td py-8 text-center text-slate-500">No students registered yet.</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="table-td font-medium">{s.full_name || "—"}</td>
                <td className="table-td">{s.matric_no ?? "—"}</td>
                <td className="table-td">{formatDate(s.created_at)}</td>
                <td className="table-td">{s.incidents.length}</td>
                <td className="table-td">{s.incidents.filter((i) => i.status === "resolved").length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
