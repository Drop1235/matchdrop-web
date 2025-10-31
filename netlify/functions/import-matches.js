// Netlify Function: import-matches
// Create/merge unassigned matches into Supabase datasets table used by OP export.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  try {
    const q = event.queryStringParameters || {};
    const { tournamentName, leagueName, participants, pairs, tournamentId: tidFromBody } = JSON.parse(event.body || '{}');
    if (!tournamentName || !leagueName || !Array.isArray(participants) || !Array.isArray(pairs)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid body' }) };
    }
    const tournamentId = q.tid || q.tournament || tidFromBody || tournamentName;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }) };
    }

    // 1) read existing datasets row for this tournament (tournament_id is treated as string key)
    const base = SUPABASE_URL.replace(/\/$/, '');
    const dsUrl = `${base}/rest/v1/datasets?tournament_id=eq.${encodeURIComponent(tournamentId)}&type=eq.matches&select=id,data`;
    let res = await fetch(dsUrl, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'supabase select failed', status: res.status, body: text }) };
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
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'supabase upsert failed', status: res.status, body: text }) };
    }

    const out = await res.json();
    return { statusCode: 200, body: JSON.stringify({ ok: true, updated: out?.length || 1 }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
