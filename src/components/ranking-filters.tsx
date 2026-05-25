"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChannelSummary } from "@/lib/types";

export function RankingFilters({
  channels,
  currentChannel,
  currentTranscript,
  currentQuery,
}: {
  channels: ChannelSummary[];
  currentChannel?: string;
  currentTranscript?: string;
  currentQuery?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(next: { channel?: string; transcript?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const q = currentQuery?.trim();
    if (q) params.set("q", q);

    if (next.channel !== undefined) {
      next.channel ? params.set("channel", next.channel) : params.delete("channel");
    }
    if (next.transcript !== undefined) {
      next.transcript ? params.set("transcript", next.transcript) : params.delete("transcript");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function toggleTranscript(value: "done" | "missing") {
    update({ transcript: currentTranscript === value ? "" : value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={currentChannel ?? ""}
        onChange={(event) => update({ channel: event.target.value })}
        className="h-9 min-w-40 rounded-md border border-[#cfd8e3] bg-white px-2 text-xs text-[#172033]"
      >
        <option value="">全チャンネル</option>
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            {channel.name}
          </option>
        ))}
      </select>

      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-semibold text-[#334155]">
        <input
          type="checkbox"
          checked={currentTranscript === "done"}
          onChange={() => toggleTranscript("done")}
          className="size-3.5 accent-[#1f2937]"
        />
        文字起こし済み
      </label>
      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-semibold text-[#334155]">
        <input
          type="checkbox"
          checked={currentTranscript === "missing"}
          onChange={() => toggleTranscript("missing")}
          className="size-3.5 accent-[#1f2937]"
        />
        未起こし
      </label>
    </div>
  );
}
