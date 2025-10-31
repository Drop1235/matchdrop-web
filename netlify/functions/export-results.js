exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }
  const url = new URL(event.rawUrl || `${event.headers['x-forwarded-proto'] || 'https'}://${event.headers.host}${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
  const tournament = url.searchParams.get('tournament') || '';
  const league = url.searchParams.get('league') || '';
  const needAuth = !!process.env.OP_API_KEY;
  if (needAuth) {
    const auth = event.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || token !== process.env.OP_API_KEY) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) };
    }
  }
  if (!tournament || !league) {
    return { statusCode: 200, body: JSON.stringify({ items: [] }), headers: { 'content-type': 'application/json' } };
  }
  return { statusCode: 200, body: JSON.stringify({ items: [] }), headers: { 'content-type': 'application/json' } };
};
