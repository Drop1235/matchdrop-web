// matchDropStorage.js
// グローバル(window)に loadMatchData / saveMatchData を公開する
(function(global) {
// MatchDrop用：試合データ（matchData）のlocalStorage保存・読み込みユーティリティ
// 標準的な配列形式のmatchDataを想定

  // 大会ごとにローカルストレージキーを分離
  /**
   * 現在の大会IDに応じたローカルストレージキーを取得する。
   * @returns {string}
   */
  function getMatchDataKey() {
    const currentId = localStorage.getItem('currentTournamentId') || 'default';
    return 'tennisTournamentMatches_' + currentId;
  }

  // Tombstone list for deleted matches (per tournament)
  function getDeletedIdsKey() {
    const currentId = localStorage.getItem('currentTournamentId') || 'default';
    return 'deletedMatchIds_' + currentId;
  }

/**
 * localStorageからmatchData（配列）を読み込む
 * データ構造が不正な場合は空配列を返す
 * @returns {Array}
 */
  function loadMatchData() {
    const MATCH_DATA_KEY = getMatchDataKey();
    try {
      const stored = localStorage.getItem(MATCH_DATA_KEY);
      let data = [];
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          data = parsed;
        }
      }

      // Filter out tombstoned (deleted) matches by ID (string-compare)
      try {
        const delKey = getDeletedIdsKey();
        const deletedJson = localStorage.getItem(delKey);
        const deletedSet = new Set(
          deletedJson ? (JSON.parse(deletedJson) || []).map(x => String(x)) : []
        );
        if (deletedSet.size > 0) {
          data = data.filter(m => !deletedSet.has(String(m && m.id)));
        }
      } catch (e) {
        // ignore filter errors
      }

      return data;
    } catch (e) {
      // 不正なデータの場合は何もしない
      console.warn('matchDataの読み込みに失敗:', e);
    }
    return [];
  }

/**
 * matchDataをlocalStorageに保存（JSON形式）
 * @param {Array} data
 */
  function saveMatchData(data) {
    const MATCH_DATA_KEY = getMatchDataKey();
    try {
      localStorage.setItem(MATCH_DATA_KEY, JSON.stringify(data));
    } catch (e) {
      // 保存失敗時もエラーは出さない
      console.warn('matchDataの保存に失敗:', e);
    }
  }

/**
 * matchDataの自動保存をセットアップ
 * getter: 最新のmatchData配列を返す関数
 *
 * 例: setupMatchDropStorageSync(() => window.db.matches)
 */
  function setupMatchDropStorageSync(getter) {
  // 監視用のMutationObserverやカスタムイベントを使っても良いが、
  // ここでは簡易的にsetIntervalで定期監視
  let lastJson = '';
  setInterval(() => {
    try {
      const data = getter();
      const json = JSON.stringify(data);
      if (json !== lastJson) {
        saveMatchData(data);
        lastJson = json;
      }
    } catch (e) {
      // 何もしない
    }
  }, 1000); // 1秒ごとにチェック
  }

  // window へ公開
  // getMatchDataKey も必要に応じて公開
  global.getMatchDataKey = getMatchDataKey;
  global.getDeletedIdsKey = getDeletedIdsKey;
  global.loadMatchData = loadMatchData;
  global.saveMatchData = saveMatchData;
  global.setupMatchDropStorageSync = setupMatchDropStorageSync;
})(window);
