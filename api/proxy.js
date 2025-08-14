export const config = { runtime: 'edge' };

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,HEAD,POST,OPTIONS',
  'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
};

// A browsery UA helps some CDNs
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export default async function handler(req) {
  const urlObj = new URL(req.url);
  const url = urlObj.searchParams.get('url');

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (!url) {
    return new Response('Missing url', { status: 400, headers: cors });
  }
  // Only proxy http:// (purpose: avoid mixed content)
  if (!/^http:\/\//i.test(url)) {
    return new Response('Only http:// allowed', { status: 400, headers: cors });
  }

  // Build headers to forward – intentionally DROP origin/referrer
  const forward = new Headers();

  // keep byte-range & compression
  for (const h of ['range', 'accept-encoding', 'content-type']) {
    const v = req.headers.get(h);
    if (v) forward.set(h, v);
  }

  // set browser-like defaults some servers expect
  forward.set('user-agent', req.headers.get('user-agent') || DEFAULT_UA);
  forward.set('accept', req.headers.get('accept') || '*/*');
  forward.set('accept-language', req.headers.get('accept-language') || 'en-US,en;q=0.9');

  // Optional: some servers like keep-alive
  forward.set('connection', 'keep-alive');

  const upstream = await fetch(url, {
    method: req.method,
    headers: forward,
    body:
      req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : await req.arrayBuffer(),
    redirect: 'follow',
    cache: 'no-store'
  });

  const headers = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}
