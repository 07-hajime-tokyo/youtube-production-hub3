export const DEFAULT_DRIVE_FOLDER_ID = "1WXq2-aIGa8eIcVouwC6CY3yozw6l0y5s";
export const DEFAULT_OBSIDIAN_VAULT_DIR = "/Users/ha_m/Desktop/Obsidian Vault";

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    url,
    anonKey,
    configured: Boolean(url && anonKey),
  };
}

export function getSupabaseServiceConfig() {
  const { url } = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    url,
    serviceRoleKey,
    configured: Boolean(url && serviceRoleKey),
  };
}

export function getAllowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email?: string | null) {
  const allowed = getAllowedEmails();
  if (!email) return false;
  if (allowed.length === 0) return true;
  return allowed.includes(email.toLowerCase());
}

export function isLocalAuthBypassEnabled() {
  return process.env.LOCAL_AUTH_BYPASS === "1";
}

export function getBaseUrl() {
  const vercelUrl = process.env.VERCEL_URL;
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (vercelUrl ? `https://${vercelUrl}` : undefined) ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ||
    "http://localhost:3000"
  );
}

export function getNotionConfig() {
  const token = process.env.NOTION_TOKEN;
  const tasksDatabaseId = process.env.NOTION_SCHEDULE_DATABASE_ID ?? process.env.NOTION_TASKS_DATABASE_ID;
  const linksDatabaseId = process.env.NOTION_LINKS_DATABASE_ID;
  return {
    token,
    tasksDatabaseId,
    linksDatabaseId,
    configured: Boolean(token && tasksDatabaseId && linksDatabaseId),
  };
}
