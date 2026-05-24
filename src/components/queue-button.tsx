"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function QueueButton({
  endpoint,
  payload,
  children,
  variant = "dark",
}: {
  endpoint: string;
  payload?: Record<string, unknown>;
  children: React.ReactNode;
  variant?: "dark" | "light";
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function run() {
    setState("loading");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    setState(response.ok ? "done" : "error");
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={state === "loading" || state === "done"}
      className={
        variant === "dark"
          ? "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-60"
          : "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 disabled:opacity-60"
      }
    >
      {state === "loading" && <Loader2 className="size-3.5 animate-spin" />}
      {state === "done" ? "投入済み" : state === "error" ? "失敗" : children}
    </button>
  );
}
