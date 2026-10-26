const CODE39_PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

const CODE39_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";

export function normalizeBarcodeInput(value: string) {
  return value.trim().toUpperCase().replace(/[^0-9A-Z.\- $/+%]/g, "");
}

export function generateInventoryBarcode(seed?: string) {
  const base = normalizeBarcodeInput(seed || "").replace(/\*/g, "");
  if (base) return base.slice(0, 24);

  const stamp = new Date().toISOString().replace(/\D/g, "").slice(2, 14);
  const random = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return `INV-${stamp}-${random}`.slice(0, 24);
}

export function barcodeSupportsCode39(value: string) {
  return normalizeBarcodeInput(value)
    .split("")
    .every((char) => CODE39_ALPHABET.includes(char));
}

export function buildCode39Bars(rawValue: string) {
  const value = normalizeBarcodeInput(rawValue);
  if (!value || !barcodeSupportsCode39(value)) return [];

  const framed = `*${value}*`;
  const bars: Array<{ x: number; width: number }> = [];
  let cursor = 0;

  for (const char of framed) {
    const pattern = CODE39_PATTERNS[char];
    if (!pattern) return [];
    pattern.split("").forEach((token, index) => {
      const width = token === "w" ? 3 : 1;
      const isBar = index % 2 === 0;
      if (isBar) bars.push({ x: cursor, width });
      cursor += width;
    });
    cursor += 1;
  }

  return bars;
}

export function barcodeStatusLabel(input: {
  isPrivate: boolean;
  assignedWorkerName?: string | null;
}) {
  if (input.isPrivate) return "PRIVATE";
  if (input.assignedWorkerName) return "ASSIGNED";
  return "IN_STOCK";
}
