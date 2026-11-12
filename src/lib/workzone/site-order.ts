type Site = { id: string; name: string; activeLiveCount: number; liveSince: string | null };

/** Active crews first; idle sites are alphabetical, irrespective of edit time. */
export function orderWorkzoneSites<T extends Site>(sites: T[], locale = "de") {
  const names = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  return [...sites].sort((a, b) => {
    const aLive = a.activeLiveCount > 0, bLive = b.activeLiveCount > 0;
    if (aLive !== bLive) return Number(bLive) - Number(aLive);
    if (aLive && bLive) {
      const time = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
      const recent = time(b.liveSince) - time(a.liveSince);
      if (recent) return recent;
    }
    return names.compare(a.name, b.name) || a.id.localeCompare(b.id);
  });
}
