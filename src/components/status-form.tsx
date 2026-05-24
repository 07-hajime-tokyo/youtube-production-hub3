import { updateProductionStatus } from "@/app/actions";
import { PRODUCTION_STATUSES, type ProductionStatus } from "@/lib/types";

const labels: Record<ProductionStatus, string> = {
  research: "リサーチ",
  script: "台本",
  video: "動画生成",
  title: "タイトル",
  thumbnail: "サムネ",
  scheduled: "予約",
  published: "公開",
  analyzed: "分析済み",
};

export function StatusForm({
  videoId,
  status,
  disabled,
}: {
  videoId: string;
  status: ProductionStatus;
  disabled?: boolean;
}) {
  return (
    <form action={updateProductionStatus} className="flex items-center gap-2">
      <input type="hidden" name="videoId" value={videoId} />
      <select
        name="status"
        defaultValue={status}
        disabled={disabled}
        className="h-8 min-w-28 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-800 outline-none disabled:opacity-60"
      >
        {PRODUCTION_STATUSES.map((item) => (
          <option key={item} value={item}>
            {labels[item]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={disabled}
        className="h-8 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        保存
      </button>
    </form>
  );
}

export function StatusBadge({ status }: { status: ProductionStatus }) {
  const tone: Record<ProductionStatus, string> = {
    research: "bg-sky-50 text-sky-700 ring-sky-100",
    script: "bg-violet-50 text-violet-700 ring-violet-100",
    video: "bg-amber-50 text-amber-700 ring-amber-100",
    title: "bg-lime-50 text-lime-700 ring-lime-100",
    thumbnail: "bg-orange-50 text-orange-700 ring-orange-100",
    scheduled: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    published: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    analyzed: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ${tone[status]}`}>
      {labels[status]}
    </span>
  );
}

