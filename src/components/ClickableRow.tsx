"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Table row that opens the incident modal (?incident=<id>) when clicked or when Enter is pressed. */
export default function ClickableRow({
  incidentId, className = "", children,
}: { incidentId: number; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function open() {
    const next = new URLSearchParams(params.toString());
    next.set("incident", String(incidentId));
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <tr
      tabIndex={0}
      role="button"
      aria-label={`Open incident #${incidentId}`}
      onClick={(e) => {
        // Let real buttons, links and forms inside the row do their own job.
        if ((e.target as HTMLElement).closest("a,button,input,select,textarea,form")) return;
        open();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) open();
      }}
      className={`cursor-pointer transition hover:bg-indigo-50/40 focus:bg-indigo-50/60 focus:outline-none ${className}`}
    >
      {children}
    </tr>
  );
}

/** Same as ClickableRow but for a list item or any block element. */
export function IncidentLink({
  incidentId, className = "", children,
}: { incidentId: number; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <button
      type="button"
      onClick={() => {
        const next = new URLSearchParams(params.toString());
        next.set("incident", String(incidentId));
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
      className={className}
    >
      {children}
    </button>
  );
}
