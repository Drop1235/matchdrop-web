// Lightweight client-side integration that forwards payload to a Netlify Function
// The Netlify Function signs with OP_WEBHOOK_SECRET and posts to LEAGUE_WEBHOOK_URL

(function(){
  async function sendResultToLeague(payload) {
    try {
      const res = await fetch('/.netlify/functions/league-push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[LEAGUE_PUSH] HTTP error', res.status, json);
        return { ok: false, error: `HTTP ${res.status}`, response: json };
      }
      if (json && json.ignored) {
        console.warn('[LEAGUE_PUSH][ignored]', json);
      } else {
        console.log('[LEAGUE_PUSH][ok]', json);
      }
      return json;
    } catch (e) {
      console.error('[LEAGUE_PUSH] failed', e);
      return { ok: false, error: String(e) };
    }
  }
  // attach to window
  try { window.sendResultToLeague = sendResultToLeague; } catch {}
})();
