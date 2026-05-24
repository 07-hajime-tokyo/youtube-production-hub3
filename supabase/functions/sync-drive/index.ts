// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

type SheetRow = string[];

type SpreadsheetMeta = {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  properties?: {
    title?: string;
  };
};

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || requireEnv("PROJECT_SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || requireEnv("PROJECT_SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function numberFrom(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function durationSeconds(value?: string | null) {
  if (!value) return null;
  const text = value.trim();
  const h = text.match(/(\d+)\s*時間/);
  const m = text.match(/(\d+)\s*分/);
  const s = text.match(/(\d+)\s*秒/);
  if (h || m || s) return Number(h?.[1] ?? 0) * 3600 + Number(m?.[1] ?? 0) * 60 + Number(s?.[1] ?? 0);
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

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of source) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string) {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function signJwt(credentials: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: credentials.client_email,
    scope: SHEETS_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64Url(new TextEncoder().encode(JSON.stringify(header)))}.${base64Url(new TextEncoder().encode(JSON.stringify(claim)))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(signature)}`;
}

async function getGoogleAccessToken() {
  const credentials = JSON.parse(requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON")) as {
    client_email: string;
    private_key: string;
  };
  const assertion = await signJwt(credentials);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const text = await response.text();
  const data = parseJson(text, "Google token response");
  if (!response.ok) throw new Error(`Google token request failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

function parseJson(text: string, label: string) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} was not JSON: ${text.slice(0, 160)}`);
  }
}

async function googleGet<T>(path: string, accessToken: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${path}`;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  const data = parseJson(text, `Google Sheets response for ${url}`);
  if (!response.ok) throw new Error(`Google Sheets request failed: ${JSON.stringify(data)}`);
  return data as T;
}

async function getSpreadsheetMeta(spreadsheetId: string, accessToken: string) {
  const query = new URLSearchParams({
    fields: "spreadsheetId,spreadsheetUrl,properties/title",
  });
  return googleGet<SpreadsheetMeta>(`${spreadsheetId}?${query}`, accessToken);
}

async function getSpreadsheetRows(spreadsheetId: string, accessToken: string) {
  const range = encodeURIComponent("Videos!A1:Z5000");
  const query = new URLSearchParams({
    valueRenderOption: "FORMATTED_VALUE",
  });
  const data = await googleGet<{ values?: SheetRow[] }>(`${spreadsheetId}/values/${range}?${query}`, accessToken);
  return data.values ?? [];
}

async function recordRun<T>(supabase: ReturnType<typeof getSupabase>, fn: (runId: string | null) => Promise<T>) {
  const { data } = await supabase
    .from("sync_runs")
    .insert({ type: "drive", status: "running", started_at: new Date().toISOString() })
    .select("id")
    .maybeSingle();
  const runId = data?.id ?? null;

  try {
    const result = await fn(runId);
    if (runId) {
      await supabase
        .from("sync_runs")
        .update({ status: "success", metadata: result, finished_at: new Date().toISOString() })
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

async function syncSpreadsheet(
  supabase: ReturnType<typeof getSupabase>,
  spreadsheetId: string,
  accessToken: string,
) {
  const [meta, values] = await Promise.all([
    getSpreadsheetMeta(spreadsheetId, accessToken),
    getSpreadsheetRows(spreadsheetId, accessToken),
  ]);
  const sheetName = meta.properties?.title || spreadsheetId;

  const { data: channel, error } = await supabase
    .from("channels")
    .upsert(
      {
        drive_file_id: spreadsheetId,
        drive_sheet_name: sheetName,
        youtube_channel_name: sheetName,
        source_url: meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "drive_file_id" },
    )
    .select("id")
    .single();

  if (error || !channel?.id) throw new Error(error?.message ?? `failed to upsert channel ${sheetName}`);

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
  const pendingByVideoId = new Map<string, { video: Record<string, unknown>; metric: Record<string, unknown> }>();

  for (const row of values.slice(2)) {
    const videoId =
      row[indexes.videoId] ||
      row[indexes.url]?.match(/[?&]v=([^&]+)/)?.[1] ||
      row[indexes.url]?.split("/shorts/")[1]?.split(/[?&]/)[0];
    const title = row[indexes.title];
    const url = row[indexes.url];
    if (!videoId || !title || !url) continue;

    pendingByVideoId.set(videoId, {
      video: {
        video_id: videoId,
        channel_id: channel.id,
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
        drive_source_file_id: spreadsheetId,
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
    const { data, error: videoError } = await supabase
      .from("videos")
      .upsert(batch.map((item) => item.video), { onConflict: "video_id" })
      .select("id,video_id");
    if (videoError) throw new Error(videoError.message);
    for (const video of data ?? []) videoIdToDbId.set(video.video_id, video.id);
  }

  const metrics = pending
    .map((item) => {
      const dbVideoId = videoIdToDbId.get(String(item.video.video_id));
      return dbVideoId ? { video_id: dbVideoId, ...item.metric } : null;
    })
    .filter(Boolean);

  for (const batch of chunk(metrics, 500)) {
    const { error: metricError } = await supabase.from("video_metrics_daily").upsert(batch, {
      onConflict: "video_id,metric_date",
    });
    if (metricError) throw new Error(metricError.message);
  }

  return { spreadsheetId, name: sheetName, videos: pending.length };
}

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    const cronSecret = Deno.env.get("SYNC_DRIVE_CRON_SECRET");
    if (cronSecret && request.headers.get("x-sync-secret") !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const spreadsheetIds = requireEnv("GOOGLE_DRIVE_SPREADSHEET_IDS")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!spreadsheetIds.length) throw new Error("GOOGLE_DRIVE_SPREADSHEET_IDS is empty");

    const supabase = getSupabase();
    const accessToken = await getGoogleAccessToken();
    const result = await recordRun(supabase, async () => {
      const sheets = [];
      for (const spreadsheetId of spreadsheetIds) {
        sheets.push(await syncSpreadsheet(supabase, spreadsheetId, accessToken));
      }
      return {
        sheets,
        spreadsheetCount: sheets.length,
        videoCount: sheets.reduce((sum, sheet) => sum + sheet.videos, 0),
      };
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
