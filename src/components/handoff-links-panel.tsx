"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Link2, Plus, Trash2, X } from "lucide-react";

type HandoffLinkItem = {
  id?: string;
  title: string;
  href: string;
  category: string;
  note: string;
};

export function HandoffLinksPanel({ links }: { links: HandoffLinkItem[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(links);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [href, setHref] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function addLink() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/notion/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, href, note }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "リンクの保存に失敗しました。");
      setItems((current) => [data.link, ...current]);
      setTitle("");
      setHref("");
      setNote("");
      setModalOpen(false);
      setOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "リンクの保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLink(item: HandoffLinkItem) {
    if (!item.id) {
      setItems((current) => current.filter((link) => link !== item));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/notion/links/${item.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "リンクの削除に失敗しました。");
      setItems((current) => current.filter((link) => link.id !== item.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "リンクの削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-[#d8cbb8] bg-[#fbfaf6] p-4 text-[#241f17] shadow-sm">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
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
            {items.length} links
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setModalOpen(true);
            }}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#211e18] bg-[#211e18] px-3 text-xs font-semibold text-[#fff7e6] shadow-sm transition hover:bg-[#3a3329]"
          >
            <Plus className="size-3.5" />
            追加
          </button>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#cbb89b] bg-[#efe5d4] px-3 text-xs font-semibold text-[#5f4f3b] transition hover:bg-[#e5d6be]"
          >
            {open ? "閉じる" : "開く"}
            <ChevronDown className={`size-3.5 transition ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.id ?? item.title} className="group rounded-md border border-[#d8cbb8] bg-[#fffaf1] p-3 transition hover:border-[#bba98f] hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a href={item.href} target="_blank" rel="noreferrer" className="line-clamp-1 text-sm font-semibold text-[#241f17] hover:underline">
                    {item.title}
                  </a>
                  <div className="mt-2 line-clamp-2 text-xs text-[#7d6f59]">{item.note}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a href={item.href} target="_blank" rel="noreferrer" aria-label={`${item.title}を開く`}>
                    <ExternalLink className="size-4 text-[#9d8b72] transition group-hover:text-[#211e18]" />
                  </a>
                  <button
                    type="button"
                    onClick={() => deleteLink(item)}
                    disabled={busy}
                    className="rounded p-1 text-[#9d8b72] hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                    aria-label={`${item.title}を削除`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {message ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{message}</div> : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-lg rounded-md border border-[#d8cbb8] bg-[#fffdf8] p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#241f17]">引き継ぎリンクを追加</h3>
                <p className="mt-1 text-xs text-[#7d6f59]">仕事で使うURLを登録してNotionに保存します。</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-[#d8cbb8] bg-white p-2 text-[#6d604c]">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-[#6d604c]">リンク名</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#d8cbb8] bg-white px-3 text-sm" placeholder="例: 参考資料" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#6d604c]">URL</span>
                <input value={href} onChange={(event) => setHref(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#d8cbb8] bg-white px-3 text-sm" placeholder="https://..." />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#6d604c]">メモ</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-[#d8cbb8] bg-white px-3 py-2 text-sm" placeholder="用途や補足" />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="h-9 rounded-md border border-[#d8cbb8] bg-white px-4 text-xs font-semibold text-[#6d604c]">
                キャンセル
              </button>
              <button type="button" onClick={addLink} disabled={busy || !title.trim() || !href.trim()} className="h-9 rounded-md bg-[#211e18] px-4 text-xs font-semibold text-white disabled:opacity-40">
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
