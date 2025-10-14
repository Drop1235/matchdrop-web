// Firebase configuration placeholder
// 1. Create a Firebase project → Webアプリ追加 → 以下の値を埋める
// 2. セキュリティ: Firestore ルールを適切に設定してください

const firebaseConfig = {
  apiKey: "AIzaSyAsay13_YPXt4A3PW4tKi4fbjq7ozyXgU",
  authDomain: "tennis-tournament-e26eb.firebaseapp.com",
  projectId: "tennis-tournament-e26eb",
  storageBucket: "tennis-tournament-e26eb.appspot.com",
  messagingSenderId: "959926678362",
  appId: "1:959926678362:web:7248df9a960638c35ff963"
};

// Initialize Firebase only once
if (!window.firebase || !window.firebase.apps || !window.firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore (Auth は後で追加)
window.firestore = firebase.firestore();
// window.firebaseAuth = firebase.auth();  // 認証は後で追加  // 未使用なのでコメントアウト

// これはデプロイテスト用のコメントです