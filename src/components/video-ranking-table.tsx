"use client";

import { useState } from "react";
import Link from "next/link";
import { QueueButton } from "@/components/queue-button";
import { StatusForm } from "@/components/status-form";
import { formatCompact, formatDate } from "@/lib/format";
import type { DashboardVideo } from "@/lib/types";

function deltaTone(value: number) {
  if (value > 0) return "text-emerald-700 bg-emerald-50";
  if (value < 0) return "text-red-700 bg-red-50";
  return "text-zinc-600 bg-zinc-100";
}

export function VideoRankingTable({
  videos,
  disabled,
}: {
  videos: DashboardVideo[];
  disabled?: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(10);
  const visibleVideos = videos.slice(0, visibleCount);
  const remaining = Math.max(0, videos.length - visibleCount);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-y border-[#e5e7eb] bg-[#f3f4f6] text-xs font-semibold text-[#52525b]">
            <tr>
              <th className="px-4 py-3">動画</th>
              <th className="px-4 py-3 text-right">再生</th>
              <th className="px-4 py-3">増加</th>
              <th className="px-4 py-3">公開日</th>
              <th className="px-4 py-3">起こし</th>
              <th className="px-4 py-3">制作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e7edf3]">
            {visibleVideos.map((video) => (
              <tr key={video.id} className="align-middle transition hover:bg-[#f8fbff]">
                <td className="max-w-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="h-12 w-20 shrink-0 rounded border border-[#d7dee8] object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded border border-[#d7dee8] bg-[#eef3f8] text-[10px] font-semibold text-[#7c8797]">
                        no image
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link href={`/videos/${video.id}`} className="line-clamp-2 font-semibold text-[#172033] hover:underline">
                        {video.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                        <span>{video.channelName}</span>
                        <span>•</span>
                        <span>{video.durationText ?? "尺不明"}</span>
                        {video.themeSummary ? <span className="truncate">• {video.themeSummary}</span> : null}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatCompact(video.latestViews)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 font-mono text-xs ${deltaTone(video.sevenDayAverageGrowth)}`}>
                    {formatCompact(video.sevenDayAverageGrowth)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#667085]">{formatDate(video.publishedOn)}</td>
                <td className="px-4 py-3">
                  {video.hasTranscript ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      済
                    </span>
                  ) : video.hasTranscriptJob ? (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                      処理中
                    </span>
                  ) : (
                    <QueueButton endpoint="/api/transcripts/enqueue" payload={{ videoId: video.videoId, url: video.url }} variant="light">
                      起こす
                    </QueueButton>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusForm videoId={video.id} status={video.productionStatus} disabled={disabled} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e7edf3] bg-[#fbfdff] px-4 py-3">
        <div className="text-xs text-[#667085]">
          {videos.length ? `${visibleVideos.length} / ${videos.length} 件を表示` : "表示できる動画がありません"}
        </div>
        {remaining ? (
          <button
            type="button"
            onClick={() => setVisibleCount((current) => Math.min(current + 10, videos.length))}
            className="h-9 rounded-md border border-[#cfd8e3] bg-white px-4 text-xs font-semibold text-[#334155] hover:bg-[#f5f8fc]"
          >
            もう10件出す
          </button>
        ) : null}
      </div>
    </>
  );
}
