"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          app: "incident",
          full_name: String(form.get("full_name")),
          matric_no: String(form.get("matric_no")),
        },
      },
    });
    if (error) {
      setLoading(false);
      return setError(error.message);
    }

    // Accounts are confirmed automatically, so sign in straight away if
    // sign-up did not already return a session.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setLoading(false);
        return setMessage("Account created. Please sign in.");
      }
    }

    // "/" sends admins to /admin and students to /student.
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Create a student account</h1>
      {message ? (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="full_name">Full name</label>
            <input id="full_name" name="full_name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="matric_no">Matric number</label>
            <input id="matric_no" name="matric_no" required placeholder="BHU/22/04/09/0011" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength={8} required className="input" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="btn-primary w-full">{loading ? "Creating…" : "Create account"}</button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered? <Link href="/login" className="text-indigo-600 hover:underline">Sign in</Link>
      </p>
    </>
  );
}
