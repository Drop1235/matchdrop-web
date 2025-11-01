// Netlify Function: import-matches
// Create/merge unassigned matches into Supabase datasets table used by OP export.

const ALLOW_ORIGIN = 'https://matchdrop-web-league.netlify.app';

function json(body, statusCode = 200) {
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Max-Age': '86400',
    },
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      body: '',
      headers: {
        'Access-Control-Allow-Origin': ALLOW_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Max-Age': '86400',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405);
  }

  try {
    const q = event.queryStringParameters || {};
    const { tournamentName, leagueName, participants, pairs, tournamentId: tidFromBody } = JSON.parse(event.body || '{}');
    if (!tournamentName || !leagueName || !Array.isArray(participants) || !Array.isArray(pairs)) {
      return json({ ok: false, error: 'invalid body' }, 400);
    }
    const tournamentId = q.tid || q.tournament || tidFromBody || tournamentName;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
    }

    // 1) read existing datasets row for this tournament (tournament_id is treated as string key)
    const base = SUPABASE_URL.replace(/\/$/, '');
    const dsUrl = `${base}/rest/v1/datasets?tournament_id=eq.${encodeURIComponent(tournamentId)}&type=eq.matches&select=id,data`;
    let res = await fetch(dsUrl, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      return json({ ok: false, error: 'supabase select failed', status: res.status, body: text }, 502);
    }
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;

    // 2) build matches payload to merge
    const nowIso = new Date().toISOString();
    const newMatches = pairs.map((p) => ({
      id: p.externalId,
      externalId: p.externalId,
      category: leagueName,
      leagueName,
      playerA: p.side1Name,
      playerB: p.side2Name,
      status: 'PENDING',
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    let data;
    if (row && row.data && Array.isArray(row.data.matches)) {
      // merge by externalId
      const map = new Map(row.data.matches.map((m) => [m.externalId || m.id, m]));
      for (const m of newMatches) map.set(m.externalId, { ...(map.get(m.externalId) || {}), ...m });
      data = { matches: Array.from(map.values()), leagueName, participants };
    } else {
      data = { matches: newMatches, leagueName, participants };
    }

    if (row?.id) {
      // update
      const upUrl = `${base}/rest/v1/datasets?id=eq.${row.id}`;
      res = await fetch(upUrl, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'content-type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ data }),
      });
    } else {
      // insert
      const insUrl = `${base}/rest/v1/datasets`;
      res = await fetch(insUrl, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'content-type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ tournament_id: tournamentId, type: 'matches', data }),
      });
    }

    if (!res.ok) {
      const text = await res.text();
      return json({ ok: false, error: 'supabase upsert failed', status: res.status, body: text }, 502);
    }

    const out = await res.json();
    // Return extra debug info to help verify correct tournament mapping
    const updatedCount = out?.length || 1;
    return json({ ok: true, updated: updatedCount, tid: tournamentId, newMatches: Array.isArray(pairs) ? pairs.length : 0 }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
};
