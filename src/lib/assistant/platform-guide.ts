import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The platform how-to guide the assistant explains from
 * (docs/assistant/STEEL_PLATFORM_GUIDE.md). Each topic is `## id | title`,
 * then `Who:` and `Words:` lines, then the steps.
 */
export type GuideTopic = { id: string; title: string; who: string; words: string[]; body: string };

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function parsePlatformGuide(markdown: string): GuideTopic[] {
  const topics: GuideTopic[] = [];
  for (const chunk of markdown.split(/^## /m).slice(1)) {
    const [heading, ...rest] = chunk.split("\n");
    const match = /^([a-z0-9-]+)\s*\|\s*(.+)$/.exec(heading.trim());
    if (!match) continue;
    let who = "";
    let words: string[] = [];
    const body: string[] = [];
    for (const line of rest) {
      if (line.startsWith("Who:")) who = line.slice(4).trim();
      else if (line.startsWith("Words:")) words = line.slice(6).split(",").map(w => fold(w.trim())).filter(Boolean);
      else body.push(line);
    }
    topics.push({ id: match[1], title: match[2].trim(), who, words, body: body.join("\n").trim() });
  }
  return topics;
}

let cached: GuideTopic[] | null = null;

export function steelPlatformGuideText() {
  return readFileSync(path.join(process.cwd(), "docs", "assistant", "STEEL_PLATFORM_GUIDE.md"), "utf8");
}

export function steelPlatformGuide() {
  cached ??= parsePlatformGuide(steelPlatformGuideText());
  return cached;
}

/** Best topics for a question: search words and title words, longest match first. */
export function searchPlatformGuide(topics: GuideTopic[], query: string, limit = 3) {
  const text = fold(query);
  const tokens = new Set(text.split(/[^\p{L}\p{N}/]+/u).filter(token => token.length > 2));
  const scored = topics.filter(topic => topic.id !== "not-available").map(topic => {
    let score = 0;
    for (const word of topic.words) {
      if (word.includes(" ") ? text.includes(word) : tokens.has(word)) score += word.length > 6 ? 3 : 2;
      else if (word.length > 5 && [...tokens].some(token => token.startsWith(word.slice(0, 6)))) score += 1;
    }
    for (const word of fold(topic.title).split(/\W+/)) if (word.length > 3 && tokens.has(word)) score += 1;
    return { topic, score };
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(entry => entry.topic);
}
