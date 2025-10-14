// Netlify設定UI・トークン管理

const TOKEN_KEY = 'netlify_access_token';
const SITEID_KEY = 'netlify_site_id';

function saveNetlifySettings(token, siteId) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(SITEID_KEY, siteId);
}

function loadNetlifySettings() {
    return {
        accessToken: localStorage.getItem(TOKEN_KEY) || '',
        siteId: localStorage.getItem(SITEID_KEY) || ''
    };
}

function showSettingsDialog() {
    // Create modal only once
    let modal = document.getElementById('netlify-settings-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'netlify-settings-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.background = 'rgba(0,0,0,0.4)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10000';

        modal.innerHTML = `
          <div style="background:#fff; padding:24px; border-radius:8px; width:320px; box-shadow:0 2px 8px rgba(0,0,0,0.3);">
            <h3 style="margin-top:0">Netlify設定</h3>
            <div style="margin-bottom:12px;">
              <label style="display:block; font-weight:bold; margin-bottom:4px;">Access Token</label>
              <input id="netlify-token-input" type="text" style="width:100%; padding:6px;" />
            </div>
            <div style="margin-bottom:12px;">
              <label style="display:block; font-weight:bold; margin-bottom:4px;">Site ID</label>
              <input id="netlify-siteid-input" type="text" style="width:100%; padding:6px;" />
            </div>
            <div style="text-align:right;">
              <button id="netlify-cancel-btn" style="margin-right:8px;">キャンセル</button>
              <button id="netlify-save-btn" style="background:#4caf50; color:#fff;">保存</button>
            </div>
          </div>`;
        document.body.appendChild(modal);

        // Event listeners
        modal.querySelector('#netlify-cancel-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        modal.querySelector('#netlify-save-btn').addEventListener('click', () => {
            const token = modal.querySelector('#netlify-token-input').value.trim();
            const siteId = modal.querySelector('#netlify-siteid-input').value.trim();
            saveNetlifySettings(token, siteId);
            alert('設定を保存しました');
            modal.style.display = 'none';
        });
      }
      // populate current values and show
      const current = loadNetlifySettings();
      modal.querySelector('#netlify-token-input').value = current.accessToken;
      modal.querySelector('#netlify-siteid-input').value = current.siteId;
      modal.style.display = 'flex';
}

// Expose globally so other scripts can call without ES modules
window.saveNetlifySettings = saveNetlifySettings;
window.loadNetlifySettings = loadNetlifySettings;
window.showSettingsDialog = showSettingsDialog;

