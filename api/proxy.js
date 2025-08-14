export const config = { runtime: 'edge' };

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,HEAD,POST,OPTIONS',
  'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
};

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export default async function handler(req) {
  const urlObj = new URL(req.url);
  const url = urlObj.searchParams.get('url');

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!url) return new Response('Missing url', { status: 400, headers: cors });
  if (!/^http:\/\//i.test(url)) return new Response('Only http:// allowed', { status: 400, headers: cors });

  const forward = new Headers();

  const range = req.headers.get('range');
  if (range) forward.set('range', range);

  const ct = req.headers.get('content-type');
  if (ct && req.method !== 'GET' && req.method !== 'HEAD') forward.set('content-type', ct);

  forward.set('user-agent', DEFAULT_UA);
  forward.set('accept', '*/*');
  forward.set('accept-language', 'en-US,en;q=0.9');
  forward.set('connection', 'keep-alive');

  const upstream = await fetch(url, {
    method: req.method,
    headers: forward,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
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
