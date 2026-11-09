const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok: true, service: 'kite-admin' }), {
        headers: JSON_HEADERS,
      });
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler;
