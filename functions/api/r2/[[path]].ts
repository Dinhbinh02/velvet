export async function onRequestGet(context: any) {
  try {
    const path = Array.isArray(context.params.path) ? context.params.path.join('/') : context.params.path;
    if (!context.env.VELVET_BUCKET) {
      return new Response(JSON.stringify({ error: 'R2 bucket not bound' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const object = await context.env.VELVET_BUCKET.get(path);
    if (!object) {
      return new Response(JSON.stringify({ error: 'Book file not found in R2' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function onRequestPut(context: any) {
  try {
    const path = Array.isArray(context.params.path) ? context.params.path.join('/') : context.params.path;
    if (!context.env.VELVET_BUCKET) {
      return new Response(JSON.stringify({ error: 'R2 bucket not bound' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    await context.env.VELVET_BUCKET.put(path, context.request.body);
    return new Response(JSON.stringify({ success: true, key: path }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
