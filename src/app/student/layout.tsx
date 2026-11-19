import SidebarShell, { type NavLink } from "@/components/SidebarShell";
import { requireProfile } from "@/lib/auth";

const LINKS: NavLink[] = [
  { href: "/student", label: "Dashboard", icon: "overview", exact: true },
  { href: "/student/report", label: "Report incident", icon: "report" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireProfile("student");
  return (
    <SidebarShell links={LINKS} home="/student" userName={profile.full_name || user.email || "Student"} role="student">
      {children}
    </SidebarShell>
  );
}
