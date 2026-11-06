import { NextResponse } from 'next/server';
import { installationBrand } from '@/lib/installation-brand';
import { installationIcon } from '@/lib/installation-icon';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ size: string }> }) {
  const size = Number((await context.params).size);
  if (![48, 180, 192, 512].includes(size)) return new Response(null, { status: 404 });
  const brand = await installationBrand();
  if (!brand) return NextResponse.redirect(new URL(`/branding/logo-${size}.png`, request.url));
  try {
    return new Response(new Uint8Array(await installationIcon(brand.logo, size)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
