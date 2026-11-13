/** Viewport-sized pages of the same missions. Nothing is dropped or scaled. */
export function sceneLayout(width: number, height: number, count: number) {
  const w = Math.max(1, width), h = Math.max(1, height);
  const compact = h < 420, minimal = h < 340;
  const cardWidth = Math.min(w - 24, w < 350 ? 240 : w < 640 ? Math.min(172, Math.max(164, Math.floor((w - 38) / 2))) : 240);
  const top = 56, bottom = 48;
  const cardHeight = Math.max(44, Math.min(minimal ? 104 : compact ? 196 : w < 640 ? 272 : 286, h - top - bottom));
  const columns = Math.max(1, Math.min(3, Math.floor((w - 10) / (cardWidth + 14))));
  const rows = Math.max(1, Math.min(2, Math.floor((h - top - bottom + 14) / (cardHeight + 14))));
  const capacity = columns * rows;
  const shown = Math.min(count, capacity), usedColumns = Math.min(columns, Math.max(1, shown));
  const usedRows = Math.max(1, Math.ceil(shown / columns));
  const left = Math.max(12, Math.round((w - usedColumns * cardWidth - (usedColumns - 1) * 20) / 2));
  return { columns, capacity, cardWidth, cardHeight, compact, minimal, left, top,
    columnGap: cardWidth + 20, rowGap: cardHeight + 14, height: h,
    maxX: Math.max(12, w - cardWidth - 12), maxY: Math.max(top, h - cardHeight - bottom),
    startY: Math.max(top, Math.round((h - bottom - usedRows * cardHeight - (usedRows - 1) * 14 + top) / 2)),
  };
}
