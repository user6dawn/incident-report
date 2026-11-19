import SidebarShell, { type NavLink } from "@/components/SidebarShell";
import { requireProfile } from "@/lib/auth";

const LINKS: NavLink[] = [
  { href: "/admin", label: "Overview", icon: "overview", exact: true },
  { href: "/admin/incidents", label: "Incidents", icon: "incidents" },
  { href: "/admin/anomalies", label: "Flagged", icon: "flagged" },
  { href: "/admin/students", label: "Students", icon: "students" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireProfile("admin");
  return (
    <SidebarShell links={LINKS} home="/admin" userName={user.email ?? profile.full_name} role="admin">
      {children}
    </SidebarShell>
  );
}
