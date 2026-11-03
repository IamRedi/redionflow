/**
 * Address → map point, on the server, so a site lands on the map the moment
 * its address is saved (instead of each browser guessing it again).
 * OpenStreetMap Nominatim: one request, short timeout, null when unsure.
 */
export type MapPoint = { lat: number; lng: number };

const COUNTRY_CODES: Record<string, string> = { AL: "al", DE: "de", XK: "xk", MK: "mk", IT: "it", AT: "at", CH: "ch" };

export async function geocodeAddress(address: string, country: string | null, fetcher: typeof fetch = fetch): Promise<MapPoint | null> {
  const query = address.replace(/\s+/g, " ").trim();
  if (query.length < 3) return null;
  const params = new URLSearchParams({ format: "json", limit: "1", q: query });
  const code = country ? COUNTRY_CODES[country.toUpperCase()] : undefined;
  if (code) params.set("countrycodes", code);
  try {
    const response = await fetcher(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "RediOnFlow/1.0 (site map)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const lat = Number(rows?.[0]?.lat);
    const lng = Number(rows?.[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
