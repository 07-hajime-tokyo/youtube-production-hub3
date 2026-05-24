import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRouteUser } from "@/lib/auth";
import { DEFAULT_DRIVE_FOLDER_ID } from "@/lib/env";

const schema = z.object({
  folderId: z.string().min(1).default(DEFAULT_DRIVE_FOLDER_ID),
});

export async function POST(request: Request) {
  const { error, supabase, user } = await requireRouteUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error }, { status: error === "Supabase is not configured." ? 503 : 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error: insertError } = await supabase
    .from("worker_jobs")
    .insert({
      type: "sync_drive",
      payload: { folderId: parsed.data.folderId },
      created_by: user.email,
    })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ jobId: data.id, status: "queued" });
}

