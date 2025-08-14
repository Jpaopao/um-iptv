export const config = { runtime: 'edge' };

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,HEAD,POST,OPTIONS',
  'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
};

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export default async function handler(req) {
  const urlObj = new URL(req.url);
  const url = urlObj.searchParams.get('url');

  // CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  if (!url) return new Response('Missing url', { status: 400, headers: cors });
  if (!/^http:\/\//i.test(url)) return new Response('Only http:// allowed', { status: 400, headers: cors });

  // Build upstream headers (drop origin/referrer)
  const fwd = new Headers();

  // Keep byte-range for video segments
  const range = req.headers.get('range');
  if (range) fwd.set('range', range);

  // Only pass content-type on non-GET/HEAD (e.g., license POST)
  const ct = req.headers.get('content-type');
  if (ct && req.method !== 'GET' && req.method !== 'HEAD') fwd.set('content-type', ct);

  // Browser-like defaults
  fwd.set('user-agent', req.headers.get('user-agent') || DEFAULT_UA);
  fwd.set('accept', req.headers.get('accept') || '*/*');
  fwd.set('accept-language', req.headers.get('accept-language') || 'en-US,en;q=0.9');
  fwd.set('connection', 'keep-alive');

  // Convert HEAD -> GET upstream (many origins 403 on HEAD)
  const upstreamMethod = (req.method === 'HEAD') ? 'GET' : req.method;

  // OPTIONAL: if still 403, uncomment these to look same-site to the IP
  // fwd.set('referer', 'http://143.44.136.110/');
  // fwd.set('origin',  'http://143.44.136.110');

  const upstream = await fetch(url, {
    method: upstreamMethod,
    headers: fwd,
    body: (upstreamMethod === 'GET' || upstreamMethod === 'HEAD') ? undefined : await req.arrayBuffer(),
    redirect: 'follow',
    cache: 'no-store'
  });

  // When original was HEAD, mimic a HEAD response (headers only)
  if (req.method === 'HEAD') {
    const headOnly = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors)) headOnly.set(k, v);
    return new Response(null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: headOnly
    });
  }

  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}
