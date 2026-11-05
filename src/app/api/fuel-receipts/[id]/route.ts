import { readFuelFile } from '@/lib/fleet/fuel/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id))
    return new Response('Not found', { status: 404, headers });
  try {
    const file = await readFuelFile(id);
    if (!file) return new Response('Not found', { status: 404, headers });
    return new Response(new Uint8Array(file.data), {
      headers: {
        ...headers,
        'Content-Type': file.mime,
        'Content-Length': String(file.data.length),
        'Content-Disposition': `${new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      },
    });
  } catch {
    return new Response('Not found', { status: 404, headers });
  }
}
