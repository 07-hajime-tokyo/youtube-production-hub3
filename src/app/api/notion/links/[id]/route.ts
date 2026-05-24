import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabasePublicConfig, isEmailAllowed, isLocalAuthBypassEnabled } from "@/lib/env";
import { deleteNotionHandoffLink } from "@/lib/notion";

async function authorize() {
  if (isLocalAuthBypassEnabled()) return null;

  const { configured } = getSupabasePublicConfig();
  if (!configured) return null;
  const user = await getCurrentUser();
  if (!user) return "Authentication required.";
  if (!isEmailAllowed(user.email)) return "This email is not allowed for this workspace.";
  return null;
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await authorize();
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const { id } = await params;
    await deleteNotionHandoffLink(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Notion link delete failed." },
      { status: 500 },
    );
  }
}
