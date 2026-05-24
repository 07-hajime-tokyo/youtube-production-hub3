export const PRODUCTION_STATUSES = [
  "research",
  "script",
  "video",
  "title",
  "thumbnail",
  "scheduled",
  "published",
  "analyzed",
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export type ChannelSummary = {
  id: string;
  name: string;
  driveSheetName: string;
  genre?: string | null;
  status: string;
  sourceUrl?: string | null;
  videoCount: number;
};

export type DashboardVideo = {
  id: string;
  videoId: string;
  title: string;
  themeSummary?: string | null;
  thumbnailUrl?: string | null;
  url: string;
  channelName: string;
  channelId?: string | null;
  publishedOn?: string | null;
  durationText?: string | null;
  latestViews: number;
  sevenDayAverageGrowth: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  productionStatus: ProductionStatus;
  assignedTo?: string | null;
  dueOn?: string | null;
  notes?: string | null;
  hasTranscript: boolean;
  hasTranscriptJob?: boolean;
  transcriptText?: string | null;
  transcriptSummary?: string | null;
  transcriptModel?: string | null;
  transcriptLanguage?: string | null;
  obsidianPath?: string | null;
  githubPath?: string | null;
};

export type SyncRunSummary = {
  id: string;
  type: "drive" | "transcribe" | "github_export";
  status: "queued" | "running" | "success" | "failed";
  message?: string | null;
  createdAt: string;
};

export type WorkerJobSummary = {
  id: string;
  type: "sync_drive" | "transcribe" | "export_github";
  status: "queued" | "running" | "success" | "failed";
  createdAt: string;
  payload: Record<string, unknown>;
};

export type DashboardData = {
  mode: "live" | "demo";
  setupWarnings: string[];
  channels: ChannelSummary[];
  videos: DashboardVideo[];
  syncRuns: SyncRunSummary[];
  workerJobs: WorkerJobSummary[];
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptExport = {
  videoId: string;
  title: string;
  url: string;
  channelName?: string | null;
  publishedOn?: string | null;
  durationText?: string | null;
  summary?: string | null;
  fullText: string;
  segments: TranscriptSegment[];
  asrModel: string;
  language: string;
};
