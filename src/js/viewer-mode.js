// viewer-mode.js
// Hide admin / edit UI when running in a pure browser (Netlify) environment.
// Robust Electron detection\nconst IS_ELECTRON = typeof window !== 'undefined' && (\n  navigator.userAgent.toLowerCase().includes('electron') ||\n  (window.process && window.process.type === 'renderer')\n);\n\n// Run viewer-mode only when **not** in Electron (i.e. pure browser)\nif (!IS_ELECTRON) {
  window.addEventListener('DOMContentLoaded', () => {
    // 閲覧モードでは対戦表だけ表示し、他を隠す
    document.body.style.background = '#fff';
    // 対戦表以外を非表示
    const nav = document.querySelector('header nav');
    if (nav) nav.style.display = 'none';
    const tournamentSel = document.getElementById('tournament-select');
    if (tournamentSel) tournamentSel.style.display = 'none';
    const mainEl = document.querySelector('main');
    if (mainEl) {
      // history-view, add-match-modal などを非表示
      mainEl.querySelectorAll('section, div, form').forEach(el => {
        if (el.id !== 'board-view') el.style.display = 'none';
      });
      // board-viewだけ中央寄せ
      const bv = document.getElementById('board-view');
      if (bv) {
        bv.style.margin = '40px auto';
        bv.style.maxWidth = '1200px';
        bv.style.display = 'block';
      }
    }
    // スクリーンショット画像を表示
    const ss = document.getElementById('screenshot-container');
    if (ss) {
      ss.style.display = 'block';
      const img = ss.querySelector('img');
      // board-view HTML を Ajax で取得して表示
      const bvEl = document.getElementById('board-view');
      fetch('board-view.html?_=' + Date.now())
        .then(res => {
          if (!res.ok) throw new Error('snapshot not found');
          return res.text();
        })
        .then(html => {
          if (bvEl) bvEl.innerHTML = html;
        })
        .catch(() => {
          if (bvEl) bvEl.innerHTML = '<p style="text-align:center;">まだ公開された対戦表がありません。</p>';
        }); // cache bust
    }
    const adminIds = [
      'add-match-btn',
      'decrease-courts-btn',
      'increase-courts-btn',
      'board-export-btn',
      'board-export-type',
      'delete-all-matches-btn',
      'add-tournament-btn',
      'delete-tournament-btn',
      'logout-btn',
      'publish-btn',
      'board-view-btn',
      'history-view-btn',
      'tournament-modal',
    ];

    adminIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // --- 追加: 全てのボタン類を徹底的に非表示にする ------------------
    document.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn, [role="button"]').forEach(el => {
      el.style.display = 'none';
    });
    // -------------------------------------------------------------------

    // hide elements marked explicitly
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = 'none';
    });
  });
}
