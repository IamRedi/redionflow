import { expect, it } from "vitest";

import { parsePlatformGuide, searchPlatformGuide, steelPlatformGuide } from "./platform-guide";
import { assistantHowToQuestion } from "./grounding";

it("parses every topic of the steel guide with roles and search words", () => {
  const topics = steelPlatformGuide();
  expect(topics.length).toBeGreaterThan(20);
  for (const topic of topics) {
    expect(topic.id).toMatch(/^[a-z0-9-]+$/);
    expect(topic.who, topic.id).not.toBe("");
    expect(topic.words.length, topic.id).toBeGreaterThan(2);
    expect(topic.body.length, topic.id).toBeGreaterThan(40);
  }
  expect(new Set(topics.map(t => t.id)).size).toBe(topics.length);
  expect(topics.some(t => t.id === "not-available")).toBe(true);
});

it("finds the right topic for real questions in Albanian, German and English", () => {
  const topics = steelPlatformGuide();
  const first = (q: string) => searchPlatformGuide(topics, q)[0]?.id;
  expect(first("Si ta konfirmoj prerjen e një elementi?")).toBe("element-lists");
  expect(first("si të kërkoj pushim")).toBe("vacation");
  expect(first("Ku i shoh dokumentet e fazës piketim?")).toBe("phase-documents");
  expect(first("Wie beantrage ich Urlaub?")).toBe("vacation");
  expect(first("how do I change the language")).toBe("language");
  expect(first("si e hap aksesin në AI për Arbenin")).toBe("ai-access");
  expect(searchPlatformGuide(topics, "a mund të llogaris rrogat e punëtorëve automatikisht")).toEqual([]);
});

it("ignores malformed headings", () => {
  expect(parsePlatformGuide("# T\n\n## bad heading\ntext\n## ok | Fine\nWho: all\nWords: a, b\nbody text")).toEqual([
    { id: "ok", title: "Fine", who: "all", words: ["a", "b"], body: "body text" },
  ]);
});

it("detects how-to questions, not data questions", () => {
  expect(assistantHowToQuestion("si te shtoj nje punetor te ri")).toBe(true);
  expect(assistantHowToQuestion("ku e gjej listen e fabrikes")).toBe(true);
  expect(assistantHowToQuestion("how do i upload a document")).toBe(true);
  expect(assistantHowToQuestion("sa kg u prene dje")).toBe(false);
  expect(assistantHowToQuestion("si ecen kantieri pllum")).toBe(false);
});
