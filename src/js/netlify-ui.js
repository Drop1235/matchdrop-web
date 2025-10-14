// Front-end glue code for Netlify auto deploy buttons
// Requires contextBridge exposure or nodeIntegration true.

let deployToNetlify;
let settings = {};

if (window.require) {
  const path = window.require('path');
  // CommonJS wrapper for ESM auto-deploy.js located at dist-web/auto-deploy-wrapper.cjs
  console.log('[NETLIFY-UI] __dirname =', __dirname);
  const wrapperPath = path.join(__dirname, 'auto-deploy-wrapper.cjs');
  console.log('[NETLIFY-UI] wrapperPath =', wrapperPath);
  ({ deployToNetlify } = window.require(wrapperPath));
  // Electron ではローカルストレージで十分なので簡易実装を使用
  const TOKEN_KEY = 'netlify_access_token';
  const SITEID_KEY = 'netlify_site_id';
  settings = {
    loadNetlifySettings() {
      return {
        accessToken: localStorage.getItem(TOKEN_KEY) || '',
        siteId: localStorage.getItem(SITEID_KEY) || ''
      };
    },
    showSettingsDialog() {
      const current = this.loadNetlifySettings();
      const token = prompt('Netlifyアクセストークンを入力', current.accessToken);
      if (token !== null) {
        const siteId = prompt('Netlify Site IDを入力', current.siteId);
        if (siteId !== null) {
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(SITEID_KEY, siteId);
          alert('設定を保存しました');
        }
      }
    }
  };
} else {
  // Browser (non-Electron) fallback – deployment not available
  deployToNetlify = undefined;
  // ブラウザ環境フォールバック
  const TOKEN_KEY = 'netlify_access_token';
  const SITEID_KEY = 'netlify_site_id';
  settings = {
    loadNetlifySettings() {
      return {
        accessToken: localStorage.getItem(TOKEN_KEY) || '',
        siteId: localStorage.getItem(SITEID_KEY) || ''
      };
    },
    showSettingsDialog() {
      const current = this.loadNetlifySettings();
      const token = prompt('Netlifyアクセストークンを入力', current.accessToken);
      if (token !== null) {
        const siteId = prompt('Netlify Site IDを入力', current.siteId);
        if (siteId !== null) {
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(SITEID_KEY, siteId);
          alert('設定を保存しました');
        }
      }
    }
  };
  deployToNetlify = async () => {
    throw new Error('ブラウザ環境では公開処理は利用できません (Electron 版をご利用ください)');
  };
}


