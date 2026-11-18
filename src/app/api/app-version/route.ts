import { appBuildVersion } from '@/lib/deploy/build-version';

export const dynamic = 'force-dynamic';
/** No auth/DB lookup and no private data. Never cache a release probe. */
export function GET() {
  return Response.json({ version: appBuildVersion() }, { headers: {
    'Cache-Control': 'no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Vary': '*',
    'X-Content-Type-Options': 'nosniff',
  } });
}
