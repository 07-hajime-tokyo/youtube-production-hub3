import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getSupabasePublicConfig, isEmailAllowed, isLocalAuthBypassEnabled } from "@/lib/env";
import { deleteNotionTask, updateNotionTask } from "@/lib/notion";

const taskSchema = z.object({
  title: z.string().trim().min(1),
  status: z.string().trim().optional(),
  stage: z.string().trim().optional(),
  date: z.string().trim().optional(),
  due: z.string().trim().optional(),
  end: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  minutes: z.number().int().min(0).max(1440).optional(),
  priority: z.string().trim().optional(),
  display: z.string().trim().optional(),
  pinned: z.boolean().optional(),
  href: z.string().url().optional().or(z.literal("")),
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await authorize();
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const { id } = await params;
    const task = await updateNotionTask(id, parsed.data);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Notion task update failed." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await authorize();
  if (authError) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const { id } = await params;
    await deleteNotionTask(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Notion task delete failed." },
      { status: 500 },
    );
  }
}
