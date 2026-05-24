import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceConfig } from "@/lib/env";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey, configured } = getSupabaseServiceConfig();
  if (!configured || !url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

