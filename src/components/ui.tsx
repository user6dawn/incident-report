import { STATUS_STYLES } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] ?? ""}`}>
      {status}
    </span>
  );
}

export function LevelBadge({ level, score }: { level: "medium" | "high"; score: number }) {
  const style = level === "high" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
      {level === "high" ? "High" : "Medium"} · {Math.round(score)}
    </span>
  );
}

export function StatCard({ label, value, tone = "slate" }: { label: string; value: number | string; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "text-slate-900", blue: "text-blue-700", amber: "text-amber-700",
    green: "text-green-700", red: "text-red-700",
  };
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}
