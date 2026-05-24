import Link from "next/link";
import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  Clock3,
  Database,
  FileText,
  GitBranch,
  Search,
  UploadCloud,
  Video,
} from "lucide-react";
import { HandoffLinksPanel } from "@/components/handoff-links-panel";
import { signOut } from "@/app/actions";
import { QueueButton } from "@/components/queue-button";
import { ScheduleWorkspace } from "@/components/schedule-workspace";
import { StatusBadge } from "@/components/status-form";
import { VideoRankingTable } from "@/components/video-ranking-table";
import { requireAppUser } from "@/lib/auth";
import { DEFAULT_DRIVE_FOLDER_ID } from "@/lib/env";
import { formatCompact, formatNumber } from "@/lib/format";
import { getNotionWorkspaceData } from "@/lib/notion";
import { getDashboardData } from "@/lib/queries";
import type { ProductionStatus } from "@/lib/types";

function getTokyoDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ja-JP-u-ca-gregory", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    weekday: value("weekday"),
  };
}

function dateKey(date = new Date()) {
  const parts = getTokyoDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateLabel(key?: string | null) {
  if (!key) return "日付未定";
  const date = new Date(`${key}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; channel?: string; transcript?: string }>;
}) {
  const user = await requireAppUser();
  const params = await searchParams;
  const [data, notionData] = await Promise.all([getDashboardData(params), getNotionWorkspaceData()]);
  const filteredVideos = data.videos;
  const totalViews = data.videos.reduce((sum, video) => sum + video.latestViews, 0);
  const transcriptCount = data.videos.filter((video) => video.hasTranscript).length;
  const transcriptRate = data.videos.length ? Math.round((transcriptCount / data.videos.length) * 100) : 0;
  const hotVideos = [...data.videos].sort((a, b) => b.sevenDayAverageGrowth - a.sevenDayAverageGrowth).slice(0, 5);
  const statusCounts = data.videos.reduce<Record<ProductionStatus, number>>(
    (acc, video) => {
      acc[video.productionStatus] += 1;
      return acc;
    },
    {
      research: 0,
      script: 0,
      video: 0,
      title: 0,
      thumbnail: 0,
      scheduled: 0,
      published: 0,
      analyzed: 0,
    },
  );
  const navItems = [
    { icon: BarChart3, label: "ダッシュボード" },
    { icon: Video, label: "動画ランキング" },
    { icon: FileText, label: "文字起こしDB" },
    { icon: BookOpenText, label: "制作進行" },
    { icon: Database, label: "Supabase" },
  ];
  const kpis = [
    { label: "総再生数", value: formatCompact(totalViews), sub: "D0最新値の合計", icon: BarChart3 },
    { label: "管理動画", value: formatNumber(data.videos.length), sub: `${data.channels.length} チャンネル`, icon: Video },
    { label: "文字起こし済み", value: `${transcriptRate}%`, sub: `${transcriptCount}/${data.videos.length} 本`, icon: FileText },
    {
      label: "待ちジョブ",
      value: formatNumber(data.workerJobs.filter((job) => job.status === "queued").length),
      sub: "ローカルworker対象",
      icon: Clock3,
    },
  ];
  const fallbackHandoffLinks = [
    { title: "制作運用 Notion", category: "Notion", href: "https://www.notion.so/", note: "タスク・議事録・進行管理" },
    { title: "動画素材 Drive", category: "Drive", href: "https://drive.google.com/", note: "素材・台帳・共有ファイル" },
    { title: "週次MTGメモ", category: "Meeting", href: "https://www.notion.so/", note: "決定事項と申し送り" },
    { title: "GitHub Export", category: "GitHub", href: "https://github.com/", note: "文字起こしMarkdown保存先" },
  ];
  const notionTasks = notionData?.tasks ?? [];
  const todayKey = dateKey();
  const todayTasks = notionTasks.filter((task) => task.date === todayKey);
  const weekEndKey = dateKey(addDays(new Date(`${todayKey}T00:00:00+09:00`), 7));
  const upcomingTasks = notionTasks
    .filter((task) => task.date && task.date > todayKey && task.date <= weekEndKey && task.display !== "未配置")
    .sort((a, b) => `${a.date} ${a.due}`.localeCompare(`${b.date} ${b.due}`))
    .slice(0, 6);
  const handoffLinks = notionData?.handoffLinks.length ? notionData.handoffLinks : fallbackHandoffLinks;
  const todayLabel = "";
  const nowTime = "";
  const scheduleDays: {
    label: string;
    date: string;
    tasks: number;
    minutes: number;
    kcal: string;
    bars: { title: string; lane: string; left: string; width: string; color: string }[];
  }[] = [];
  const weekSchedule: { day: string; date: string; title: string; tasks: number; minutes: number; tone: string }[] = [];
  const monthSchedule: { week: string; title: string; count: number }[] = [];
  const backlogTasks: { title: string; owner?: string; date?: string; minutes: number }[] = [];

  return (
    <main className="min-h-screen bg-[#f7f6f2]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-950 px-4 py-5 text-white lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-9 items-center justify-center rounded-md bg-[#ff7a59] text-lg font-black">
              T
            </div>
            <div>
              <div className="text-lg font-semibold">TubeKit</div>
              <div className="font-mono text-[11px] text-white/50">production hub</div>
            </div>
          </div>
          <nav className="mt-8 space-y-1">
            {navItems.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 first:bg-white/10 first:text-white"
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </div>
            ))}
          </nav>
          <div className="mt-auto rounded-md bg-white/5 p-3 text-xs text-white/70">
            <div className="mb-2 flex items-center justify-between text-white">
              <span className="font-semibold">Supabase</span>
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-200">
                {data.mode}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${transcriptRate}%` }} />
            </div>
            <div className="mt-2 font-mono text-[11px]">transcripts {transcriptRate}%</div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
            <div>
              <div className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Dashboard
              </div>
              <h1 className="text-lg font-semibold text-zinc-950">動画制作プロセス管理</h1>
            </div>
            <form action="/" className="ml-0 flex flex-1 items-center gap-2 sm:ml-4 sm:max-w-md">
              <input type="hidden" name="channel" value={params.channel ?? ""} />
              <input type="hidden" name="transcript" value={params.transcript ?? ""} />
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-zinc-400" />
                <input
                  name="q"
                  defaultValue={params.q}
                  placeholder="タイトル・チャンネル・タグで検索"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
                />
              </div>
              <button className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700">
                検索
              </button>
            </form>
            <div className="ml-auto flex items-center gap-2">
              <QueueButton endpoint="/api/sync/drive" payload={{ folderId: DEFAULT_DRIVE_FOLDER_ID }} variant="light">
                <UploadCloud className="size-4" />
                Drive同期
              </QueueButton>
              <QueueButton endpoint="/api/github/export" variant="dark">
                <GitBranch className="size-4" />
                GitHub保存
              </QueueButton>
              {user ? (
                <form action={signOut}>
                  <button className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700">
                    ログアウト
                  </button>
                </form>
              ) : null}
            </div>
          </header>

          <div className="space-y-5 p-4 sm:p-6">
            {data.setupWarnings.length ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {data.setupWarnings.join(" ")}
              </div>
            ) : null}

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-md border border-[#d8cbb8] bg-[#fbfaf6] p-4 text-[#241f17] shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md bg-[#211e18] text-[#f3d27b]">
                      <CalendarDays className="size-4" />
                    </div>
                    <div>
                      <h2 className="font-semibold">本日のタスク</h2>
                      <div className="mt-1 text-xs text-[#7d6f59]">今日やる制作タスク</div>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#d8cbb8] bg-[#efe5d4] px-3 py-1 font-mono text-xs font-semibold">
                    {todayTasks.length} tasks
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {todayTasks.length ? (
                    todayTasks.map((task) => (
                      <div key={task.title} className="rounded-md border border-[#d8cbb8] bg-[#fffaf1] p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="line-clamp-2 text-sm font-semibold">{task.title}</div>
                          <span className="rounded bg-[#211e18] px-2 py-1 font-mono text-[11px] text-white">{task.due}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#7d6f59]">
                          <span className="rounded border border-[#d8cbb8] bg-white px-2 py-0.5">{task.stage}</span>
                          <span>{task.owner}</span>
                          <span>{task.minutes}m</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-[#d8cbb8] bg-[#fffaf1] p-4 text-sm text-[#7d6f59] md:col-span-2">
                      本日のタスクはまだありません。
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-[#d8cbb8] bg-[#fbfaf6] p-4 text-[#241f17] shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md bg-[#211e18] text-[#f3d27b]">
                      <Clock3 className="size-4" />
                    </div>
                    <div>
                      <h2 className="font-semibold">これからのタスク</h2>
                      <div className="mt-1 text-xs text-[#7d6f59]">明日から今週中の予定</div>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#d8cbb8] bg-[#efe5d4] px-3 py-1 font-mono text-xs font-semibold">
                    {upcomingTasks.length} tasks
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {upcomingTasks.length ? (
                    upcomingTasks.map((task) => (
                      <div key={`${task.title}-${task.date ?? ""}`} className="grid grid-cols-[82px_1fr_auto] items-center gap-3 rounded-md border border-[#d8cbb8] bg-[#fffaf1] p-3 shadow-sm">
                        <div className="rounded border border-[#d8cbb8] bg-white px-2 py-1 text-center text-xs font-semibold text-[#7d6f59]">{dateLabel(task.date)}</div>
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-sm font-semibold">{task.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#7d6f59]">
                            <span className="rounded border border-[#d8cbb8] bg-white px-2 py-0.5">{task.stage}</span>
                            <span>{task.owner}</span>
                            <span>{task.minutes}m</span>
                          </div>
                        </div>
                        <span className="rounded bg-[#211e18] px-2 py-1 font-mono text-[11px] text-white">
                          {task.due}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-[#d8cbb8] bg-[#fffaf1] p-4 text-sm text-[#7d6f59]">
                      これからのタスクはまだありません。
                    </div>
                  )}
                </div>
              </div>
            </section>

            <HandoffLinksPanel links={handoffLinks} />

            <section className="hidden gap-3 md:grid-cols-4">
              {kpis.map(({ label, value, sub, icon: Icon }) => (
                <div key={label} className="rounded-md border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                    <span>{label}</span>
                    <Icon className="size-4 text-zinc-400" />
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{value}</div>
                  <div className="mt-1 text-xs text-zinc-500">{sub}</div>
                </div>
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
              <div className="overflow-hidden rounded-md border border-[#d7dee8] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7dee8] bg-[#f5f8fc] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md bg-[#1f2937] text-[#c7d2fe]">
                      <Video className="size-4" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-[#172033]">動画ランキング / 制作ステータス</h2>
                      <p className="mt-1 text-xs text-[#667085]">Drive由来の動画台帳をSupabase中心で管理します。</p>
                    </div>
                  </div>
                  <form action="/" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="q" value={params.q ?? ""} />
                    <select
                      name="channel"
                      defaultValue={params.channel ?? ""}
                      className="h-9 rounded-md border border-[#cfd8e3] bg-white px-2 text-xs text-[#172033]"
                    >
                      <option value="">全チャンネル</option>
                      {data.channels.map((channel) => (
                        <option key={channel.id} value={channel.name}>
                          {channel.name}
                        </option>
                      ))}
                    </select>
                    <select
                      name="transcript"
                      defaultValue={params.transcript ?? ""}
                      className="h-9 rounded-md border border-[#cfd8e3] bg-white px-2 text-xs text-[#172033]"
                    >
                      <option value="">文字起こし 全件</option>
                      <option value="missing">未文字起こし</option>
                      <option value="done">文字起こし済み</option>
                    </select>
                    <button className="h-9 rounded-md bg-[#1f2937] px-3 text-xs font-semibold text-white">絞込</button>
                  </form>
                </div>
                <VideoRankingTable videos={filteredVideos} disabled={data.mode === "demo"} />
              </div>

              <div className="space-y-5">
                <section className="rounded-md border border-zinc-200 bg-white p-4">
                  <h2 className="font-semibold">伸びている動画</h2>
                  <div className="mt-3 space-y-3">
                    {hotVideos.map((video) => (
                      <Link key={video.id} href={`/videos/${video.id}`} className="block rounded-md border border-zinc-100 p-3 hover:bg-zinc-50">
                        <div className="line-clamp-2 text-sm font-semibold">{video.title}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                          <span>{video.channelName}</span>
                          <span className="font-mono text-emerald-700">+{formatCompact(video.sevenDayAverageGrowth)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border border-zinc-200 bg-white p-4">
                  <h2 className="font-semibold">制作パイプライン</h2>
                  <div className="mt-3 space-y-2">
                    {Object.entries(statusCounts).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-sm">
                        <StatusBadge status={status as ProductionStatus} />
                        <span className="font-mono text-zinc-600">{count}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </section>

            <ScheduleWorkspace initialTasks={notionTasks} />

            <section className="hidden overflow-hidden rounded-md border border-[#d8cbb8] bg-[#f5efe4] text-[#241f17]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8cbb8] bg-[#fbfaf6] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-md bg-[#211e18] text-[#f3d27b]">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">Schedule</h2>
                      <span className="rounded-full border border-[#d8cbb8] bg-[#efe5d4] px-2 py-0.5 text-[11px] font-semibold">
                        Notion DB
                      </span>
                      <span className="rounded-full border border-[#d8cbb8] bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                        DAY / WEEK / MONTH
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold uppercase text-[#8b7a61]">task schedule</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <button className="rounded-full border border-[#d8cbb8] bg-white px-4 py-2 text-[#6d604c]">今週</button>
                  <button className="rounded-full bg-[#211e18] px-4 py-2 text-white">今日</button>
                  <span className="rounded-full border border-[#d8cbb8] bg-white px-3 py-2 text-[#44614f]">Notion 同期済み</span>
                  <button className="rounded-full border border-[#d8cbb8] bg-white px-4 py-2 text-[#6d604c]">記録を書き出し</button>
                </div>
              </div>

              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold">
                      <span>{todayLabel}</span>
                      <span className="ml-4 font-mono text-lg">{nowTime}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span>{todayTasks.length} tasks</span>
                      <span className="rounded-full border border-[#d8cbb8] bg-white px-3 py-1 font-semibold">P/F/C --</span>
                      <span className="rounded-full border border-[#d8cbb8] bg-white px-3 py-1 font-semibold">100%</span>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {scheduleDays.map((day) => (
                      <div key={day.label}>
                        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
                          <div className="flex items-baseline gap-3">
                            <h3 className="text-lg font-semibold">{day.label}</h3>
                            <span className="text-xs text-[#7d6f59]">{day.date}</span>
                            <span className="text-xs text-[#7d6f59]">1日のテーマ</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#7d6f59]">
                            <span>{day.tasks} tasks</span>
                            <span>{day.minutes}分</span>
                            <span className="rounded-full border border-[#d8cbb8] bg-white px-2 py-1 font-semibold">{day.kcal}</span>
                            <span className="rounded-full border border-[#d8cbb8] bg-white px-2 py-1 font-semibold">P/F/C --</span>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-md border border-[#d8cbb8] bg-[#fffdf8]">
                          <div className="min-w-[1040px]">
                            <div className="grid grid-cols-24 border-b border-[#e6dac8] px-2 py-1 text-center font-mono text-[10px] text-[#8b7a61]">
                              {Array.from({ length: 24 }).map((_, hour) => (
                                <span key={hour}>{String(hour).padStart(2, "0")}</span>
                              ))}
                            </div>
                            <div
                              className="relative h-[154px]"
                              style={{
                                backgroundImage:
                                  "repeating-linear-gradient(to right, transparent 0, transparent calc(100% / 24 - 1px), rgba(183,151,103,.28) calc(100% / 24 - 1px), rgba(183,151,103,.28) calc(100% / 24)), linear-gradient(135deg, rgba(214,197,166,.18) 25%, transparent 25%, transparent 50%, rgba(214,197,166,.18) 50%, rgba(214,197,166,.18) 75%, transparent 75%)",
                                backgroundSize: "auto, 16px 16px",
                              }}
                            >
                              <div className="absolute left-2 top-4 rounded border border-[#e2d6c4] bg-white px-2 py-1 text-[11px] text-[#7d6f59]">計画</div>
                              <div className="absolute left-2 top-[92px] rounded border border-[#e2d6c4] bg-white px-2 py-1 text-[11px] text-[#7d6f59]">実績</div>
                              {day.label === "今日" ? (
                                <div className="absolute bottom-0 top-0 w-px bg-[#b35d50]" style={{ left: "59%" }}>
                                  <span className="absolute -top-1 left-1 size-2 rounded-full bg-[#b35d50]" />
                                  <span className="absolute top-[70px] left-2 rounded bg-white px-1 font-mono text-[10px] text-[#b35d50]">{nowTime}</span>
                                </div>
                              ) : null}
                              {day.bars.map((bar) => (
                                <div
                                  key={`${day.label}-${bar.title}-${bar.lane}`}
                                  className={`absolute h-6 truncate rounded border px-2 py-1 text-xs font-semibold shadow-sm ${bar.color}`}
                                  style={{
                                    left: bar.left,
                                    width: bar.width,
                                    top: bar.lane === "計画" ? "22px" : "98px",
                                  }}
                                >
                                  {bar.title}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-md border border-[#d8cbb8] bg-[#fffdf8] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">週のスケジュール</h3>
                          <div className="mt-1 text-xs text-[#7d6f59]">5/18 - 5/24</div>
                        </div>
                        <span className="rounded-full border border-[#d8cbb8] bg-[#efe5d4] px-2 py-1 text-[11px] font-semibold">
                          week view
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-7">
                        {weekSchedule.map((item) => (
                          <div key={item.day} className="min-h-28 rounded-md border border-[#e0d3bf] bg-[#fbf6ec] p-2">
                            <div className="flex items-center justify-between text-[11px] text-[#7d6f59]">
                              <span className="font-semibold">{item.day}</span>
                              <span>{item.date}</span>
                            </div>
                            <div className={`mt-3 rounded border px-2 py-1 text-xs font-semibold ${item.tone}`}>
                              {item.title}
                            </div>
                            <div className="mt-3 text-[11px] text-[#7d6f59]">
                              {item.tasks} tasks / {item.minutes}分
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border border-[#d8cbb8] bg-[#fffdf8] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">月のスケジュール</h3>
                          <div className="mt-1 text-xs text-[#7d6f59]">2026年5月</div>
                        </div>
                        <span className="rounded-full border border-[#d8cbb8] bg-[#efe5d4] px-2 py-1 text-[11px] font-semibold">
                          month view
                        </span>
                      </div>
                      <div className="mt-4 space-y-2">
                        {monthSchedule.map((item) => (
                          <div key={item.week} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-md border border-[#e0d3bf] bg-[#fbf6ec] p-3">
                            <div className="text-xs font-semibold text-[#7d6f59]">{item.week}</div>
                            <div className="text-sm font-semibold">{item.title}</div>
                            <div className="rounded-full bg-[#efe5d4] px-2 py-1 font-mono text-[11px]">{item.count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="min-w-0 border-t border-[#d8cbb8] bg-[#f0e7d8] p-4 xl:border-l xl:border-t-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">タスク</h3>
                      <div className="mt-1 text-xs text-[#7d6f59]">未配置</div>
                    </div>
                    <span className="rounded-full bg-[#e3d7c5] px-2 py-1 font-mono text-xs">{backlogTasks.length}</span>
                  </div>

                  <div className="mt-4">
                    <input
                      placeholder="新しいタスク..."
                      className="h-10 w-full rounded-md border border-[#d8cbb8] bg-[#fffdf8] px-3 text-sm outline-none focus:border-[#9f8a67]"
                    />
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {["30m", "45m", "60m", "90m"].map((duration) => (
                        <button
                          key={duration}
                          className={`h-8 rounded-md border border-[#d8cbb8] text-xs font-semibold ${duration === "60m" ? "bg-[#211e18] text-white" : "bg-[#fffdf8] text-[#6d604c]"}`}
                        >
                          {duration}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {backlogTasks.map((task) => (
                      <div key={task.title} className="rounded-md border border-[#647aa5] bg-[#d9e1ef] p-3 shadow-sm">
                        <div className="line-clamp-2 text-sm font-semibold text-[#14213f]">{task.title}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-[#51617d]">
                          {task.owner ? <span className="rounded border border-[#8798b8] bg-[#eef3fb] px-1.5">{task.owner}</span> : null}
                          {task.date ? <span>{task.date}</span> : null}
                          <span>{task.minutes}分</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
