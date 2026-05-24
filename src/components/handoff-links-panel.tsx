"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Link2 } from "lucide-react";

type HandoffLinkItem = {
  title: string;
  href: string;
  category: string;
  note: string;
};

export function HandoffLinksPanel({ links }: { links: HandoffLinkItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-md border border-[#d8cbb8] bg-[#fbfaf6] p-4 text-[#241f17] shadow-sm">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-[#211e18] text-[#f3d27b]">
            <Link2 className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-[#241f17]">引き継ぎリンク</h2>
            <div className="mt-1 text-xs text-[#7d6f59]">仕事で使う資料や共有先にすぐアクセスできます。</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#d8cbb8] bg-[#efe5d4] px-3 py-1 font-mono text-xs font-semibold">
            {links.length} links
          </span>
          <span className="inline-flex h-8 items-center gap-1 rounded-md border border-[#d8cbb8] bg-white px-3 text-xs font-semibold text-[#6d604c]">
            {open ? "閉じる" : "開く"}
            <ChevronDown className={`size-3.5 transition ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>

      {open ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {links.map((item) => (
            <a
              key={item.title}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-md border border-[#d8cbb8] bg-[#fffaf1] p-3 transition hover:border-[#bba98f] hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="line-clamp-1 text-sm font-semibold text-[#241f17]">{item.title}</div>
                  <div className="mt-2 line-clamp-2 text-xs text-[#7d6f59]">{item.note}</div>
                </div>
                <ExternalLink className="mt-0.5 size-4 shrink-0 text-[#9d8b72] transition group-hover:text-[#211e18]" />
              </div>
              <div className="mt-3">
                <span className="rounded-full border border-[#d8cbb8] bg-white px-2 py-1 text-[11px] font-semibold text-[#6d604c]">
                  {item.category}
                </span>
              </div>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
