console.log('FirestoreMatchDatabase.js loaded');
// Firestoreと連携する大会データベース
class FirestoreMatchDatabase {
  constructor() {
    this.collection = window.firestore.collection("matches");
    this.matches = [];
    this.unsubscribe = null;
  }

  // Firestoreからリアルタイムでデータを取得
  async initDatabase() {
    this.unsubscribe = this.collection.onSnapshot(snapshot => {
      this.matches = [];
      snapshot.forEach(doc => {
        this.matches.push({ id: doc.id, ...doc.data() });
      });
      // 必要なら画面を再描画する関数をここで呼ぶ
      if (window.onMatchesUpdated) window.onMatchesUpdated(this.matches);
    });
  }

  // Firestoreに新しい試合を追加
  async addMatch(match) {
    // Firestore の add は DocumentReference を返す。呼び出し側で ID を必要とするため返却値を整形する。
    const docRef = await this.collection.add(match);
    return { id: docRef.id, ...match };
  }

  // Firestoreの試合データを更新
  async updateMatch(match) {
    if (!match.id) return null;
    await this.collection.doc(match.id).set(match);
    // Firestore への書き込みが成功したら最新データを返す（UI 更新用）
    return { ...match };
  }

  // Firestoreから試合を削除
  async deleteMatch(id) {
    await this.collection.doc(id).delete();
  }

  // Firestoreから全試合を取得
  async getAllMatches() {
    const snapshot = await this.collection.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // 完了した試合のみ取得（History 画面で使用）
  async getCompletedMatches() {
    const snapshot = await this.collection
      .where('winner', '!=', null)
      .get();

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(match => match.actualEndTime);
  }

  // Firestoreの購読解除
  unsubscribeDatabase() {
    if (this.unsubscribe) this.unsubscribe();
  }
}

// グローバルに公開
window.FirestoreMatchDatabase = FirestoreMatchDatabase;