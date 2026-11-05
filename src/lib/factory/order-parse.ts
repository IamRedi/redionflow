/**
 * Reads a supplier order (text taken from its PDF) into a draft the office
 * checks before saving: which construction site it is for, the site address
 * and the material lines. Supplier PDFs differ, so this only guesses from
 * common labels (Albanian, German, English); the office corrects the draft.
 */

import type { ProductionUnit } from "./production";

export type OrderLine = { title: string; quantity: number | null; unit: ProductionUnit; price: number | null };

export type OrderDraft = {
  supplier: string;
  reference: string;
  siteName: string;
  address: string;
  client: string;
  total: number | null;
  currency: string;
  lines: OrderLine[];
};

const LABELS = {
  site: /^(kantieri|objekti|projekti|projekt|baustelle|bauvorhaben|site|project|për kantierin|per kantierin)\b/i,
  address: /^(adresa(?: e kantierit| e dorëzimit| e dorezimit)?|vendndodhja|lieferadresse|adresse|address|delivery address)\b/i,
  client: /^(klienti|porositësi|porositesi|kunde|auftraggeber|client|customer)\b/i,
  supplier: /^(furnitori|furnizuesi|lieferant|supplier|vendor)\b/i,
  reference: /^(nr\.?\s*(?:i\s*)?porosi[së]?[e]?|porosia\s*nr\.?|porosi\s*nr\.?|bestell(?:ung|nummer)(?:\s*nr\.?)?|order\s*(?:no\.?|nr\.?|number|#)|nr\.?\s*porosie)\b/i,
  total: /^(totali(?: me tvsh| pa tvsh)?|shuma(?: totale)?|gesamt(?:summe|betrag)?|summe|total(?: amount)?)\b/i,
};

const UNIT_PATTERN = "(ton[eë]?|t|kg|cop[eëa]|pcs|stk|st\\.?|m2|m²|ml|m)";
const QTY_UNIT = new RegExp(`(?<![\\d.,])(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)\\s*${UNIT_PATTERN}(?![\\p{L}\\d])`, "giu");

/** The ordered amount: weight, pieces or area win over a length inside the description ("L=7,5 m"). */
function pickQuantity(line: string) {
  const matches = [...line.matchAll(QTY_UNIT)];
  if (matches.length === 0) return null;
  return matches.find((m) => normalizeUnit(m[2]!) !== "m") ?? matches[matches.length - 1]!;
}

export function normalizeUnit(raw: string): ProductionUnit {
  const u = raw.toLowerCase().replace(".", "");
  if (u === "kg") return "kg";
  if (u === "m2" || u === "m²") return "m2";
  if (u === "m" || u === "ml") return "m";
  if (/^(cop|pcs|stk|st)/.test(u)) return "pcs";
  return "t";
}

/** "1.234,50", "1,234.50", "1 234,5", "12.5" → number. */
export function parseNumber(raw: string): number | null {
  let text = raw.trim().replace(/\s+/g, "");
  if (!text || !/\d/.test(text)) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // The later separator is the decimal one.
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = text.length - lastComma - 1;
    text = decimals === 3 && text.indexOf(",") === lastComma && text.length > 4 ? text.replace(",", "") : text.replace(/,/g, ".");
  } else if (lastDot > -1) {
    const parts = text.split(".");
    // "1.250" with three digits after one dot is a thousands separator.
    if (parts.length > 2 || (parts.length === 2 && parts[1]!.length === 3 && parts[0]!.length <= 3 && parts[0] !== "0")) text = parts.join("");
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function valueAfterLabel(line: string, label: RegExp) {
  const match = line.match(label);
  if (!match) return null;
  return line.slice(match[0].length).replace(/^\s*[:#\-–.]?\s*/, "").trim();
}

const MONEY = /(\d{1,3}(?:[ .,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(lek|all|eur|€|euro)?/gi;

function currencyOf(text: string) {
  if (/€|\beur/i.test(text)) return "EUR";
  if (/\b(lek|all)\b/i.test(text)) return "ALL";
  return "";
}

export function parseOrderText(text: string): OrderDraft {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const draft: OrderDraft = { supplier: "", reference: "", siteName: "", address: "", client: "", total: null, currency: "", lines: [] };

  for (const line of lines) {
    const site = valueAfterLabel(line, LABELS.site);
    if (site !== null) {
      if (!draft.siteName && site) draft.siteName = site;
      continue;
    }
    const address = valueAfterLabel(line, LABELS.address);
    if (address !== null) {
      if (!draft.address && address) draft.address = address;
      continue;
    }
    const client = valueAfterLabel(line, LABELS.client);
    if (client !== null) {
      if (!draft.client && client) draft.client = client;
      continue;
    }
    const supplier = valueAfterLabel(line, LABELS.supplier);
    if (supplier !== null) {
      if (!draft.supplier && supplier) draft.supplier = supplier;
      continue;
    }
    const reference = valueAfterLabel(line, LABELS.reference);
    if (reference !== null) {
      if (!draft.reference && reference) draft.reference = reference.split(/\s+/)[0] ?? "";
      continue;
    }
    const total = valueAfterLabel(line, LABELS.total);
    if (total !== null) {
      const amounts = [...total.matchAll(MONEY)].map((m) => parseNumber(m[1]!)).filter((n): n is number => n !== null);
      if (amounts.length) draft.total = amounts[amounts.length - 1]!;
      draft.currency = draft.currency || currencyOf(total);
      continue;
    }

    const qty = pickQuantity(line);
    if (!qty || qty.index === undefined) continue;
    const quantity = parseNumber(qty[1]!);
    const before = line.slice(0, qty.index).replace(/^\s*\d{1,3}[.)]?\s+/, "").trim();
    const after = line.slice(qty.index + qty[0].length).trim();
    const title = before.replace(/[|;:,\-–]+$/, "").trim();
    if (!title || title.length < 2) continue;
    const prices = [...after.matchAll(MONEY)].map((m) => parseNumber(m[1]!)).filter((n): n is number => n !== null);
    draft.currency = draft.currency || currencyOf(after);
    draft.lines.push({
      title: title.slice(0, 160),
      quantity,
      unit: normalizeUnit(qty[2]!),
      // The last amount on a line is the line total.
      price: prices.length ? prices[prices.length - 1]! : null,
    });
  }

  if (!draft.supplier) {
    const first = lines.find((line) => /[\p{L}]{3,}/u.test(line) && !/porosi|order|bestell/i.test(line));
    draft.supplier = first?.slice(0, 120) ?? "";
  }
  if (draft.total === null && draft.lines.length > 0 && draft.lines.every((line) => line.price !== null)) {
    draft.total = Math.round(draft.lines.reduce((sum, line) => sum + (line.price ?? 0), 0) * 100) / 100;
  }
  return draft;
}

/** Same site when the names match ignoring case, spaces and Albanian ë/ç. */
export function sameSiteName(a: string, b: string) {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return norm(a) !== "" && norm(a) === norm(b);
}
