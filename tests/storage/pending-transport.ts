/** Synthetic provider transport; production staging, journals and cleanup run unchanged. */
export function pendingTransport() {
  const objects = new Map<string, string>();
  const failures = { upload: false, remove: false };
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const pathname = new URL(String(input)).pathname;
    if (pathname.includes("/bucket/")) return Response.json({ public: false });
    if (init?.method === "DELETE" && pathname.includes("/object/")) {
      if (failures.remove) return new Response("synthetic delete outage", { status: 503 });
      const data = JSON.parse(String(init?.body)) as { prefixes: string[] };
      const bucketId = pathname.split("/object/")[1];
      data.prefixes.forEach(key => objects.delete(`${bucketId}/${key}`));
      return Response.json({});
    }
    if (pathname.includes("/object/authenticated/")) {
      const key = pathname.split("/object/authenticated/")[1];
      return objects.has(key) ? new Response(objects.get(key)) : new Response("missing", { status: 404 });
    }
    if (init?.method === "POST" && pathname.includes("/object/")) {
      const key = pathname.split("/object/")[1];
      if (objects.has(key)) return new Response("duplicate", { status: 409 });
      objects.set(key, Buffer.from(init.body as Uint8Array).toString());
      // Deliberately model a provider write followed by an ambiguous failure response.
      if (failures.upload && !key.includes("pending-imports/")) {
        failures.upload = false;
        return new Response("synthetic upload failure after write", { status: 503 });
      }
      return Response.json({});
    }
    throw new Error(`Unexpected synthetic storage request ${pathname}`);
  };
  return { objects, failures, fetcher };
}
