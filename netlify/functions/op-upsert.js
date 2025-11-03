// Netlify Function: op-upsert
// Upserts matches into Supabase datasets table for a given tournament_id.
// Rejects empty matches to prevent wiping OP.
// Note: Use global fetch provided by Netlify runtime (no external deps required).

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gdfdunsoluxuiuzfrexs.supabase.co';
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZmR1bnNvbHV4dWl1emZyZXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTUxODksImV4cCI6MjA3NTgzMTE4OX0.RTWFEoqqMVdfZU8H8Xcsjm-PT7XWFXm1hJG7HqBJOBs';

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Missing Supabase config' }) };
    }

    const input = JSON.parse(event.body || '{}');
    const tid = input.tid || input.tournament_id || '';
    const data = input.data || {};
    const matches = Array.isArray(data.matches) ? data.matches : [];
    const settings = data.settings || {};

    if (!tid || typeof tid !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid tid' }) };
    }
    if (!Array.isArray(matches) || matches.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'matches is empty. Aborting to prevent wipe.' }) };
    }

    const nowIso = new Date().toISOString();
    const base = `${SUPABASE_URL}/rest/v1/datasets`;
    const AUTH_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const upsertPayload = {
      tournament_id: tid,
      type: 'matches',
      data: { matches, settings, _rev: Date.now() },
      updated_at: nowIso,
    };
    const upsert = await fetch(`${base}?on_conflict=tournament_id,type`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: AUTH_KEY,
        authorization: `Bearer ${AUTH_KEY}`,
        // true upsert with update on duplicates
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(upsertPayload),
    });
    const t = await upsert.text();
    let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
    if (!upsert.ok) {
      return { statusCode: upsert.status, body: JSON.stringify({ ok: false, error: j }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, count: matches.length, data: j }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
