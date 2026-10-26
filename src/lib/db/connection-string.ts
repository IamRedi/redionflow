type ConnectionStringOptions = {
  preferDirect?: boolean;
};

function withLibpqCompat(raw: string): string {
  try {
    const url = new URL(raw);
    const sslmode = url.searchParams.get("sslmode");

    if (sslmode === "require" && !url.searchParams.has("uselibpqcompat")) {
      url.searchParams.set("uselibpqcompat", "true");
    }

    return url.toString();
  } catch {
    if (raw.includes("sslmode=require") && !raw.includes("uselibpqcompat=")) {
      return `${raw}${raw.includes("?") ? "&" : "?"}uselibpqcompat=true`;
    }

    return raw;
  }
}

export function resolveDatabaseConnectionString(options: ConnectionStringOptions = {}) {
  const raw = options.preferDirect
    ? process.env.DIRECT_URL || process.env.DATABASE_URL
    : process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!raw) return undefined;

  return withLibpqCompat(raw);
}
