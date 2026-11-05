import { readCompanyAssetFile } from '@/lib/company-assets/files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const file = await readCompanyAssetFile(id);
    return new Response(new Uint8Array(file.bytes), { headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.bytes.length),
      'Content-Disposition': `${file.mime === 'image/webp' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  } catch { return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } }); }
}
