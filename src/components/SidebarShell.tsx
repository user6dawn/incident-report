"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import IncidentModal from "./IncidentModal";
import SignOutButton from "./SignOutButton";

// Simple inline icons (no extra library needed).
const ICONS: Record<string, React.ReactNode> = {
  overview: <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
  incidents: <path d="M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h10v2H4v-2zm0 5h10v2H4v-2z" />,
  flagged: <path d="M5 21V4h9l.4 2H20v10h-7l-.4-2H7v7H5z" />,
  students: <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z" />,
  report: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />,
};

export interface NavLink {
  href: string;
  label: string;
  icon: keyof typeof ICONS | string;
  exact?: boolean;
}

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** Soft white sidebar on desktop, collapsible top bar on phones. Used by students and admins. */
export default function SidebarShell({
  links, home, userName, role, children,
}: { links: NavLink[]; home: string; userName: string; role: "student" | "admin"; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex flex-col gap-1">
      {links.map((l) => {
        const active = isActive(l.href, l.exact);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <Icon name={l.icon} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  const initials = userName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  const account = (
    <div className="border-t border-slate-100 pt-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
          {initials || "U"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800" title={userName}>{userName}</p>
          <p className="text-xs capitalize text-slate-400">{role}</p>
        </div>
      </div>
      <SignOutButton />
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-slate-100 bg-white p-5 shadow-[4px_0_24px_-12px_rgba(15,23,42,0.08)] lg:flex">
        <div>
          <Link href={home} className="mb-8 flex items-center gap-2 px-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">CI</span>
            <span className="font-semibold text-slate-800">Campus Incidents</span>
          </Link>
          {nav}
        </div>
        {account}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-[1000] border-b border-slate-100 bg-white/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href={home} className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold text-white">CI</span>
            <span className="font-semibold text-slate-800">Campus Incidents</span>
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
              {open
                ? <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z" />
                : <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />}
            </svg>
          </button>
        </div>
        {open && <div className="space-y-4 px-4 pb-4">{nav}{account}</div>}
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Opens when the URL has ?incident=<id> */}
      <Suspense fallback={null}>
        <IncidentModal role={role} />
      </Suspense>
    </div>
  );
}
