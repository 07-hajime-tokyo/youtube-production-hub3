import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRouteUser } from "@/lib/auth";

const schema = z.object({
  videoId: z.string().min(1).optional(),
  push: z.boolean().optional(),
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
      type: "export_github",
      payload: parsed.data,
      created_by: user.email,
    })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ jobId: data.id, status: "queued" });
}

