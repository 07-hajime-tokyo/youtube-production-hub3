import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBaseUrl, isEmailAllowed } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = getBaseUrl();

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(`${origin}/login?error=supabase`);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=oauth`);

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!isEmailAllowed(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  if (user?.email) {
    const adminSupabase = createSupabaseAdminClient();
    await (adminSupabase ?? supabase).from("team_members").upsert(
      {
        email: user.email.toLowerCase(),
        display_name: user.user_metadata?.full_name ?? user.email,
        active: true,
      },
      { onConflict: "email" },
    );
  }

  return NextResponse.redirect(`${origin}/`);
}
