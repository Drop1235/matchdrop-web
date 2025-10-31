// Lightweight in-memory DB with localStorage persistence (per tournament)
// Exposes window.db used by app.js/board.js/matchCard.js

(function(){
  const LS = window.localStorage;

  function getCurrentTid() {
    try { return LS.getItem('currentTournamentId') || 'default'; } catch { return 'default'; }
  }

  function getMatchDataKey(tid = getCurrentTid()) {
    return 'tennisTournamentMatches_' + tid;
  }

  function loadAll(tid = getCurrentTid()) {
    try {
      const raw = LS.getItem(getMatchDataKey(tid));
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice() : [];
    } catch { return []; }
  }

  function saveAll(list, tid = getCurrentTid()) {
    try { LS.setItem(getMatchDataKey(tid), JSON.stringify(list || [])); } catch {}
  }

  // simple in-memory cache for current page session
  let mem = loadAll();

  function nextId() {
    // prefer numeric ids for drag/drop logic
    const t = Date.now();
    let id = t % 1e9; // keep it smaller
    while (mem.find(m => m.id === id)) id++;
    return id;
  }

  async function getAllMatches() {
    return mem.slice();
  }

  async function getMatch(id) {
    const target = String(id);
    return mem.find(m => String(m.id) === target);
  }

  async function addMatch(match) {
    const m = { ...match };
    if (m.id == null) m.id = nextId();
    // default unassigned if not provided
    if (!m.status) m.status = 'Unassigned';
    if (m.courtNumber === undefined) m.courtNumber = null;
    if (m.rowPosition === undefined) m.rowPosition = null;
    mem.push(m);
    saveAll(mem);
    return m;
  }

  async function updateMatch(patch) {
    const target = String(patch.id);
    const idx = mem.findIndex(x => String(x.id) === target);
    if (idx === -1) return null;
    mem[idx] = { ...mem[idx], ...patch };
    saveAll(mem);
    return mem[idx];
  }

  async function deleteMatch(id) {
    const target = String(id);
    const before = mem.length;
    mem = mem.filter(m => m && String(m.id) !== target);
    saveAll(mem);
    // record tombstone for future cloud merge safety
    try {
      const delKey = window.getDeletedIdsKey ? window.getDeletedIdsKey() : ('deletedMatchIds_' + getCurrentTid());
      const raw = LS.getItem(delKey);
      const set = new Set(Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : []);
      set.add(target);
      LS.setItem(delKey, JSON.stringify(Array.from(set)));
    } catch {}
    return before !== mem.length;
  }

  async function deleteAllMatches(opts = {}) {
    mem = [];
    saveAll(mem);
    return true;
  }

  // Expose
  window.db = {
    getAllMatches,
    getMatch,
    addMatch,
    updateMatch,
    deleteMatch,
    deleteAllMatches,
    getCompletedMatches: async function() {
      return mem.filter(m => m && m.status === 'Completed');
    },
  };

  // Also expose helper keys for cloud sync code
  window.getMatchDataKey = getMatchDataKey;
  window.getDeletedIdsKey = function(){ return 'deletedMatchIds_' + getCurrentTid(); };
})();

// Persistence/database logic removed as per requirements.
