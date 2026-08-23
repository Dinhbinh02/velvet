export async function onRequestGet(context: any) {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing target url', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
      },
    });

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Cache-Control', 'public, max-age=86400');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err: any) {
    return new Response(`Proxy Error: ${err.message}`, { status: 500 });
  }
}
