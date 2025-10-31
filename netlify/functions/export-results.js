exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  const proto = event.headers['x-forwarded-proto'] || 'https';
  const url = new URL(event.rawUrl || `${proto}://${event.headers.host}${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
  const tournamentId = url.searchParams.get('tournament') || '';
  const leagueName = url.searchParams.get('league') || '';

  // Optional API auth
  if (process.env.OP_API_KEY) {
    const auth = event.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || token !== process.env.OP_API_KEY) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) };
    }
  }

  if (!tournamentId || !leagueName) {
    return { statusCode: 200, body: JSON.stringify({ items: [] }), headers: { 'content-type': 'application/json' } };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }) };
  }

  try {
    // Fetch datasets row for this tournamentId and type='matches'
    const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/datasets?select=data,updated_at&tournament_id=eq.${encodeURIComponent(tournamentId)}&type=eq.matches`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Supabase fetch failed', status: res.status, body: text }) };
    }
    const rows = await res.json();
    const ds = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    const matches = ds && ds.data && Array.isArray(ds.data.matches) ? ds.data.matches : [];

    // Filter by league (category) and either Completed-like OR has winner flag
    const filtered = matches.filter(m => {
      const cat = (m && (m.category || m.leagueName || '')) || '';
      const completed = isCompleted(m);
      const hasW = hasWinner(m);
      return (cat === leagueName) && (completed || hasW);
    });

    // Aggregate latest per externalId (fallback to id)
    const map = new Map();
    for (const m of filtered) {
      const key = m.externalId || m.matchExternalId || m.id;
      if (!key) continue;
      // If duplicates, keep the one with latest actualEndTime or updatedAt-like field
      const prev = map.get(key);
      const tA = toTs(prev);
      const tB = toTs(m);
      if (!prev || tB >= tA) {
        map.set(key, m);
      }
    }

    const items = Array.from(map.entries()).map(([externalId, m]) => toExportItem(externalId, m));

    return { statusCode: 200, body: JSON.stringify({ items }), headers: { 'content-type': 'application/json' } };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};

function toTs(m) {
  if (!m) return 0;
  const cands = [m.actualEndTime, m.completedAt, m.updatedAt, m.updated_at];
  for (const c of cands) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

function toExportItem(externalId, m) {
  const winningSide = m.winningSide ?? (m.winner === 'A' ? 1 : m.winner === 'B' ? 2 : null);
  const sets = toSets(m);
  const completed = isCompleted(m);
  const status = completed ? 'COMPLETED' : (hasWinner(m) ? 'DECIDED' : (String(m?.status || '').toUpperCase() || 'PENDING'));
  return {
    matchExternalId: String(externalId),
    side1Name: m.playerA || m.side1Name || '',
    side2Name: m.playerB || m.side2Name || '',
    status,
    winningSide,
    sets,
  };
}

function toSets(m) {
  try {
    const A = m?.setScores?.A || [];
    const B = m?.setScores?.B || [];
    const n = Math.max(A.length || 0, B.length || 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = A[i];
      const b = B[i];
      if (a != null || b != null) {
        out.push({ seq: i + 1, side1_games: a ?? null, side2_games: b ?? null });
      }
    }
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

function isCompleted(m) {
  const s = String(m?.status || '').toLowerCase();
  if (!s && m?.isCompleted === true) return true;
  return s === 'completed' || s === 'complete' || s === 'done' || s === 'finished';
}

function hasWinner(m) {
  if (!m) return false;
  const w = m.winningSide ?? m.winner;
  return w === 1 || w === 2 || w === 'A' || w === 'B';
}
