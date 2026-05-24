"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRouteUser } from "@/lib/auth";
import { PRODUCTION_STATUSES } from "@/lib/types";

const updateStatusSchema = z.object({
  videoId: z.string().min(1),
  status: z.enum(PRODUCTION_STATUSES),
});

export async function updateProductionStatus(formData: FormData) {
  const parsed = updateStatusSchema.safeParse({
    videoId: formData.get("videoId"),
    status: formData.get("status"),
  });

  if (!parsed.success) return;

  const { supabase, user } = await requireRouteUser();
  if (!supabase || !user) return;

  await supabase
    .from("videos")
    .update({
      production_status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.videoId);

  revalidatePath("/");
  revalidatePath(`/videos/${parsed.data.videoId}`);
}

export async function signOut() {
  const { supabase } = await requireRouteUser();
  await supabase?.auth.signOut();
  redirect("/login");
}

