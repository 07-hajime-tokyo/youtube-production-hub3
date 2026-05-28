import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { google } from "googleapis";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildTranscriptMarkdown, githubTranscriptPath, obsidianTranscriptFileName } from "../src/lib/markdown";
import type { TranscriptExport, TranscriptSegment } from "../src/lib/types";

dotenv.config({ path: ".env.local", override: false, quiet: true });
dotenv.config({ path: ".env", override: false, quiet: true });

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "1WXq2-aIGa8eIcVouwC6CY3yozw6l0y5s";
const OBSIDIAN_VAULT_DIR = process.env.OBSIDIAN_VAULT_DIR || "/Users/ha_m/Desktop/Obsidian Vault";
const GITHUB_TRANSCRIPTS_DIR = process.env.GITHUB_TRANSCRIPTS_DIR || "transcripts";
const TRANSCRIPT_MARKDOWN_EXPORT = process.env.TRANSCRIPT_MARKDOWN_EXPORT === "1";
const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || "small";
const YTDLP_BIN = process.env.YTDLP_BIN || "/opt/homebrew/bin/yt-dlp";
const YTDLP_COOKIES_FROM_BROWSER = process.env.YTDLP_COOKIES_FROM_BROWSER || "";
const YTDLP_COOKIES_PATH = process.env.YTDLP_COOKIES_PATH || "";
const PYTHON_BIN = process.env.PYTHON_BIN || "/usr/bin/python3";
const WORKER_POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 5000);
const WORKER_ID = process.env.WORKER_ID || "local-worker";

type SheetRow = string[];
type DriveFile = {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  webViewLink?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
};

type WorkerJob = {
  id: string;
  type: "sync_drive" | "transcribe" | "export_github";
  payload: Record<string, unknown>;
};

type YtDlpMetadata = {
  id: string;
  title: string;
  uploader?: string;
  webpage_url?: string;
  upload_date?: string;
  duration?: number;
  description?: string;
  tags?: string[];
};

type TranscribePayload = {
  language: string;
  language_probability: number;
  segments: Array<{ index: number; start: number; end: number; text: string }>;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getSupabase() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function numberFrom(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function durationSeconds(value?: string | null) {
  if (!value) return null;
  const text = value.trim();
  const h = text.match(/(\d+)\s*時間/);
  const m = text.match(/(\d+)\s*分/);
  const s = text.match(/(\d+)\s*秒/);
  if (h || m || s) {
    return Number(h?.[1] ?? 0) * 3600 + Number(m?.[1] ?? 0) * 60 + Number(s?.[1] ?? 0);
  }
  const parts = text.split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

function uploadDateToIso(value?: string | null) {
  if (!value) return null;
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function splitTags(value?: string | null) {
  if (!value) return [];
  return value
    .split(/[,\u3001]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function videoUrlFrom(input: { url?: string; videoId?: string }) {
  if (input.url) return input.url;
  if (input.videoId) return `https://www.youtube.com/watch?v=${input.videoId}`;
  throw new Error("url or videoId is required");
}

function run(command: string, args: string[], options?: { cwd?: string }) {
  return execFileSync(command, args, {
    cwd: options?.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function ytDlpCookieArgs() {
  if (YTDLP_COOKIES_PATH) return ["--cookies", YTDLP_COOKIES_PATH];
  if (YTDLP_COOKIES_FROM_BROWSER) return ["--cookies-from-browser", YTDLP_COOKIES_FROM_BROWSER];
  return [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getGoogleAuth() {
  const scopes = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ];

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) as {
      client_email: string;
      private_key: string;
    };
    return new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes,
    });
  }

  return new google.auth.GoogleAuth({ scopes });
}

async function recordRun<T>(
  supabase: SupabaseClient,
  type: "drive" | "transcribe" | "github_export",
  fn: (runId: string | null) => Promise<T>,
) {
  const { data } = await supabase
    .from("sync_runs")
    .insert({ type, status: "running", started_at: new Date().toISOString() })
    .select("id")
    .maybeSingle();
  const runId = data?.id ?? null;

  try {
    const result = await fn(runId);
    if (runId) {
      await supabase
        .from("sync_runs")
        .update({ status: "success", finished_at: new Date().toISOString() })
        .eq("id", runId);
    }
    return result;
  } catch (error) {
    if (runId) {
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    throw error;
  }
}

async function upsertAsset(supabase: SupabaseClient, file: DriveFile) {
  if (!file.id || !file.name) return;
  const type = file.mimeType === "application/pdf" ? "drive_pdf" : file.mimeType?.startsWith("video/") ? "drive_video" : "other";
  await supabase.from("assets").upsert(
    {
      type,
      title: file.name,
      url: file.webViewLink,
      drive_file_id: file.id,
      mime_type: file.mimeType,
      metadata: {
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      },
    },
    { onConflict: "drive_file_id" },
  );
}

async function syncSpreadsheet(supabase: SupabaseClient, file: DriveFile, sheetsApi: ReturnType<typeof google.sheets>) {
  if (!file.id || !file.name) return { videos: 0 };

  const { data: channel, error } = await supabase
    .from("channels")
    .upsert(
      {
        drive_file_id: file.id,
        drive_sheet_name: file.name,
        youtube_channel_name: file.name,
        source_url: file.webViewLink,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "drive_file_id" },
    )
    .select("id")
    .single();

  if (error || !channel?.id) throw new Error(error?.message ?? `failed to upsert channel ${file.name}`);
  const channelId = channel.id;
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: file.id,
    range: "Videos!A1:Z5000",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = (response.data.values ?? []) as SheetRow[];
  const headers = values[0] ?? [];
  const dateRow = values[1] ?? [];
  const indexOf = (label: string) => headers.findIndex((header) => header === label);

  const indexes = {
    published: indexOf("公開日"),
    title: indexOf("動画タイトル"),
    summary: indexOf("テーマ要約(AI)"),
    thumbnail: indexOf("サムネイル画像"),
    url: indexOf("URL"),
    growth: indexOf("1日平均増加(7日間)"),
    d0: indexOf("D0(最新再生数)"),
    duration: indexOf("動画時間"),
    likes: indexOf("高評価数"),
    comments: indexOf("コメント数"),
    description: indexOf("説明"),
    tags: indexOf("タグ"),
    videoId: indexOf("動画ID"),
  };

  const d0Date = uploadDateToIso(dateRow[indexes.d0]) ?? new Date().toISOString().slice(0, 10);
  const pendingByVideoId = new Map<
    string,
    {
      video: Record<string, unknown>;
      metric: {
        metric_date: string;
        view_count: number | null;
        like_count: number | null;
        comment_count: number | null;
        seven_day_average_growth: number | null;
      };
    }
  >();

  for (const row of values.slice(2)) {
    const videoId = row[indexes.videoId] || row[indexes.url]?.match(/[?&]v=([^&]+)/)?.[1] || row[indexes.url]?.split("/shorts/")[1];
    const title = row[indexes.title];
    const url = row[indexes.url];
    if (!videoId || !title || !url) continue;

    pendingByVideoId.set(videoId, {
      video: {
        video_id: videoId,
        channel_id: channelId,
        title,
        theme_summary: row[indexes.summary] || null,
        thumbnail_url: row[indexes.thumbnail] || null,
        url,
        published_on: uploadDateToIso(row[indexes.published]) ?? row[indexes.published] ?? null,
        duration_text: row[indexes.duration] || null,
        duration_seconds: durationSeconds(row[indexes.duration]),
        like_count: numberFrom(row[indexes.likes]),
        comment_count: numberFrom(row[indexes.comments]),
        description: row[indexes.description] || null,
        tags: splitTags(row[indexes.tags]),
        drive_source_file_id: file.id,
      },
      metric: {
        metric_date: d0Date,
        view_count: numberFrom(row[indexes.d0]),
        like_count: numberFrom(row[indexes.likes]),
        comment_count: numberFrom(row[indexes.comments]),
        seven_day_average_growth: numberFrom(row[indexes.growth]),
      },
    });
  }

  const pending = [...pendingByVideoId.values()];
  const videoIdToDbId = new Map<string, string>();

  for (const batch of chunk(pending, 500)) {
    const { data, error } = await supabase
      .from("videos")
      .upsert(
        batch.map((item) => item.video),
        { onConflict: "video_id" },
      )
      .select("id,video_id");
    if (error) throw new Error(error.message);
    for (const video of data ?? []) {
      videoIdToDbId.set(video.video_id, video.id);
    }
  }

  const metrics = pending
    .map((item) => {
      const dbVideoId = videoIdToDbId.get(String(item.video.video_id));
      if (!dbVideoId) return null;
      return {
        video_id: dbVideoId,
        ...item.metric,
      };
    })
    .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

  for (const batch of chunk(metrics, 500)) {
    const { error } = await supabase.from("video_metrics_daily").upsert(batch, { onConflict: "video_id,metric_date" });
    if (error) throw new Error(error.message);
  }

  return { videos: pending.length };
}

async function syncDrive(folderId = DRIVE_FOLDER_ID) {
  const supabase = getSupabase();
  await recordRun(supabase, "drive", async () => {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const sheetsApi = google.sheets({ version: "v4", auth });
    const selectedSpreadsheetIds = (process.env.GOOGLE_DRIVE_SPREADSHEET_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const files: DriveFile[] = [];
    let pageToken: string | undefined;

    if (selectedSpreadsheetIds.length) {
      for (const fileId of selectedSpreadsheetIds) {
        const response = await drive.files.get({
          fileId,
          fields: "id,name,mimeType,webViewLink,createdTime,modifiedTime",
          supportsAllDrives: true,
        });
        files.push(response.data as DriveFile);
      }
    } else {
      do {
        const response = await drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields: "nextPageToken,files(id,name,mimeType,webViewLink,createdTime,modifiedTime)",
          pageSize: 100,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        files.push(...((response.data.files ?? []) as DriveFile[]));
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);
    }

    let videoCount = 0;
    for (const file of files) {
      if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
        console.log(`Syncing spreadsheet: ${file.name ?? file.id}`);
        const result = await syncSpreadsheet(supabase, file, sheetsApi);
        videoCount += result.videos;
        console.log(`Synced spreadsheet: ${file.name ?? file.id} (${result.videos} videos)`);
      } else {
        await upsertAsset(supabase, file);
      }
    }

    console.log(`Synced ${files.length} Drive files and ${videoCount} videos.`);
  });
}

function fetchYoutubeMetadata(url: string) {
  const stdout = run(YTDLP_BIN, ["--skip-download", "--dump-json", "--no-playlist", ...ytDlpCookieArgs(), url]);
  return JSON.parse(stdout) as YtDlpMetadata;
}

function downloadAudio(url: string, workDir: string) {
  run(YTDLP_BIN, [
    "-f",
    "bestaudio[ext=m4a]/bestaudio/best",
    "--no-playlist",
    ...ytDlpCookieArgs(),
    "-o",
    path.join(workDir, "%(id)s.%(ext)s"),
    url,
  ]);
  const metadata = fetchYoutubeMetadata(url);
  const candidates = [".m4a", ".webm", ".mp4", ".mp3", ".opus"].map((ext) => path.join(workDir, `${metadata.id}${ext}`));
  const audio = candidates.find((candidate) => existsSync(candidate));
  if (!audio) throw new Error("Downloaded audio file was not found.");
  return { audio, metadata };
}

function transcribeAudio(audioPath: string, outPath: string, model: string) {
  run(PYTHON_BIN, [path.join(process.cwd(), "scripts/transcribe_audio.py"), audioPath, "--out", outPath, "--model", model, "--language", "ja"]);
  return JSON.parse(readFileSync(outPath, "utf8")) as TranscribePayload;
}

async function upsertVideoFromMetadata(supabase: SupabaseClient, metadata: YtDlpMetadata) {
  const channelName = metadata.uploader || "YouTube";
  const { data: channel } = await supabase
    .from("channels")
    .upsert(
      {
        drive_sheet_name: channelName,
        youtube_channel_name: channelName,
        status: "active",
      },
      { onConflict: "drive_sheet_name" },
    )
    .select("id")
    .single();

  const { data: video, error } = await supabase
    .from("videos")
    .upsert(
      {
        video_id: metadata.id,
        channel_id: channel?.id,
        title: metadata.title,
        url: metadata.webpage_url || `https://www.youtube.com/watch?v=${metadata.id}`,
        published_on: uploadDateToIso(metadata.upload_date),
        duration_text: metadata.duration ? `${Math.floor(metadata.duration / 60)}:${String(metadata.duration % 60).padStart(2, "0")}` : null,
        duration_seconds: metadata.duration ?? null,
        description: metadata.description ?? null,
        tags: metadata.tags ?? [],
      },
      { onConflict: "video_id" },
    )
    .select("id")
    .single();

  if (error || !video?.id) throw new Error(error?.message ?? "failed to upsert video metadata");
  return { videoDbId: video.id as string, channelName };
}

async function transcribeVideo(payload: { url?: string; videoId?: string; model?: string }) {
  const supabase = getSupabase();
  await recordRun(supabase, "transcribe", async () => {
    const url = videoUrlFrom(payload);
    const workDir = mkdtempSync(path.join(tmpdir(), "tubehub-"));
    try {
      const { audio, metadata } = downloadAudio(url, workDir);
      const outJson = path.join(workDir, "segments.json");
      const model = payload.model || TRANSCRIBE_MODEL;
      const transcript = transcribeAudio(audio, outJson, model);
      const { videoDbId, channelName } = await upsertVideoFromMetadata(supabase, metadata);
      const segments: TranscriptSegment[] = transcript.segments.map((segment) => ({
        start: segment.start,
        end: segment.end,
        text: segment.text,
      }));
      const fullText = segments.map((segment) => segment.text).join("\n");
      const exportData: TranscriptExport = {
        videoId: metadata.id,
        title: metadata.title,
        url: metadata.webpage_url || url,
        channelName,
        publishedOn: uploadDateToIso(metadata.upload_date),
        durationText: metadata.duration ? `${Math.floor(metadata.duration / 60)}:${String(metadata.duration % 60).padStart(2, "0")}` : null,
        summary: null,
        fullText,
        segments,
        asrModel: model,
        language: transcript.language,
      };

      let obsidianPath: string | null = null;
      let githubPath: string | null = null;
      if (TRANSCRIPT_MARKDOWN_EXPORT) {
        const markdown = buildTranscriptMarkdown(exportData);
        obsidianPath = path.join(OBSIDIAN_VAULT_DIR, obsidianTranscriptFileName(exportData));
        githubPath = githubTranscriptPath(exportData).replace(/^transcripts/, GITHUB_TRANSCRIPTS_DIR);
        mkdirSync(path.dirname(obsidianPath), { recursive: true });
        mkdirSync(path.dirname(githubPath), { recursive: true });
        writeFileSync(obsidianPath, markdown, "utf8");
        writeFileSync(githubPath, markdown, "utf8");
      }

      const { data: transcriptRow, error } = await supabase
        .from("transcripts")
        .upsert(
          {
            video_id: videoDbId,
            source_url: exportData.url,
            full_text: fullText,
            summary: exportData.summary,
            asr_model: model,
            language: transcript.language,
            obsidian_path: obsidianPath,
            github_path: githubPath,
          },
          { onConflict: "video_id" },
        )
        .select("id")
        .single();

      if (error || !transcriptRow?.id) throw new Error(error?.message ?? "failed to upsert transcript");

      await supabase.from("transcript_segments").delete().eq("transcript_id", transcriptRow.id);
      if (segments.length) {
        await supabase.from("transcript_segments").insert(
          segments.map((segment, index) => ({
            transcript_id: transcriptRow.id,
            segment_index: index,
            start_seconds: segment.start,
            end_seconds: segment.end,
            text: segment.text,
          })),
        );
      }

      console.log(`Saved transcript to Supabase for ${metadata.id}`);
      if (obsidianPath) console.log(`Wrote ${obsidianPath}`);
      if (githubPath) console.log(`Wrote ${githubPath}`);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
}

type RawTranscriptExport = {
  id: string;
  full_text: string;
  summary: string | null;
  asr_model: string;
  language: string;
  videos: {
    video_id: string;
    title: string;
    url: string;
    published_on: string | null;
    duration_text: string | null;
    channels: { youtube_channel_name: string | null; drive_sheet_name: string } | null;
  } | null;
  transcript_segments: Array<{
    segment_index: number;
    start_seconds: number;
    end_seconds: number;
    text: string;
  }> | null;
};

async function exportGithub(payload: { videoId?: string; push?: boolean }) {
  const supabase = getSupabase();
  await recordRun(supabase, "github_export", async () => {
    let query = supabase
      .from("transcripts")
      .select(
        "id, full_text, summary, asr_model, language, videos(video_id, title, url, published_on, duration_text, channels(youtube_channel_name, drive_sheet_name)), transcript_segments(segment_index, start_seconds, end_seconds, text)",
      )
      .order("created_at", { ascending: false });

    if (payload.videoId) {
      const { data: video } = await supabase
        .from("videos")
        .select("id")
        .or(`id.eq.${payload.videoId},video_id.eq.${payload.videoId}`)
        .maybeSingle();
      if (video?.id) query = query.eq("video_id", video.id);
    }

    const { data, error } = await query.limit(payload.videoId ? 1 : 100);
    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as unknown as RawTranscriptExport[]) {
      if (!row.videos) continue;
      const exportData: TranscriptExport = {
        videoId: row.videos.video_id,
        title: row.videos.title,
        url: row.videos.url,
        channelName: row.videos.channels?.youtube_channel_name || row.videos.channels?.drive_sheet_name,
        publishedOn: row.videos.published_on,
        durationText: row.videos.duration_text,
        summary: row.summary,
        fullText: row.full_text,
        segments: (row.transcript_segments ?? [])
          .sort((a, b) => a.segment_index - b.segment_index)
          .map((segment) => ({
            start: Number(segment.start_seconds),
            end: Number(segment.end_seconds),
            text: segment.text,
          })),
        asrModel: row.asr_model,
        language: row.language,
      };
      const markdown = buildTranscriptMarkdown(exportData);
      const githubPath = githubTranscriptPath(exportData).replace(/^transcripts/, GITHUB_TRANSCRIPTS_DIR);
      mkdirSync(path.dirname(githubPath), { recursive: true });
      writeFileSync(githubPath, markdown, "utf8");
      await supabase.from("transcripts").update({ github_path: githubPath }).eq("id", row.id);
      console.log(`Wrote ${githubPath}`);
    }

    if (payload.push) {
      run("git", ["add", GITHUB_TRANSCRIPTS_DIR]);
      run("git", ["commit", "-m", "Export transcript markdown"]);
      run("git", ["push"]);
    }
  });
}

async function markJob(supabase: SupabaseClient, jobId: string, status: "running" | "success" | "failed", error?: unknown) {
  await supabase
    .from("worker_jobs")
    .update({
      status,
      locked_at: status === "running" ? new Date().toISOString() : null,
      locked_by: status === "running" ? WORKER_ID : null,
      last_error: error ? (error instanceof Error ? error.message : String(error)) : null,
    })
    .eq("id", jobId);
}

function videoIdFromPayload(payload: Record<string, unknown>) {
  if (typeof payload.videoId === "string" && payload.videoId) return payload.videoId;
  if (typeof payload.url !== "string") return null;
  return payload.url.match(/[?&]v=([^&]+)/)?.[1] ?? payload.url.split("/shorts/")[1]?.split(/[?&]/)[0] ?? null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function transcriptAlreadyExists(supabase: SupabaseClient, payload: Record<string, unknown>) {
  const videoId = videoIdFromPayload(payload);
  if (!videoId) return false;

  let query = supabase
    .from("videos")
    .select("id, transcripts(id)");

  query = isUuid(videoId) ? query.or(`id.eq.${videoId},video_id.eq.${videoId}`) : query.eq("video_id", videoId);
  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  const transcripts = data?.transcripts;
  return Array.isArray(transcripts) ? transcripts.length > 0 : Boolean(transcripts);
}

async function processNextJob(type?: WorkerJob["type"]) {
  const supabase = getSupabase();
  let query = supabase.from("worker_jobs").select("id, type, payload").eq("status", "queued").lte("run_after", new Date().toISOString());
  if (type) query = query.eq("type", type);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    console.log("No queued jobs.");
    return false;
  }

  const job = data as WorkerJob;
  console.log(`Processing job ${job.id} (${job.type})`);
  await markJob(supabase, job.id, "running");
  try {
    if (job.type === "sync_drive") {
      await syncDrive(typeof job.payload.folderId === "string" ? job.payload.folderId : DRIVE_FOLDER_ID);
    } else if (job.type === "transcribe") {
      if (await transcriptAlreadyExists(supabase, job.payload)) {
        console.log(`Skipped job ${job.id}; transcript already exists.`);
        await markJob(supabase, job.id, "success");
        return true;
      }
      await transcribeVideo({
        url: typeof job.payload.url === "string" ? job.payload.url : undefined,
        videoId: typeof job.payload.videoId === "string" ? job.payload.videoId : undefined,
        model: typeof job.payload.model === "string" ? job.payload.model : undefined,
      });
    } else {
      await exportGithub({
        videoId: typeof job.payload.videoId === "string" ? job.payload.videoId : undefined,
        push: job.payload.push === true,
      });
    }
    await markJob(supabase, job.id, "success");
    console.log(`Finished job ${job.id} (${job.type})`);
    return true;
  } catch (err) {
    await markJob(supabase, job.id, "failed", err);
    throw err;
  }
}

async function watchJobs(type?: WorkerJob["type"]) {
  console.log(`Worker watch started. Polling every ${WORKER_POLL_INTERVAL_MS}ms.`);
  for (;;) {
    try {
      const processed = await processNextJob(type);
      if (!processed) await sleep(WORKER_POLL_INTERVAL_MS);
    } catch (error) {
      console.error(error);
      await sleep(WORKER_POLL_INTERVAL_MS);
    }
  }
}

function parseOptions(args: string[]) {
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      i += 1;
    }
  }
  return options;
}

async function main() {
  const [command = "next", ...rest] = process.argv.slice(2);
  const options = parseOptions(rest);

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(`Usage:
  npm run worker                         Process one queued job
  npm run worker:watch                   Keep processing queued jobs
  npm run worker:sync-drive              Sync Google Drive folder
  npm run worker:transcribe -- --url URL  Transcribe one YouTube URL
  npm run worker:export-github           Export transcripts to Markdown

Options:
  --folderId ID
  --spreadsheetIds ID,ID,ID
  --url URL
  --videoId VIDEO_ID
  --model small|medium|base
  --type transcribe|sync_drive|export_github
  --push`);
  } else if (command === "sync-drive") {
    if (typeof options.spreadsheetIds === "string") {
      process.env.GOOGLE_DRIVE_SPREADSHEET_IDS = options.spreadsheetIds;
    }
    await syncDrive(typeof options.folderId === "string" ? options.folderId : DRIVE_FOLDER_ID);
  } else if (command === "transcribe") {
    await transcribeVideo({
      url: typeof options.url === "string" ? options.url : undefined,
      videoId: typeof options.videoId === "string" ? options.videoId : undefined,
      model: typeof options.model === "string" ? options.model : undefined,
    });
  } else if (command === "export-github") {
    await exportGithub({
      videoId: typeof options.videoId === "string" ? options.videoId : undefined,
      push: options.push === true,
    });
  } else if (command === "next") {
    await processNextJob(typeof options.type === "string" ? options.type as WorkerJob["type"] : undefined);
  } else if (command === "watch") {
    await watchJobs(typeof options.type === "string" ? options.type as WorkerJob["type"] : undefined);
  } else {
    throw new Error(`Unknown worker command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
