import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig, isEmailAllowed, isLocalAuthBypassEnabled } from "@/lib/env";

export async function getCurrentUser() {
  if (isLocalAuthBypassEnabled()) {
    return {
      id: "local-dev-user",
      email: "local-dev@example.com",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function requireAppUser() {
  if (isLocalAuthBypassEnabled()) return getCurrentUser();

  const { configured } = getSupabasePublicConfig();
  if (!configured) return null;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isEmailAllowed(user.email)) redirect("/login?error=not_allowed");
  return user;
}

export async function requireRouteUser() {
  if (isLocalAuthBypassEnabled()) {
    return { error: null, supabase: createSupabaseAdminClient(), user: await getCurrentUser() };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "Supabase is not configured.", supabase: null, user: null as null };
  }

  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) {
    return { error: "Authentication required.", supabase, user: null as null };
  }
  if (!isEmailAllowed(user.email)) {
    return { error: "This email is not allowed for this workspace.", supabase, user: null as null };
  }
  return { error: null, supabase, user };
}
