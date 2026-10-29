import type { QuickCommand } from "@/config/site";

export type CommandHit = {
  command: QuickCommand;
  /** 关键词（可能为空） */
  query: string;
};

/**
 * 解析快捷指令（PRD 4.1）
 * 规则：输入以「指令 + 空格」开头，或以指令本身结尾（无关键词）时命中。
 * 例："/g react hooks" → GitHub 搜 "react hooks"；"/g" → 直接打开 GitHub 首页。
 * 指令按长度倒序匹配，避免 "/b" 抢在 "/bili" 之前命中。
 */
export function parseCommand(input: string, commands: QuickCommand[]): CommandHit | null {
  const raw = input.trimStart();
  if (!raw.startsWith("/")) return null;

  const sorted = [...commands].sort((a, b) => b.key.length - a.key.length);
  for (const command of sorted) {
    const key = command.key;
    if (!key.startsWith("/")) continue;
    if (raw.toLowerCase().startsWith(key.toLowerCase())) {
      const rest = raw.slice(key.length);
      // 指令后面必须是空白或字符串结束
      if (rest.length === 0) return { command, query: "" };
      if (!/^\s/.test(rest)) continue;
      return { command, query: rest.trim() };
    }
  }
  return null;
}

/** 用关键词填充 URL 模板，无关键词时返回站点首页 */
export function resolveCommandUrl(hit: CommandHit): string {
  const { command, query } = hit;
  if (!query) return command.siteUrl;
  if (command.url.includes("{q}")) {
    return command.url.replace("{q}", encodeURIComponent(query));
  }
  return command.siteUrl;
}

/** 引擎 URL 填充 */
export function resolveSearchUrl(template: string, query: string): string {
  return template.replace("{q}", encodeURIComponent(query));
}

/** 判断输入是否像一个完整 URL（用于「输入网址直接跳转」） */
export function asDirectUrl(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^https?:\/\/[^\s]+$/i.test(value)) return value;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(value) && /\.(com|cn|net|org|io|dev|app|co|me|xyz|top|tv|info|edu|gov)(\/|$)/i.test(value)) {
    return `https://${value}`;
  }
  return null;
}

/** 指令提示：输入 "/" 开头时给出匹配列表 */
export function commandSuggestions(input: string, commands: QuickCommand[]): QuickCommand[] {
  const raw = input.trimStart().toLowerCase();
  if (!raw.startsWith("/")) return [];
  return commands.filter((c) => c.key.toLowerCase().startsWith(raw.split(/\s/)[0]));
}
