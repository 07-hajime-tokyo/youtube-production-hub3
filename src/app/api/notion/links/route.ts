import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getSupabasePublicConfig, isEmailAllowed, isLocalAuthBypassEnabled } from "@/lib/env";
import { createNotionHandoffLink } from "@/lib/notion";

const linkSchema = z.object({
  title: z.string().trim().min(1),
  href: z.string().url(),
  note: z.string().trim().optional(),
});

async function authorize() {
  if (isLocalAuthBypassEnabled()) return null;

  const { configured } = getSupabasePublicConfig();
  if (!configured) return null;
  const user = await getCurrentUser();
  if (!user) return "Authentication required.";
  if (!isEmailAllowed(user.email)) return "This email is not allowed for this workspace.";
  return null;
}

export async function POST(request: Request) {
  const authError = await authorize();
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const link = await createNotionHandoffLink(parsed.data);
    return NextResponse.json({ link });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Notion link create failed." },
      { status: 500 },
    );
  }
}
