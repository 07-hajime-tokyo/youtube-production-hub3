import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabasePublicConfig, isLocalAuthBypassEnabled } from "@/lib/env";
import { demoDashboardData, demoVideos } from "@/lib/mock-data";
import type {
  ChannelSummary,
  DashboardData,
  DashboardVideo,
  ProductionStatus,
  SyncRunSummary,
  WorkerJobSummary,
} from "@/lib/types";

type RawChannel = {
  id: string;
  drive_sheet_name: string;
  youtube_channel_name: string | null;
  genre: string | null;
  status: string;
  source_url: string | null;
};

type RawMetric = {
  metric_date: string;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  seven_day_average_growth: number | null;
};

type RawTranscript = {
  id: string;
  full_text?: string | null;
  summary?: string | null;
  asr_model?: string | null;
  language?: string | null;
  obsidian_path: string | null;
  github_path: string | null;
};

type RawVideo = {
  id: string;
  video_id: string;
  title: string;
  theme_summary: string | null;
  thumbnail_url: string | null;
  url: string;
  published_on: string | null;
  duration_text: string | null;
  like_count: number | null;
  comment_count: number | null;
  tags: string[] | null;
  production_status: ProductionStatus;
  assigned_to: string | null;
  due_on: string | null;
  notes: string | null;
  channels: RawChannel | null;
  transcripts: RawTranscript[] | RawTranscript | null;
  video_metrics_daily: RawMetric[] | null;
};

type RawSyncRun = {
  id: string;
  type: SyncRunSummary["type"];
  status: SyncRunSummary["status"];
  message: string | null;
  created_at: string;
};

type RawWorkerJob = {
  id: string;
  type: WorkerJobSummary["type"];
  status: WorkerJobSummary["status"];
  created_at: string;
  payload: Record<string, unknown>;
};

export type ChangeLogItem = {
  id: string;
  title: string;
  detail: string;
  at: string;
  actor: string;
};

function formatLogDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function getReadableSupabaseClient() {
  const { configured } = getSupabasePublicConfig();
  if (!configured) return null;
  return createSupabaseAdminClient() ?? (isLocalAuthBypassEnabled() ? null : await createSupabaseServerClient());
}

export type DashboardVideoFilters = {
  q?: string;
  channel?: string;
  transcript?: string;
};

const videoSelect =
  "id, video_id, title, theme_summary, thumbnail_url, url, published_on, duration_text, like_count, comment_count, tags, production_status, assigned_to, due_on, notes, channels(id, drive_sheet_name, youtube_channel_name, genre, status, source_url), transcripts(id, obsidian_path, github_path), video_metrics_daily(metric_date, view_count, like_count, comment_count, seven_day_average_growth)";

const videoSelectWithTranscript =
  "id, video_id, title, theme_summary, thumbnail_url, url, published_on, duration_text, like_count, comment_count, tags, production_status, assigned_to, due_on, notes, channels(id, drive_sheet_name, youtube_channel_name, genre, status, source_url), transcripts!inner(id, obsidian_path, github_path), video_metrics_daily(metric_date, view_count, like_count, comment_count, seven_day_average_growth)";

const videoDetailSelect =
  "id, video_id, title, theme_summary, thumbnail_url, url, published_on, duration_text, like_count, comment_count, tags, production_status, assigned_to, due_on, notes, channels(id, drive_sheet_name, youtube_channel_name, genre, status, source_url), transcripts(id, full_text, summary, asr_model, language, obsidian_path, github_path), video_metrics_daily(metric_date, view_count, like_count, comment_count, seven_day_average_growth)";

function firstTranscript(value: RawVideo["transcripts"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function videoIdFromJobPayload(payload: Record<string, unknown>) {
  if (typeof payload.videoId === "string" && payload.videoId) return payload.videoId;
  if (typeof payload.url !== "string") return null;
  return payload.url.match(/[?&]v=([^&]+)/)?.[1] ?? payload.url.split("/shorts/")[1]?.split(/[?&]/)[0] ?? null;
}

async function hasPendingTranscriptJob(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, videoId: string) {
  const { data } = await supabase
    .from("worker_jobs")
    .select("id")
    .eq("type", "transcribe")
    .in("status", ["queued", "running"])
    .or(`payload->>videoId.eq.${videoId},payload->>url.ilike.%${videoId}%`)
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

function mapVideo(row: RawVideo): DashboardVideo {
  const metrics = [...(row.video_metrics_daily ?? [])].sort((a, b) =>
    (b.metric_date ?? "").localeCompare(a.metric_date ?? ""),
  );
  const latest = metrics[0];
  const transcript = firstTranscript(row.transcripts);

  return {
    id: row.id,
    videoId: row.video_id,
    title: row.title,
    themeSummary: row.theme_summary,
    thumbnailUrl: row.thumbnail_url || `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`,
    url: row.url,
    channelId: row.channels?.id ?? null,
    channelName: row.channels?.youtube_channel_name || row.channels?.drive_sheet_name || "Unknown",
    publishedOn: row.published_on,
    durationText: row.duration_text,
    latestViews: latest?.view_count ?? 0,
    sevenDayAverageGrowth: Number(latest?.seven_day_average_growth ?? 0),
    likeCount: row.like_count ?? latest?.like_count ?? 0,
    commentCount: row.comment_count ?? latest?.comment_count ?? 0,
    tags: row.tags ?? [],
    productionStatus: row.production_status,
    assignedTo: row.assigned_to,
    dueOn: row.due_on,
    notes: row.notes,
    hasTranscript: Boolean(transcript),
    transcriptText: transcript?.full_text,
    transcriptSummary: transcript?.summary,
    transcriptModel: transcript?.asr_model,
    transcriptLanguage: transcript?.language,
    obsidianPath: transcript?.obsidian_path,
    githubPath: transcript?.github_path,
  };
}

export async function getDashboardData(filters: DashboardVideoFilters = {}): Promise<DashboardData> {
  const { configured } = getSupabasePublicConfig();
  if (!configured) return demoDashboardData;

  const supabase = await getReadableSupabaseClient();
  if (!supabase) return demoDashboardData;

  let videosQuery = supabase
    .from("videos")
    .select(filters.transcript === "done" ? videoSelectWithTranscript : videoSelect)
    .order("published_on", { ascending: false, nullsFirst: false })
    .limit(50);

  if (filters.channel) {
    videosQuery = videosQuery.eq("channel_id", filters.channel);
  }
  if (filters.transcript === "missing") {
    videosQuery = videosQuery.is("transcripts.id", null);
  }
  const q = filters.q?.trim();
  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&");
    videosQuery = videosQuery.or(`title.ilike.%${escaped}%,theme_summary.ilike.%${escaped}%`);
  }

  const [videosResult, channelsResult, syncRunsResult, workerJobsResult, pendingTranscriptJobsResult] = await Promise.all([
    videosQuery,
    supabase
      .from("channels")
      .select("id, drive_sheet_name, youtube_channel_name, genre, status, source_url")
      .order("drive_sheet_name"),
    supabase
      .from("sync_runs")
      .select("id, type, status, message, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("worker_jobs")
      .select("id, type, status, created_at, payload")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("worker_jobs")
      .select("id, type, status, created_at, payload")
      .eq("type", "transcribe")
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (videosResult.error) {
    return {
      ...demoDashboardData,
      setupWarnings: [`Supabase query failed: ${videosResult.error.message}`],
    };
  }

  const pendingTranscriptVideoIds = new Set(
    ((pendingTranscriptJobsResult.data ?? []) as unknown as RawWorkerJob[])
      .map((job) => videoIdFromJobPayload(job.payload))
      .filter((videoId): videoId is string => Boolean(videoId)),
  );
  const rawVideos = (videosResult.data ?? []) as unknown as RawVideo[];
  const videoDbIds = rawVideos.map((row) => row.id);
  const { data: transcriptRows } = videoDbIds.length
    ? await supabase.from("transcripts").select("video_id").in("video_id", videoDbIds)
    : { data: [] };
  const transcriptVideoDbIds = new Set((transcriptRows ?? []).map((row) => row.video_id as string));
  const videos = rawVideos.map((row) => {
    const video = mapVideo(row);
    const hasTranscript = video.hasTranscript || transcriptVideoDbIds.has(row.id);
    return {
      ...video,
      hasTranscript,
      hasTranscriptJob: !hasTranscript && pendingTranscriptVideoIds.has(video.videoId),
    };
  });
  const rawChannels = (channelsResult.data ?? []) as unknown as RawChannel[];

  const channels: ChannelSummary[] = rawChannels.map((channel) => ({
    id: channel.id,
    name: channel.youtube_channel_name || channel.drive_sheet_name,
    driveSheetName: channel.drive_sheet_name,
    genre: channel.genre,
    status: channel.status,
    sourceUrl: channel.source_url,
    videoCount: videos.filter((video) => video.channelId === channel.id).length,
  }));

  return {
    mode: "live",
    setupWarnings: [],
    channels,
    videos,
    syncRuns: ((syncRunsResult.data ?? []) as unknown as RawSyncRun[]).map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      message: row.message,
      createdAt: row.created_at,
    })),
    workerJobs: ((workerJobsResult.data ?? []) as unknown as RawWorkerJob[]).map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      createdAt: row.created_at,
      payload: row.payload,
    })),
  };
}

export async function getVideoDetail(idOrVideoId: string) {
  const { configured } = getSupabasePublicConfig();
  if (!configured) {
    return demoVideos.find((video) => video.id === idOrVideoId || video.videoId === idOrVideoId) ?? null;
  }

  const supabase = await getReadableSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("videos")
    .select(videoDetailSelect)
    .or(`id.eq.${idOrVideoId},video_id.eq.${idOrVideoId}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const video = mapVideo(data as unknown as RawVideo);
  return {
    ...video,
    hasTranscriptJob: !video.hasTranscript && await hasPendingTranscriptJob(supabase, video.videoId),
  };
}

export async function getYouTubeChangeLogs() {
  const supabase = await getReadableSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("change_logs")
    .select("id, title, detail, actor_email, created_at")
    .eq("app_key", "youtube")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data) return [];

  return data.map((row): ChangeLogItem => ({
    id: row.id,
    title: row.title,
    detail: row.detail ?? "",
    at: formatLogDate(row.created_at),
    actor: row.actor_email ?? "system",
  }));
}

export async function createYouTubeChangeLog(input: {
  action: string;
  targetType: string;
  targetId?: string;
  title: string;
  detail?: string;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from("change_logs").insert({
    app_key: "youtube",
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    title: input.title,
    detail: input.detail ?? null,
    actor_email: input.actorEmail ?? "system",
    metadata: input.metadata ?? {},
  });
}
