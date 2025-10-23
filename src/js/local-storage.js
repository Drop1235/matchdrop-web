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

  deleteMatch(id) {
    // Normalize both sides to string to avoid type mismatches (e.g., '12' vs 12)
    const targetId = String(id);
    this.matches = this.matches.filter(m => String(m.id) !== targetId);
    saveMatchData(this.matches); // 削除・保存
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
