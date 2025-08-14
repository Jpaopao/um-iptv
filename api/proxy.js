export const config = { runtime: 'edge' };

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,HEAD,POST,OPTIONS',
  'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type'
};

export default async function handler(req) {
  const urlObj = new URL(req.url);
  const url = urlObj.searchParams.get('url');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }
  if (!url) {
    return new Response('Missing url', { status: 400, headers: cors });
  }
  if (!/^http:\/\//i.test(url)) {
    return new Response('Only http:// allowed', { status: 400, headers: cors });
  }

  const forward = new Headers();
  for (const h of ['range','accept','user-agent','accept-encoding','referer','origin','content-type']) {
    const v = req.headers.get(h);
    if (v) forward.set(h, v);
  }

  const upstream = await fetch(url, {
    method: req.method,
    headers: forward,
    body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : await req.arrayBuffer(),
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