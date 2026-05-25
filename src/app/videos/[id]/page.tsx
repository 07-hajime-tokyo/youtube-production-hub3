import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, GitBranch } from "lucide-react";
import { QueueButton } from "@/components/queue-button";
import { StatusForm } from "@/components/status-form";
import { requireAppUser } from "@/lib/auth";
import { formatCompact, formatDate } from "@/lib/format";
import { getDashboardData, getVideoDetail } from "@/lib/queries";

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppUser();
  const { id } = await params;
  const [video, dashboard] = await Promise.all([getVideoDetail(id), getDashboardData()]);

  if (!video) notFound();
  const transcriptReady = video.hasTranscript || Boolean(video.transcriptText);

  return (
    <main className="min-h-screen bg-[#f7f6f2] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950">
          <ArrowLeft className="size-4" />
          ダッシュボードへ戻る
        </Link>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
            <div>
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="aspect-video w-full rounded-md border border-zinc-200 object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-500">
                  no image
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 text-sm font-semibold text-zinc-500">{video.channelName}</div>
                  <h1 className="text-2xl font-semibold leading-snug tracking-tight text-zinc-950">{video.title}</h1>
                  {video.themeSummary ? <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">{video.themeSummary}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-semibold"
                  >
                    <ExternalLink className="size-4" />
                    YouTube
                  </a>
                  {transcriptReady ? (
                    <span className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
                      <FileText className="size-4" />
                      起こし済み
                    </span>
                  ) : video.hasTranscriptJob ? (
                    <span className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-50 px-3 text-xs font-semibold text-amber-700">
                      <FileText className="size-4" />
                      処理中
                    </span>
                  ) : (
                    <QueueButton endpoint="/api/transcripts/enqueue" payload={{ videoId: video.videoId, url: video.url }} variant="dark">
                      <FileText className="size-4" />
                      文字起こし
                    </QueueButton>
                  )}
                  <QueueButton endpoint="/api/github/export" payload={{ videoId: video.videoId }} variant="light">
                    <GitBranch className="size-4" />
                    GitHub保存
                  </QueueButton>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">動画ID</div>
                  <div className="mt-1 break-all font-mono text-xs text-zinc-700">{video.videoId}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">公開日</div>
                  <div className="mt-1 text-sm">{formatDate(video.publishedOn)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">最新再生数</div>
                  <div className="mt-1 font-mono text-sm">{formatCompact(video.latestViews)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">尺</div>
                  <div className="mt-1 text-sm">{video.durationText ?? "未取得"}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="rounded-md border border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">制作管理</h2>
              <StatusForm videoId={video.id} status={video.productionStatus} disabled={dashboard.mode === "demo"} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-zinc-50 p-3">
                <div className="text-xs font-semibold text-zinc-500">担当</div>
                <div className="mt-1 text-sm text-zinc-700">{video.assignedTo ?? "未設定"}</div>
              </div>
              <div className="rounded-md bg-zinc-50 p-3">
                <div className="text-xs font-semibold text-zinc-500">期限</div>
                <div className="mt-1 text-sm text-zinc-700">{formatDate(video.dueOn)}</div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-zinc-700">タグ</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {video.tags.length ? (
                  video.tags.slice(0, 20).map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-zinc-500">タグなし</span>
                )}
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-zinc-700">メモ</h3>
              <p className="mt-2 min-h-20 rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
                {video.notes ?? "まだメモはありません。台本、タイトル、サムネ、公開後分析の気づきをここに集約します。"}
              </p>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-md border border-zinc-200 bg-white p-5">
              <h2 className="font-semibold">保存先</h2>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <div className="text-xs font-semibold text-zinc-500">Obsidian</div>
                  <div className="mt-1 break-all font-mono text-xs text-zinc-700">
                    {video.obsidianPath ?? "未保存"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-500">GitHub</div>
                  <div className="mt-1 break-all font-mono text-xs text-zinc-700">
                    {video.githubPath ?? "未保存"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-5">
              <h2 className="font-semibold">運用メモ</h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                <li>未文字起こしならローカルworkerで無料処理。</li>
                <li>Driveシートは読み取り元、Supabaseが正本。</li>
                <li>公開後はCTR、維持率、伸びを分析して次の制作へ戻す。</li>
              </ul>
            </div>
          </aside>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">文字起こし</h2>
              <div className="mt-1 text-xs text-zinc-500">
                {transcriptReady
                  ? `${video.transcriptModel ?? "whisper"} / ${video.transcriptLanguage ?? "言語不明"}`
                  : video.hasTranscriptJob
                    ? "文字起こし処理中です。"
                    : "まだ文字起こしされていません。"}
              </div>
            </div>
            {transcriptReady ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">起こし済み</span>
            ) : video.hasTranscriptJob ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">処理中</span>
            ) : null}
          </div>

          {video.transcriptSummary ? (
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              {video.transcriptSummary}
            </div>
          ) : null}

          {video.transcriptText ? (
            <div className="mt-4 max-h-[560px] overflow-auto rounded-md bg-zinc-950 p-4">
              <pre className="whitespace-pre-wrap text-sm leading-7 text-zinc-50">{video.transcriptText}</pre>
            </div>
          ) : (
            <div className="mt-4 rounded-md bg-zinc-50 p-4 text-sm text-zinc-500">
              文字起こし後、ここに本文が表示されます。
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
