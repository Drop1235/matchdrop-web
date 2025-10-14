// DEBUG focus check
setTimeout(() => {
  try {
    const { remote } = (() => {
      try { return require('@electron/remote'); } catch { return require('electron'); }
    })();
    remote?.getCurrentWindow?.().focus?.();
  } catch {}
  window.focus();
  const p = document.getElementById('password');
  console.log('window.hasFocus? →', document.hasFocus());
  if (p) {
    p.focus();
    console.log('activeElement is', document.activeElement);
  }
}, 200);

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const errorMessage = document.getElementById('error-message');
  
  // ページロード直後にパスワード入力欄が確実に操作できるようにする
  passwordInput.removeAttribute('disabled');
  passwordInput.readOnly = false;
  passwordInput.style.pointerEvents = 'auto';
  
  // ログアウト直後かどうかを確認
  const justLoggedOut = localStorage.getItem('justLoggedOut') === 'true';
  if (justLoggedOut) {
    // ログアウト直後のフラグをクリア
    localStorage.removeItem('justLoggedOut');
    console.log('ログアウト直後の特別処理を実行');
  }
  
  // 入力欄とウィンドウにフォーカスを当てる関数
  const attemptFocus = () => {
    try {
      if (typeof require === 'function') {
        try {
          // Electron v14以降
          const { remote } = require('@electron/remote');
          if (remote?.getCurrentWindow) {
            remote.getCurrentWindow().focus();
          }
        } catch (e) {
          // 古いElectron
          try {
            const { remote } = require('electron');
            if (remote?.getCurrentWindow) {
              remote.getCurrentWindow().focus();
            }
          } catch {}
        }
      }
    } catch {}
    
    // 確実にフォーカスを当てる
    window.focus();
    document.body.focus();
    passwordInput.focus();
    
    // 入力欄のスタイルを強制的に有効化
    passwordInput.style.opacity = '1';
    passwordInput.style.pointerEvents = 'auto';
    passwordInput.style.userSelect = 'text';
    
    // 追加の強制的な有効化処理
    passwordInput.removeAttribute('disabled');
    passwordInput.removeAttribute('readonly');
    passwordInput.readOnly = false;
    passwordInput.disabled = false;
    passwordInput.style.zIndex = '9999';
    passwordInput.style.position = 'relative';
    passwordInput.style.display = 'block';
    passwordInput.style.visibility = 'visible';
    
    // 再度フォーカス（微小遅延）
    setTimeout(() => passwordInput.focus(), 10);
  };
  
  // 初回実行
  requestAnimationFrame(attemptFocus);
  
  // ログアウト直後は特に念入りにフォーカス処理を行う
  const duration = justLoggedOut ? 3000 : 1000; // ログアウト直後は3秒間
  const interval = justLoggedOut ? 50 : 100;   // ログアウト直後はより頻繁に
  
  // 重い描画直後でも確実に入力できるよう一定時間、一定間隔で再試行
  const focusInterval = setInterval(attemptFocus, interval);
  setTimeout(() => clearInterval(focusInterval), duration);
  
  // 初期パスワード - 実際の運用では適切に変更してください
  const initialPassword = 'tennis2025';
  
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const enteredPassword = passwordInput.value;
    
    if (enteredPassword === initialPassword) {
      // パスワードが正しい場合、ログイン状態を保存してメイン画面へリダイレクト
      localStorage.setItem('isAuthenticated', 'true');
      window.location.href = 'index.html';
    } else {
      // パスワードが間違っている場合、エラーメッセージを表示
      errorMessage.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
    }
  });
  
  // すでにログイン済みの場合は直接メイン画面へリダイレクト
  if (localStorage.getItem('isAuthenticated') === 'true') {
    window.location.href = 'index.html';
  }
});
