// publish-ipc.js
// Electron renderer -> main process publish handler
if (window.require) {
  const { ipcRenderer } = window.require('electron');
  window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('publish-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = '公開中...';
        // Save board-view HTML snapshot to dist-web/board-view.html
        try {
          const board = document.getElementById('board-view');
          if (board) {
            // 新しいHTMLテンプレートを生成
            const html = `<!DOCTYPE html>
            <html lang="ja">
            <head>
              <meta charset="UTF-8">
              <title>対戦表（公開用スクリーンショット）</title>
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <style>
                body { font-family: 'Segoe UI', 'Meiryo', sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
                .container { max-width: 900px; margin: 32px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #0001; padding: 32px; }
                h2 { margin-top: 0; }
                .screenshot-img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; background: #fff; }
                .note { color: #888; margin: 16px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div id="img-area">
                  <img src="board-view.png?ts=${Date.now()}" alt="対戦表スクリーンショット" class="screenshot-img" onerror="this.style.display='none';document.getElementById('img-area').innerHTML='<div class=\'note\'>画像がまだ生成されていません。</div>'">
                </div>
              </div>
            </body>
            </html>
            <!-- AUTO GENERATED: 対戦表PNG画像を公開 -->`;
            let pngBase64 = null;
            if (window.html2canvas) {
              const canvas = await window.html2canvas(board, {
                backgroundColor: '#ffffff',
                scale: 1,
                useCORS: true,
                allowTaint: true,
                logging: false
              });
              pngBase64 = canvas.toDataURL('image/png');
            }
            const result = await ipcRenderer.invoke('publish-site', { html, png: pngBase64 });
            alert(result);
          }
        } catch (snapErr) {
          console.error('Failed to save board-view snapshot', snapErr);
        }
      } catch (err) {
        alert('公開に失敗しました:\n' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '📤 公開';
      }
    });
  });
}
