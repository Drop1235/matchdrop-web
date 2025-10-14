// ハイブリッドストレージマネージャー（オンライン時は共有、オフライン時はローカル）
class HybridStorageManager {
  constructor() {
    this.localManager = window.localStorageManager;
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.lastSyncTime = localStorage.getItem('lastSyncTime');
    
    // オンライン/オフライン状態の監視
    window.addEventListener('online', () => {
      console.log('オンラインになりました');
      this.isOnline = true;
      this.syncWithServer();
    });
    
    window.addEventListener('offline', () => {
      console.log('オフラインになりました');
      this.isOnline = false;
    });
    
    // 初期化時にオンラインの場合は同期を試行
    if (this.isOnline) {
      this.syncWithServer();
    }
  }

  // サーバーとの同期（簡易実装）
  async syncWithServer() {
    if (this.syncInProgress) return;
    
    try {
      this.syncInProgress = true;
      console.log('サーバーとの同期を開始...');
      
      // 実際のサーバー同期ロジックをここに実装
      // 現在は模擬的な処理
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('lastSyncTime', this.lastSyncTime);
      
      console.log('サーバーとの同期が完了しました');
    } catch (error) {
      console.error('サーバー同期エラー:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // 大会データの保存
  async saveTournament(tournamentData) {
    try {
      // ローカルに保存
      const localResult = await this.localManager.saveTournament(tournamentData);
      
      // オンラインの場合はサーバーにも保存を試行
      if (this.isOnline) {
        try {
          await this.saveToServer('tournament', tournamentData);
        } catch (error) {
          console.warn('サーバー保存に失敗しましたが、ローカル保存は成功しました:', error);
        }
      }
      
      return localResult;
    } catch (error) {
      console.error('大会データの保存に失敗:', error);
      return { success: false, error: error.message };
    }
  }

  // 大会データの取得
  getTournaments() {
    return this.localManager.getTournaments();
  }

  async getTournament(tournamentId) {
    return await this.localManager.getTournament(tournamentId);
  }

  async deleteTournament(tournamentId) {
    try {
      // ローカルから削除
      const localResult = await this.localManager.deleteTournament(tournamentId);
      
      // オンラインの場合はサーバーからも削除を試行
      if (this.isOnline) {
        try {
          await this.deleteFromServer('tournament', tournamentId);
        } catch (error) {
          console.warn('サーバー削除に失敗しましたが、ローカル削除は成功しました:', error);
        }
      }
      
      return localResult;
    } catch (error) {
      console.error('大会データの削除に失敗:', error);
      return { success: false, error: error.message };
    }
  }

  // 現在の大会の設定・取得
  setCurrentTournament(tournamentId) {
    this.localManager.setCurrentTournament(tournamentId);
  }

  getCurrentTournament() {
    return this.localManager.getCurrentTournament();
  }

  // 試合データの保存
  async saveMatch(matchData) {
    try {
      // ローカルに保存
      const localResult = await this.localManager.saveMatch(matchData);
      
      // オンラインの場合はサーバーにも保存を試行
      if (this.isOnline) {
        try {
          await this.saveToServer('match', matchData);
        } catch (error) {
          console.warn('サーバー保存に失敗しましたが、ローカル保存は成功しました:', error);
        }
      }
      
      return localResult;
    } catch (error) {
      console.error('試合データの保存に失敗:', error);
      return { success: false, error: error.message };
    }
  }

  // 試合データの取得
  getMatches(tournamentId = null) {
    return this.localManager.getMatches(tournamentId);
  }

  async getMatch(matchId) {
    return await this.localManager.getMatch(matchId);
  }

  async deleteMatch(matchId) {
    try {
      // ローカルから削除
      const localResult = await this.localManager.deleteMatch(matchId);
      
      // オンラインの場合はサーバーからも削除を試行
      if (this.isOnline) {
        try {
          await this.deleteFromServer('match', matchId);
        } catch (error) {
          console.warn('サーバー削除に失敗しましたが、ローカル削除は成功しました:', error);
        }
      }
      
      return localResult;
    } catch (error) {
      console.error('試合データの削除に失敗:', error);
      return { success: false, error: error.message };
    }
  }

  // プレイヤーデータの保存・取得
  async savePlayers(tournamentId, playersData) {
    try {
      // ローカルに保存
      const localResult = await this.localManager.savePlayers(tournamentId, playersData);
      
      // オンラインの場合はサーバーにも保存を試行
      if (this.isOnline) {
        try {
          await this.saveToServer('players', { tournamentId, playersData });
        } catch (error) {
          console.warn('サーバー保存に失敗しましたが、ローカル保存は成功しました:', error);
        }
      }
      
      return localResult;
    } catch (error) {
      console.error('プレイヤーデータの保存に失敗:', error);
      return { success: false, error: error.message };
    }
  }

  getPlayers(tournamentId) {
    return this.localManager.getPlayers(tournamentId);
  }

  getAllPlayers() {
    return this.localManager.getAllPlayers();
  }

  // サーバーへの保存（実装例）
  async saveToServer(type, data) {
    // 実際のサーバーAPIエンドポイントに合わせて実装
    const response = await fetch(`/api/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`サーバー保存エラー: ${response.status}`);
    }
    
    return await response.json();
  }

  // サーバーからの削除（実装例）
  async deleteFromServer(type, id) {
    const response = await fetch(`/api/${type}/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`サーバー削除エラー: ${response.status}`);
    }
    
    return await response.json();
  }

  // データのエクスポート・インポート
  exportAllData() {
    return this.localManager.exportAllData();
  }

  async importAllData(jsonData) {
    const result = await this.localManager.importAllData(jsonData);
    
    // インポート後、オンラインの場合は同期を試行
    if (this.isOnline && result.success) {
      setTimeout(() => this.syncWithServer(), 1000);
    }
    
    return result;
  }

  // ストレージ情報の取得
  getStorageInfo() {
    const localInfo = this.localManager.getStorageInfo();
    return {
      ...localInfo,
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress
    };
  }

  // データのクリア
  clearAllData() {
    return this.localManager.clearAllData();
  }

  // 接続状態の取得
  getConnectionStatus() {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress
    };
  }

  // 手動同期
  async forcSync() {
    if (this.isOnline) {
      await this.syncWithServer();
      return { success: true, message: '同期が完了しました' };
    } else {
      return { success: false, message: 'オフラインのため同期できません' };
    }
  }
}

// グローバルインスタンスを作成
window.hybridStorageManager = new HybridStorageManager();

// 既存のlocalStorageManagerの代替として使用
window.dataManager = window.hybridStorageManager;
