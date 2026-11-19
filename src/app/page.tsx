import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("incident_profiles").select("role").eq("id", user.id).single();
    redirect(profile?.role === "admin" ? "/admin" : "/student");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">Bingham University</p>
      <h1 className="text-3xl font-bold sm:text-4xl">Campus Incident Management System</h1>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="btn-primary">Create account</Link>
        <Link href="/login" className="btn-secondary">Sign in</Link>
      </div>
    </main>
  );
}
