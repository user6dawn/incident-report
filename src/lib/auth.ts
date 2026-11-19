import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Returns the signed-in user's profile, or redirects to /login. */
export async function requireProfile(role?: "student" | "admin") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("incident_profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");

  if (role && profile.role !== role) {
    redirect(profile.role === "admin" ? "/admin" : "/student");
  }
  return { supabase, user, profile };
}
