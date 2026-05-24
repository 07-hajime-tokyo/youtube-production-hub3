import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllowedEmails, getBaseUrl, getSupabasePublicConfig } from "@/lib/env";

async function signInWithGoogle() {
  "use server";

  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getBaseUrl()}/auth/callback`,
    },
  });

  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { configured } = getSupabasePublicConfig();
  const params = await searchParams;
  const allowed = getAllowedEmails();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] p-4">
      <section className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">TubeKitにログイン</h1>
            <p className="text-sm text-zinc-500">Googleアカウントでチーム共有ワークスペースに入ります。</p>
          </div>
        </div>

        {params.error ? (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {params.error === "not_allowed"
              ? "このメールアドレスは許可リストにありません。"
              : "ログインに失敗しました。設定を確認してください。"}
          </div>
        ) : null}

        {!configured ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Supabase環境変数が未設定です。ローカルではダッシュボードをデモ表示できます。
          </div>
        ) : null}

        <form action={signInWithGoogle} className="mt-6">
          <button
            disabled={!configured}
            className="h-11 w-full rounded-md bg-zinc-950 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Googleでログイン
          </button>
        </form>

        <Link
          href="/"
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md border border-zinc-200 text-sm font-semibold text-zinc-700"
        >
          デモ画面を見る
        </Link>

        <div className="mt-5 text-xs text-zinc-500">
          <div className="font-semibold text-zinc-700">許可メール</div>
          <div className="mt-1 font-mono">{allowed.length ? allowed.join(", ") : "ALLOWED_EMAILS未設定: 全Googleユーザー許可"}</div>
        </div>
      </section>
    </main>
  );
}
