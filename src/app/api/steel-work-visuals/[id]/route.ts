import { readSteelWorkVisual } from '@/lib/steel-work/media';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'none'; sandbox" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const visual = await readSteelWorkVisual((await params).id);
    return visual ? new Response(visual.data, { headers: { ...headers, 'Content-Type': visual.mime, 'Content-Length': String(visual.data.length) } }) : new Response(null, { status: 404, headers });
  } catch { return new Response(null, { status: 404, headers }); }
}
