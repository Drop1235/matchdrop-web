// Netlify Function: league-push
// Signs and forwards OP match result to LEAGUE_WEBHOOK_URL using HMAC-SHA256

const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  try {
    const LEAGUE_WEBHOOK_URL = process.env.LEAGUE_WEBHOOK_URL;
    const OP_WEBHOOK_SECRET = process.env.OP_WEBHOOK_SECRET;
    if (!LEAGUE_WEBHOOK_URL || !OP_WEBHOOK_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Missing env: LEAGUE_WEBHOOK_URL or OP_WEBHOOK_SECRET' }) };
    }

    const input = JSON.parse(event.body || '{}');
    const now = Date.now();

    const body = JSON.stringify({
      dedupeKey: `${input.externalId || input.matchExternalId || 'noext'}-${now}`,
      tournament: { name: input.tournamentName || input.tournament?.name || '' },
      league: { name: input.leagueName || input.league?.name || '' },
      matchExternalId: input.externalId || input.matchExternalId,
      side1: { name: input.side1Name || input.side1?.name || '' },
      side2: { name: input.side2Name || input.side2?.name || '' },
      status: input.status,
      winningSide: input.winningSide ?? null,
      sets: Array.isArray(input.sets) ? input.sets : undefined,
    });

    const signature = crypto.createHmac('sha256', OP_WEBHOOK_SECRET).update(body).digest('hex');

    const res = await fetch(LEAGUE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-op-signature': signature,
        'x-op-timestamp': String(now),
      },
      body,
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    return {
      statusCode: res.status,
      body: JSON.stringify(json),
      headers: { 'content-type': 'application/json' }
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
