import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRouteUser } from "@/lib/auth";
import { triggerTranscribeWorkflow } from "@/lib/github-actions";
import { createYouTubeChangeLog } from "@/lib/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z
  .object({
    url: z.string().url().optional(),
    videoId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
  })
  .refine((value) => value.url || value.videoId, {
    message: "url or videoId is required",
  });

export async function POST(request: Request) {
  const { error, supabase, user } = await requireRouteUser();
  if (error || !supabase || !user) {
    return NextResponse.json({ error }, { status: error === "Supabase is not configured." ? 503 : 401 });
  }
  const writeSupabase = createSupabaseAdminClient() ?? supabase;

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.videoId) {
    const { data: existingVideo, error: lookupError } = await writeSupabase
      .from("videos")
      .select("id, transcripts(id)")
      .eq("video_id", parsed.data.videoId)
      .maybeSingle();

    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
    const transcripts = existingVideo?.transcripts;
    const hasTranscript = Array.isArray(transcripts) ? transcripts.length > 0 : Boolean(transcripts);
    if (hasTranscript) return NextResponse.json({ status: "already_done" });
  }

  const { data, error: insertError } = await writeSupabase
    .from("worker_jobs")
    .insert({
      type: "transcribe",
      payload: parsed.data,
      created_by: user.email,
    })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  const workflow = await triggerTranscribeWorkflow().catch((error: unknown) => ({
    status: "failed" as const,
    reason: error instanceof Error ? error.message : String(error),
  }));

  await createYouTubeChangeLog({
    action: "enqueue",
    targetType: "worker_job",
    targetId: data.id,
    title: "文字起こしを投入",
    detail: parsed.data.videoId ?? parsed.data.url ?? "",
    actorEmail: user.email,
    metadata: { ...parsed.data, workflow },
  });
  return NextResponse.json({ jobId: data.id, status: "queued", workflow });
}
