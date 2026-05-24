import { getNotionConfig } from "@/lib/env";

type NotionProperty =
  | { type: "title"; title?: { plain_text?: string }[] }
  | { type: "rich_text"; rich_text?: { plain_text?: string }[] }
  | { type: "select"; select?: { name?: string } | null }
  | { type: "date"; date?: { start?: string; end?: string | null } | null }
  | { type: "number"; number?: number | null }
  | { type: "checkbox"; checkbox?: boolean }
  | { type: "url"; url?: string | null };

type NotionPage = {
  id: string;
  properties: Record<string, NotionProperty | undefined>;
};

type NotionQueryResponse = {
  results?: NotionPage[];
};

type NotionPageResponse = NotionPage & {
  url?: string;
};

export type NotionTask = {
  id: string;
  title: string;
  status: string;
  stage: string;
  date: string;
  due: string;
  end: string;
  owner: string;
  minutes: number;
  priority: string;
  display: string;
  pinned: boolean;
  href?: string;
  note?: string;
};

export type NotionTaskInput = {
  title: string;
  status?: string;
  stage?: string;
  date?: string;
  due?: string;
  end?: string;
  owner?: string;
  minutes?: number;
  priority?: string;
  display?: string;
  pinned?: boolean;
  href?: string;
  note?: string;
};

export type NotionHandoffLink = {
  id: string;
  title: string;
  href: string;
  category: string;
  note: string;
  pinned: boolean;
  useToday: boolean;
  priority: string;
};

export type NotionWorkspaceData = {
  tasks: NotionTask[];
  todayTasks: NotionTask[];
  handoffLinks: NotionHandoffLink[];
};

function textFromProperty(property?: NotionProperty) {
  if (!property) return "";
  if (property.type === "title") return property.title?.map((item) => item.plain_text ?? "").join("") ?? "";
  if (property.type === "rich_text") return property.rich_text?.map((item) => item.plain_text ?? "").join("") ?? "";
  if (property.type === "select") return property.select?.name ?? "";
  if (property.type === "date") return property.date?.start ?? "";
  if (property.type === "url") return property.url ?? "";
  if (property.type === "number") return property.number?.toString() ?? "";
  return "";
}

function numberFromProperty(property?: NotionProperty) {
  return property?.type === "number" && typeof property.number === "number" ? property.number : 0;
}

function checkedFromProperty(property?: NotionProperty) {
  return property?.type === "checkbox" ? Boolean(property.checkbox) : false;
}

function tokyoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
}

function getNotionHeaders() {
  const { token } = getNotionConfig();
  if (!token) throw new Error("Notion token is not configured.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
}

async function notionRequest<T>(path: string, init: RequestInit) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: getNotionHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Notion request failed: ${response.status} ${message}`);
  }

  return (await response.json()) as T;
}

async function queryDatabase(databaseId: string) {
  const data = await notionRequest<NotionQueryResponse>(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({ page_size: 100 }),
  });
  return data.results ?? [];
}

function mapTask(page: NotionPageResponse): NotionTask {
  const properties = page.properties;
  return {
    id: page.id,
    title: textFromProperty(properties["タスク名"]) || "無題のタスク",
    status: textFromProperty(properties["ステータス"]) || "未着手",
    stage: textFromProperty(properties["工程"]) || "未分類",
    date: textFromProperty(properties["日付"]),
    due: textFromProperty(properties["開始"]) || "--:--",
    end: textFromProperty(properties["終了"]),
    owner: textFromProperty(properties["担当者"]) || "未 assigned",
    minutes: numberFromProperty(properties["予定分"]),
    priority: textFromProperty(properties["優先度"]) || "中",
    display: textFromProperty(properties["表示"]) || "未配置",
    pinned: checkedFromProperty(properties["固定表示"]),
    href: textFromProperty(properties["関連URL"]) || undefined,
    note: textFromProperty(properties["メモ"]) || undefined,
  };
}

function richText(content?: string) {
  return content ? [{ text: { content } }] : [];
}

function taskProperties(input: NotionTaskInput) {
  return {
    "タスク名": { title: richText(input.title || "無題のタスク") },
    "ステータス": { select: { name: input.status || "未着手" } },
    "工程": { select: { name: input.stage || "その他" } },
    "日付": input.date ? { date: { start: input.date } } : { date: null },
    "開始": { rich_text: richText(input.due) },
    "終了": { rich_text: richText(input.end) },
    "担当者": { rich_text: richText(input.owner) },
    "予定分": { number: input.minutes ?? 60 },
    "優先度": { select: { name: input.priority || "中" } },
    "表示": { select: { name: input.display || (input.date ? "通常" : "未配置") } },
    "固定表示": { checkbox: Boolean(input.pinned) },
    "関連URL": { url: input.href || null },
    "メモ": { rich_text: richText(input.note) },
  };
}

export async function createNotionTask(input: NotionTaskInput) {
  const config = getNotionConfig();
  if (!config.tasksDatabaseId) throw new Error("Notion schedule database is not configured.");

  const page = await notionRequest<NotionPageResponse>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: config.tasksDatabaseId },
      properties: taskProperties(input),
    }),
  });

  return mapTask(page);
}

export async function updateNotionTask(id: string, input: NotionTaskInput) {
  const page = await notionRequest<NotionPageResponse>(`/pages/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: taskProperties(input) }),
  });

  return mapTask(page);
}

export async function deleteNotionTask(id: string) {
  await notionRequest<NotionPageResponse>(`/pages/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
}

function mapHandoffLink(page: NotionPage): NotionHandoffLink {
  const properties = page.properties;
  return {
    id: page.id,
    title: textFromProperty(properties["リンク名"]) || "無題のリンク",
    href: textFromProperty(properties["リンク"]) || "https://www.notion.so/",
    category: textFromProperty(properties["カテゴリ"]) || "その他",
    note: textFromProperty(properties["説明"]),
    pinned: checkedFromProperty(properties["固定表示"]),
    useToday: checkedFromProperty(properties["今日使う"]),
    priority: textFromProperty(properties["優先度"]) || "中",
  };
}

export async function getNotionWorkspaceData(): Promise<NotionWorkspaceData | null> {
  const config = getNotionConfig();
  if (!config.configured || !config.tasksDatabaseId || !config.linksDatabaseId) return null;

  try {
    const [taskPages, linkPages] = await Promise.all([
      queryDatabase(config.tasksDatabaseId),
      queryDatabase(config.linksDatabaseId),
    ]);

    const tasks = taskPages.map(mapTask);
    const today = tokyoDateKey();
    const todayTasks = tasks.filter((task) => task.date === today);
    const handoffLinks = linkPages.map(mapHandoffLink).filter((link) => link.pinned || link.useToday);

    return {
      tasks,
      todayTasks,
      handoffLinks,
    };
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "Notion sync failed");
    return null;
  }
}
