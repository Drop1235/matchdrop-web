document.addEventListener('DOMContentLoaded', () => {
  // ログアウトボタンを非表示にする
  const logoutButton = document.getElementById('logout-btn');
  if (logoutButton) {
    logoutButton.style.display = 'none';
  }
});
