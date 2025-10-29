// メモリ上だけで動作する試合管理用ダミーDBクラス

class MemoryMatchDatabase {
  constructor() {
    // localStorageから既存データを読み込む
    this.matches = loadMatchData();
    this.nextId = 1;
    // 既存データの最大IDを反映
    if (this.matches.length > 0) {
      const maxId = Math.max(...this.matches.map(m => parseInt(m.id, 10)).filter(n => !isNaN(n)), 0);
      this.nextId = maxId + 1;
    }

  }

  getAllMatches() {
    return Promise.resolve([...this.matches]);
  }

  addMatch(match) {
    // ID自動付与（既にIDがあればそのまま）
    if (!match.id) {
      match.id = this.nextId++;
    }
    this.matches.push({ ...match });
    saveMatchData(this.matches); // 追加・保存
    return Promise.resolve({ ...match });
  }

  updateMatch(match) {
    const idx = this.matches.findIndex(m => m.id === match.id);
    if (idx >= 0) {
      this.matches[idx] = { ...this.matches[idx], ...match };
      saveMatchData(this.matches); // 更新・保存
      return Promise.resolve({ ...this.matches[idx] });
    }
    return Promise.reject(new Error('Match not found'));
  }

  // 1件取得（Board.updateCourtGrid から参照される）
  getMatch(id) {
    const m = this.matches.find(x => String(x.id) === String(id));
    return m ? Promise.resolve({ ...m }) : Promise.reject(new Error('Match not found'));
  }

  deleteMatch(id) {
    // Normalize both sides to string to avoid type mismatches (e.g., '12' vs 12)
    const targetId = String(id);
    this.matches = this.matches.filter(m => String(m.id) !== targetId);
    // Append to per-tournament tombstone list so external sync won't resurrect it
    try {
      if (typeof window.getDeletedIdsKey === 'function') {
        const key = window.getDeletedIdsKey();
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        if (!arr.includes(targetId)) arr.push(targetId);
        localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch (_) { /* ignore */ }
    saveMatchData(this.matches); // 削除・保存
    return Promise.resolve();
  }

  // 全削除（Board.deleteAllMatches から呼ばれる想定）
  // options.skipTombstone === true の場合、トゥームストーン更新をスキップ（同期置換用途）
  deleteAllMatches(options = {}) {
    const skipTombstone = !!options.skipTombstone;
    if (!skipTombstone) {
      try {
        // 既存IDを tombstone に追加（端末間同期での復活防止のため）
        const allIds = this.matches.map(m => String(m.id));
        if (typeof window.getDeletedIdsKey === 'function') {
          const key = window.getDeletedIdsKey();
          const raw = localStorage.getItem(key);
          const arr = raw ? JSON.parse(raw) : [];
          const set = new Set([...arr, ...allIds]);
          localStorage.setItem(key, JSON.stringify(Array.from(set)));
        }
      } catch (_) { /* ignore */ }
    }
    this.matches = [];
    saveMatchData(this.matches); // 空配列を保存
    // IDカウンタはそのまま維持（新規作成時に重複しない）
    return Promise.resolve();
  }

  getCompletedMatches() {
    return Promise.resolve(this.matches.filter(m => m.status === 'Completed'));
  }
}

// グローバルに登録
window.db = new MemoryMatchDatabase();
// 一部のコード（app.jsやmatchCard.js）は未宣言のグローバル変数 db を参照しているため、
// ここで var を用いて window スコープに db を定義しておく
// （var を使うことで既に存在する場合は上書きせず、存在しない場合にのみ定義される）
if (typeof db === 'undefined') {
  var db = window.db; // eslint-disable-line no-var
}
