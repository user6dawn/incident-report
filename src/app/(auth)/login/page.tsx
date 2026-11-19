"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("incident_profiles").select("role").eq("id", data.user.id).single();
    router.replace(profile?.role === "admin" ? "/admin" : "/student");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required className="input" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="btn-primary w-full">{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        No account? <Link href="/register" className="text-indigo-600 hover:underline">Register</Link>
      </p>
    </>
  );
}
