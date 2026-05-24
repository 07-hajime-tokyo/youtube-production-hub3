import { safeFileName, secondsToTimestamp } from "./format";
import type { TranscriptExport } from "./types";

export function buildTranscriptMarkdown(data: TranscriptExport) {
  const lines = data.segments.length
    ? data.segments.map((segment) => `[${secondsToTimestamp(segment.start)}] ${segment.text}`)
    : data.fullText.split("\n").filter(Boolean);

  return `---\ntype: youtube_transcript\ntitle: ${JSON.stringify(data.title)}\nchannel: ${JSON.stringify(data.channelName ?? "")}\nvideo_id: ${JSON.stringify(data.videoId)}\nurl: ${JSON.stringify(data.url)}\npublished: ${JSON.stringify(data.publishedOn ?? "")}\nduration: ${JSON.stringify(data.durationText ?? "")}\ntranscription:\n  engine: faster-whisper\n  model: ${JSON.stringify(data.asrModel)}\n  language: ${JSON.stringify(data.language)}\ntags:\n  - youtube\n  - transcript\n---\n# ${data.title}\n\n[YouTubeで開く](${data.url})\n\n## 要約メモ\n\n${data.summary ? `- ${data.summary}` : "- TODO: 要約・気づき・制作メモを書く"}\n\n## 文字起こし\n\n> 自動文字起こしです。公開字幕ではなく音声から起こしているため、誤変換が含まれる可能性があります。\n\n${lines.join("\n")}\n`;
}

export function obsidianTranscriptFileName(data: TranscriptExport) {
  const date = data.publishedOn || new Date().toISOString().slice(0, 10);
  return `${safeFileName(`${date} ${data.title}`)}.md`;
}

export function githubTranscriptPath(data: TranscriptExport) {
  const date = data.publishedOn || new Date().toISOString().slice(0, 10);
  const [year, month] = date.split("-");
  const title = safeFileName(data.title, 80);
  return `transcripts/${year}/${month}/${date}__${data.videoId}__${title}.md`;
}
