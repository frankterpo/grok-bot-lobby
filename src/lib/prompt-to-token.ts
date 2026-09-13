import { isTokenStatus, type TokenStatus } from "@/lib/domain";
import { truncateTaskLabel } from "@/lib/token-utils";

export type PromptTokenIntent = {
  taskLabel: string;
  status: TokenStatus;
  focus?: string;
};

const STATUS_PATTERNS: Array<{ status: TokenStatus; pattern: RegExp }> = [
  { status: "done", pattern: /\b(done|finished|shipped|complete[d]?)\b/i },
  { status: "waiting", pattern: /\b(waiting|blocked|paused|hold)\b/i },
  { status: "idle", pattern: /\b(idle|afk|resting|away)\b/i },
  { status: "working", pattern: /\b(working|building|fixing|coding|animat)/i },
];

function stripStatusWords(text: string): string {
  return text
    .replace(/^(i['’]m|i am|we['’]re|we are)\s+/i, "")
    .replace(/\b(status|task)\s*[:=]\s*/gi, "")
    .replace(/\b(done|finished|shipped|completed?|waiting|blocked|paused|hold|idle|afk|resting|away|working on|working|building|fixing|coding)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseGrokPrompt(prompt: string, fallbackLabel = "Lobby task"): PromptTokenIntent {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { taskLabel: fallbackLabel, status: "working" };
  }

  const explicit = trimmed.match(/\bstatus\s*[:=]\s*(working|done|waiting|idle)\b/i);
  const statusFromExplicit = explicit?.[1] && isTokenStatus(explicit[1].toLowerCase())
    ? (explicit[1].toLowerCase() as TokenStatus)
    : null;

  let status: TokenStatus = "working";
  if (statusFromExplicit) {
    status = statusFromExplicit;
  } else {
    for (const item of STATUS_PATTERNS) {
      if (item.pattern.test(trimmed)) {
        status = item.status;
        break;
      }
    }
  }

  const labelSource = stripStatusWords(trimmed) || fallbackLabel;
  const taskLabel = truncateTaskLabel(labelSource) || fallbackLabel;
  return {
    taskLabel,
    status,
    focus: trimmed.length > taskLabel.length ? truncateTaskLabel(trimmed) : undefined,
  };
}
