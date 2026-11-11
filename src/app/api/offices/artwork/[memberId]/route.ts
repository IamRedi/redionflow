import { readOfficeArtwork } from '@/lib/offices/artwork';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' };
export async function GET(_request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const data = await readOfficeArtwork((await params).memberId);
    return data ? new Response(new Uint8Array(data), { headers: { ...headers, 'Content-Type': 'image/webp', 'Content-Length': String(data.length) } }) : new Response(null, { status: 404, headers });
  } catch { return new Response(null, { status: 404, headers }); }
}
