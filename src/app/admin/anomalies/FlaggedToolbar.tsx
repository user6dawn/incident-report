"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CATEGORIES, FLAGGED_SORTS, STATUSES } from "@/lib/constants";

const FILTER_KEYS = ["q", "level", "show", "status", "category", "sort"] as const;

/** Search box, filters and sort for the flagged page. Everything lives in the URL. */
export default function FlaggedToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("incident"); // close any open incident pop-up when the list changes
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Search as you type, after a short pause.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q: q.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = FILTER_KEYS.some((k) => k !== "sort" && params.get(k));

  const select = (key: string, label: string, options: [string, string][], allLabel: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <select
        value={params.get(key) ?? ""}
        onChange={(e) => update({ [key]: e.target.value })}
        className="input w-full py-1.5 capitalize sm:w-auto"
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );

  return (
    <div className={`card space-y-3 transition ${pending ? "opacity-70" : ""}`}>
      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-slate-400" aria-hidden="true">
          <path d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by incident #, category, location or reason…"
          aria-label="Search flagged incidents"
          className="input pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        {select("show", "Review", [["", "To review"], ["reviewed", "Reviewed"], ["all", "All"]], "")}
        {select("level", "Level", [["high", "High"], ["medium", "Medium"]], "All levels")}
        {select("status", "Status", STATUSES.map((s) => [s, s]), "All statuses")}
        {select("category", "Category", CATEGORIES.map((c) => [c, c]), "All categories")}
        {select("sort", "Sort by", Object.entries(FLAGGED_SORTS), "")}
        {active && (
          <button
            type="button"
            onClick={() => { setQ(""); update(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""]))); }}
            className="btn-secondary col-span-2 py-1.5 sm:col-span-1"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
