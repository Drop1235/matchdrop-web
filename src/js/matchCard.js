// Match Card Component
class MatchCard {
  constructor(match) {
    this.match = match;
    this.element = null;
    this.dragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.initialLeft = 0;
    this.initialTop = 0;
    this.dragThreshold = 5; // px
    this._decidedWebhookTimer = null;
    
    const numSets = this._getNumberOfSets(); // 試合形式に応じたセット数

    // 既に setScores が提供されている場合はそれを優先
    if (this.match.setScores && Array.isArray(this.match.setScores.A) && this.match.setScores.A.length === numSets) {
      this.scoresA = [...this.match.setScores.A];
      this.scoresB = [...this.match.setScores.B];
    } else {
      // スコア文字列をパースしてセットスコアを算出
      this.scoresA = this._parseScores(this.match.scoreA, numSets);
      this.scoresB = this._parseScores(this.match.scoreB, numSets);
      // setScores が未定義、または長さが一致しない場合は、パース結果で上書き
      this.match.setScores = {
        A: [...this.scoresA],
        B: [...this.scoresB]
      };
    }

    // scoreA / scoreB 文字列を整形して保持（setScores がある場合でも最新化）
    // ただし、5game形式の場合は既存のスコアが適切であれば再フォーマットしない
    const format = (this.match.gameFormat || '').toLowerCase();
    const isSingleGame = format === '5game' || format === '4game1set' || format === '4game1set_ntb' || format === '6game1set' || format === '6game1set_ntb' || format === '8game1set';
    
    if (isSingleGame && this.match.scoreA !== undefined && this.match.scoreA !== null && this.match.scoreA !== '') {
      // 5game等の単一ゲーム形式で既にスコアが設定されている場合は保持
      console.log('[MATCH_CARD] Preserving existing scores for single game format:', this.match.scoreA, this.match.scoreB);
    } else {
      // マルチセット形式または初期化時は再フォーマット
      this.match.scoreA = this._stringifyScores(this.scoresA);
      this.match.scoreB = this._stringifyScores(this.scoresB);
    }

    // 勝者情報の初期化
    if (this.match.winner === undefined) {
      this.match.winner = null; // null, 'A', 'B' のいずれか
    }

    // Initialize game format options (should match modal)
    this.gameFormatOptions = {
      '5game': '5G',
      '4game1set': '4G1set',
      '4game1set_ntb': '4G1set NoTB',
      '6game1set': '6G1set',
      '6game1set_ntb': '6G1set NoTB',
      '8game1set': '8G-Pro',
      '4game2set': '4G2set+10MTB',
      '6game2set': '6G2set+10MTB',
      '4game3set': '4G3set',
      '6game3set': '6G3set',
    };
    
    // gameFormatが設定されていない場合のみデフォルト値を設定
    if (!this.match.gameFormat) {
      this.match.gameFormat = '6game1set_ntb';
    }

    if (!this.match.memo) this.match.memo = '';
    if (!this.match.category) this.match.category = '';
    this.match.tieBreakA = this.match.tieBreakA || '';
    this.match.tieBreakB = this.match.tieBreakB || '';
    
    this.element = this.createCardElement();
    if (!this.isReadOnly()) {
      this.setupDragAndDrop();
    }
    // These methods below will require significant updates later:
    this.updateScoreInputsInteractivity(); 
    this.updateWinStatus(); 
    this.updateEndTimeDisplay();
    this._scheduleDecidedWebhook();
    this.addDoubleClickToHistoryListener();
  }

  // 閲覧モード（非管理者）のときは編集不可
  isReadOnly() {
    try {
      if (window.isAdmin && typeof window.isAdmin === 'function') {
        return !window.isAdmin();
      }
    } catch (_) {}
    return false;
  }

  _getNumberOfSets() {
    // ゲーム形式に応じて必要なセット数を返す
    switch (this.match.gameFormat) {
      // BO3（3セット先取）
      case '4game3set':
      case '6game3set':
        return 3;
      // BO3（2セット先取）
      case '4game2set':
      case '6game2set':
        // 2セット終了後にマッチタイブレーク（ファイナルセット）が行われるため、
        // UI上は 3 セット分の入力欄を確保する
        return 3;
      // それ以外（ワンセットマッチ等）
      default:
        return 1;
    }
  }

  _parseScores(scoreString, numSets) {
    const defaultScores = Array(numSets).fill(null);
    if (typeof scoreString !== 'string' || scoreString.trim() === '') {
      return defaultScores;
    }
    const parts = scoreString.split(',');
    const scores = parts.map(s => {
      const num = parseInt(s, 10);
      return isNaN(num) ? null : num;
    });
    // Ensure the array has the correct number of sets, padding with null if necessary
    while (scores.length < numSets) {
      scores.push(null);
    }
    return scores.slice(0, numSets); // Truncate if too long (e.g., format change)
  }

  _stringifyScores(scoresArray) {
    if (!Array.isArray(scoresArray)) return '';
    return scoresArray.map(s => (s === null || s === undefined || s === '') ? '' : String(s)).join(',');
  }

  // Create the match card DOM element
  createCardElement() {
    console.log('[MATCH_CARD] createCardElement called for match ID:', this.match.id);
    
    const card = document.createElement('div');
    card.className = 'match-card';
    card.id = `match-${this.match.id}`;
    card.setAttribute('draggable', this.isReadOnly() ? 'false' : 'true');
    card.dataset.matchId = this.match.id;

    // カード上部（メモ・リーグ名・時間・削除ボタン）
    const headerDiv = document.createElement('div');
    headerDiv.className = 'match-card-header';

    // Always create a bulk checkbox and control visibility later
    const bulkCheckbox = document.createElement('input');
    bulkCheckbox.type = 'checkbox';
    bulkCheckbox.className = 'bulk-select';
    bulkCheckbox.dataset.matchId = String(this.match.id);
    bulkCheckbox.style.marginRight = '6px';
    headerDiv.appendChild(bulkCheckbox);

    // --- メモ欄（左端） ---
    const memoInput = document.createElement('input');
    memoInput.type = 'text';
    memoInput.className = 'match-card-memo';
    memoInput.placeholder = 'メモ';
    memoInput.value = this.match.memo || '';
    memoInput.addEventListener('change', (e) => {
      if (this.isReadOnly()) { e.target.value = this.match.memo || ''; return; }
      this.updateMatchData({ memo: e.target.value });
    });
    if (this.isReadOnly()) memoInput.disabled = true;
    headerDiv.appendChild(memoInput);

    // 削除ボタン (×) - ヘッダーの最後に追加
    const deleteButton = document.createElement('span');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = '×';
    deleteButton.title = 'この試合を削除'; // ツールチップ
    deleteButton.addEventListener('click', (e) => {
      if (this.isReadOnly()) { e.preventDefault(); return; }
      e.stopPropagation(); // カード全体のドラッグイベント等に影響しないように
      this.handleDeleteMatch();
    });
    if (this.isReadOnly()) deleteButton.style.display = 'none';

    // 編集ボタン（モバイル用トリガー）
    const editButton = document.createElement('span');
    editButton.className = 'edit-button';
    editButton.textContent = '✎';
    editButton.title = '編集';
    editButton.style.marginLeft = '8px';
    editButton.style.cursor = 'pointer';
    editButton.addEventListener('click', (e) => {
      if (this.isReadOnly()) { e.preventDefault(); return; }
      e.stopPropagation();
      this.openQuickEditPanel({
        anchor: card,
        categoryRow,
        gameFormatDisplay,
        playerAInput,
        playerBInput,
      });
    });
    if (this.isReadOnly()) editButton.style.display = 'none';

    // --- 試合形式・時間（右側に寄せる） ---
    // ラッパーdivでまとめて右寄せ
    const rightWrap = document.createElement('div');
    rightWrap.style.display = 'flex';
    rightWrap.style.alignItems = 'center';
    rightWrap.style.marginLeft = '12px';

    // 試合形式を表示のみにするテキスト要素を追加
    const gameFormatDisplay = document.createElement('div');
    gameFormatDisplay.className = 'match-card-game-format-display';
    
    // 現在の試合形式のラベルを取得
    const currentFormat = (this.match.gameFormat || '').toLowerCase();
    const formatLabel = this.gameFormatOptions[currentFormat] || currentFormat;
    
    // 試合形式の表示を設定
    gameFormatDisplay.textContent = formatLabel;
    gameFormatDisplay.title = '試合形式は変更できません。変更する場合は新規に試合を作成してください。ダブルクリックで試合を完了して履歴に移動します。';
    
    // ダブルクリックで試合を完了させて履歴に移動するイベントを追加
    gameFormatDisplay.addEventListener('dblclick', async (e) => {
      e.stopPropagation(); // 他のイベントへの伝播を防止
      
      try {
        // 確認ダイアログを表示
        const confirmMove = confirm('この試合を完了して履歴に移動しますか？');
        
        if (confirmMove) {
          // 勝者確定時刻を保持（既存値優先）
          const endTs = this.match.actualEndTime ||
                        this.match.completedAt ||
                        new Date().toISOString();
        
          const updatedMatch = await db.updateMatch({
            id: this.match.id,
            status: 'Completed',
            winner: this.match.winner ?? null,
            scoreA: this.match.scoreA,
            scoreB: this.match.scoreB,
            actualEndTime: endTs,
            completedAt: this.match.completedAt || endTs, // 後方互換
          });
        
          // ローカルも同期（UI更新用）
          this.match = { ...this.match, ...updatedMatch };
        
          // 更新イベントを発行
          const updateEvent = new CustomEvent('match-updated', {
            detail: { match: updatedMatch }
          });
          document.dispatchEvent(updateEvent);
          
          // 非同期でリーグWebhookに送信（UI非ブロッキング）
          try {
            const tournamentsRaw = localStorage.getItem('tournaments') || '[]';
            const tournaments = JSON.parse(tournamentsRaw);
            const currentTid = localStorage.getItem('currentTournamentId');
            const tname = (tournaments.find(t => t && t.id === currentTid) || {}).name || currentTid || '';
            const toSets = (m) => {
              const sets = [];
              const A = m?.setScores?.A || [];
              const B = m?.setScores?.B || [];
              const n = Math.max(A.length || 0, B.length || 0);
              for (let i = 0; i < n; i++) {
                const a = A[i];
                const b = B[i];
                if (a != null || b != null) {
                  sets.push({ seq: i + 1, side1_games: a ?? null, side2_games: b ?? null });
                }
              }
              return sets.length ? sets : undefined;
            };
            const winningSide = updatedMatch.winner === 'A' ? 1 : updatedMatch.winner === 'B' ? 2 : null;
            const payload = {
              tournamentName: tname,
              tournamentId: currentTid || '',
              leagueName: updatedMatch.category || '',
              externalId: updatedMatch.externalId || updatedMatch.matchExternalId || updatedMatch.id,
              side1Name: updatedMatch.playerA,
              side2Name: updatedMatch.playerB,
              status: 'COMPLETED',
              winningSide,
              sets: toSets(updatedMatch),
            };
            if (typeof window.sendResultToLeague === 'function') {
              window.sendResultToLeague(payload).then((res) => {
                if (res && res.ignored) {
                  const msg = `[ignored] ${payload.leagueName} ${payload.side1Name} vs ${payload.side2Name} (ext=${payload.externalId}): ${res.reason || ''}`;
                  console.warn(msg);
                  try { if (typeof window.showToast === 'function') window.showToast(msg); } catch {}
                }
              }).catch(e => console.warn('league webhook failed', e));
            }
          } catch (e) {
            console.warn('league webhook skipped', e);
          }
        }
      } catch (error) {
        console.error('試合の完了処理中にエラーが発生しました:', error);
        alert('試合の完了処理中にエラーが発生しました');
      }
    });
    
    console.log('[MATCH_CARD] Setting game format display:', formatLabel);
    
    rightWrap.appendChild(gameFormatDisplay);

    // 実際の終了時間
    const endTimeInput = document.createElement('input');
    endTimeInput.type = 'time';
    endTimeInput.className = 'match-end-time-input';
    if (this.match.actualEndTime) {
      const endTime = new Date(this.match.actualEndTime);
      const hours = endTime.getHours().toString().padStart(2, '0');
      const minutes = endTime.getMinutes().toString().padStart(2, '0');
      endTimeInput.value = `${hours}:${minutes}`;
    }
    endTimeInput.addEventListener('change', (e) => {
      if (this.isReadOnly()) { e.preventDefault(); e.target.value = this.match.actualEndTime ? e.target.value : ''; return; }
      if (e.target.value) {
        // 現在の日付を取得し、時間だけ変更
        const now = new Date();
        const [hours, minutes] = e.target.value.split(':');
        now.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        this.updateMatchData({ actualEndTime: now.toISOString() });
      } else {
        this.updateMatchData({ actualEndTime: null });
      }
      this.checkLeagueWinCondition();
    });
    if (this.isReadOnly()) endTimeInput.disabled = true;
    
    // keep reference for updateEndTimeDisplay
    this.endTimeInput = endTimeInput;
    rightWrap.appendChild(endTimeInput);

    // rightWrapをheaderDivに追加（削除ボタンの前に）
    headerDiv.appendChild(rightWrap);
    headerDiv.appendChild(editButton);
    headerDiv.appendChild(deleteButton);

    // initial visibility for bulk checkbox
    this.updateBulkSelectVisibility();

    // メタ情報行: 左にコート情報、右にカテゴリ（例: 「コート1　リーグ3」）
    const metaRow = document.createElement('div');
    metaRow.className = 'match-card-meta';
    // 左: コート情報
    const courtInfo = document.createElement('span');
    courtInfo.className = 'match-card-court';
    const cn = this.match.courtNumber != null ? parseInt(this.match.courtNumber, 10) : null;
    courtInfo.textContent = cn ? `コート${cn}` : '';
    // 右: カテゴリ
    const categorySpan = document.createElement('span');
    categorySpan.className = 'match-card-category';
    categorySpan.textContent = this.match.category || '';
    metaRow.appendChild(courtInfo);
    metaRow.appendChild(categorySpan);

    // プレイヤー情報（縦に配置）
    const playersContainer = document.createElement('div');
    playersContainer.className = 'match-card-players-container';
    
    // プレイヤーA
    const playerADiv = document.createElement('div');
    playerADiv.className = 'match-card-player';
    // プレイヤー名
    const playerAInput = document.createElement('input');
    playerAInput.type = 'text';
    playerAInput.className = 'player-name-input';
    playerAInput.dataset.player = 'A'; // Add data-player attribute
    playerAInput.value = this.match.playerA;
    playerAInput.addEventListener('change', (e) => {
      if (this.isReadOnly()) { e.target.value = this.match.playerA || ''; return; }
      this.updateMatchData({ playerA: e.target.value });
    });
    if (this.isReadOnly()) playerAInput.disabled = true;
    
    // プレイヤー名の入力欄をそのまま追加
    playerADiv.appendChild(playerAInput);
    
    // スコア入力A
    let scoreContainerA; // プレイヤーAのスコア用ラッパーを先に宣言
    if (this.match.gameFormat === '6game3set' || this.match.gameFormat === '4game3set' || 
        this.match.gameFormat === '4game2set' || this.match.gameFormat === '6game2set') {
      // BO3形式の場合は3セット分のスコア入力欄を表示
      scoreContainerA = document.createElement('div');
      scoreContainerA.style.display = 'flex';
      scoreContainerA.style.flexDirection = 'column';
      scoreContainerA.style.alignItems = 'center';
      scoreContainerA.style.gap = '2px';

      const setScoresContainerA = document.createElement('div');
      setScoresContainerA.className = 'set-scores-container';
       
      this.tiebreakDivsA = [];
      // A側セットスコア入力欄をコンテナに追加
      scoreContainerA.appendChild(setScoresContainerA);

      // --- タイブレーク行をカード下部にまとめて表示するためのコンテナを用意 ---
      if (!this.tiebreakRow) {
        const tRow = document.createElement('div');
        tRow.className = 'tiebreak-row';
        tRow.style.display = 'none';      // デフォルトは非表示、条件満たしたら表示
        tRow.style.justifyContent = 'flex-end';
        tRow.style.marginLeft = 'auto';
        tRow.style.gap = '6px';
        tRow.style.marginTop = '4px';
        this.tiebreakRow = tRow;
      }
      // 3セット分のスコア入力欄を作成
      for (let i = 0; i < 3; i++) {
        const setScoreInput = document.createElement('input');
        setScoreInput.type = 'number';
        setScoreInput.min = '0';
        setScoreInput.max = '99';
        setScoreInput.className = 'set-score-input';
        // データ属性を2種類保持しておくことで既存実装とユーティリティの両方に対応
        setScoreInput.dataset.player = 'A';
        setScoreInput.dataset.setPlayer = 'A';
        setScoreInput.dataset.set = i;
        setScoreInput.value = this.match.setScores?.A[i] || '';
        
        setScoreInput.addEventListener('change', (e) => {
          if (this.isReadOnly()) { e.target.value = this.match.setScores?.A[i] || ''; return; }
          // セットスコアを更新
          if (!this.match.setScores) {
            this.match.setScores = { A: [0, 0, 0], B: [0, 0, 0] };
          }
          this.match.setScores.A[i] = parseInt(e.target.value) || 0;
          
          // 全体のスコアを計算（勝ったセット数）
          this.calculateTotalScore();
          
          // DB更新
          this.updateMatchData({
            scoreA: this.match.scoreA,
            scoreB: this.match.scoreB,
            setScores: this.match.setScores
          });
          
          this.updateDynamicElements();
          this.checkLeagueWinCondition();
        });
        
        setScoreInput.addEventListener('click', (e) => {
          e.stopPropagation();
        });
        
        setScoresContainerA.appendChild(setScoreInput);
        // --- 各セット用タイブレーク入力欄 ---
        const tbWrapper = document.createElement('span');
        tbWrapper.style.display = 'none'; // 初期非表示
        tbWrapper.style.marginLeft = '2px';
        const tbOpen = document.createElement('span'); tbOpen.textContent='('; tbOpen.style.fontSize='0.8em';
        const tbInput = document.createElement('input');
        tbInput.type='number'; tbInput.min='0'; tbInput.max='99'; tbInput.dataset.tiebreak='A'; tbInput.dataset.set=i; tbInput.style.width='40px'; tbInput.style.fontSize='0.7em';
        const tbClose = document.createElement('span'); tbClose.textContent=')'; tbClose.style.fontSize='0.8em';
        tbWrapper.appendChild(tbOpen);
        tbWrapper.appendChild(tbInput);
        tbWrapper.appendChild(tbClose);
        // wrapper は下部の tiebreakRow へ追加
        this.tiebreakRow.appendChild(tbWrapper);
        // 参照配列に保持（_checkAndToggleTiebreakUI が利用）
        if (!this.tiebreakWrappers) this.tiebreakWrappers = [];
        if (!this.tiebreakInputs) this.tiebreakInputs = [];
        this.tiebreakWrappers[i] = tbWrapper;
        this.tiebreakInputs[i] = tbInput;
        this.tiebreakDivsA[i] = { wrapper: tbWrapper, input: tbInput };
        tbInput.addEventListener('change',(e)=>{ if (this.isReadOnly()) { e.target.value = this.match.tieBreakA?.[i] ?? ''; return; } const v=e.target.value; const sc=v===''?null:parseInt(v,10); if(!this.match.tieBreakA) this.match.tieBreakA=[]; this.match.tieBreakA[i]=sc; this.updateMatchData({tieBreakA:this.match.tieBreakA});});
      }

      // --- タイブレーク入力欄（A） ---
      const tiebreakDivA = document.createElement('div');
      tiebreakDivA.className = 'tiebreak-score-container-a';
      tiebreakDivA.style.display = 'inline-block';
      tiebreakDivA.style.marginTop = '2px';

      const tiebreakInputA = document.createElement('input');
      tiebreakInputA.type = 'number';
      tiebreakInputA.min = '0';
      tiebreakInputA.max = '99';
      tiebreakInputA.className = 'tiebreak-score-input';
      tiebreakInputA.dataset.tiebreak = 'A';
      tiebreakInputA.style.width = '40px'; // 幅を調整し2桁数字に対応
      tiebreakInputA.style.height = '20px'; // 高さを小さく
      tiebreakInputA.style.fontSize = '0.8em'; // フォントサイズを小さく
      tiebreakInputA.style.padding = '0 2px'; // パディングを小さく
      tiebreakInputA.placeholder = 'TB';
      // 既存のタイブレークスコア値を設定
      tiebreakInputA.value = this.match.tieBreakA || '';

      const tbOpenParenA = document.createElement('span'); tbOpenParenA.textContent='('; tbOpenParenA.style.fontSize='0.8em';
      const tbCloseParenA = document.createElement('span'); tbCloseParenA.textContent=')'; tbCloseParenA.style.fontSize='0.8em';
      tiebreakDivA.appendChild(tbOpenParenA); tiebreakDivA.appendChild(tiebreakInputA); tiebreakDivA.appendChild(tbCloseParenA);

      tiebreakInputA.addEventListener('change',(e)=>{ if (this.isReadOnly()) { e.target.value = this.match.tieBreakA ?? ''; return; } const v=e.target.value; const sc=v===''?null:parseInt(v,10); this.match.tieBreakA=sc; this.updateMatchData({tieBreakA:this.match.tieBreakA}); });
      tiebreakInputA.addEventListener('click',(e)=>e.stopPropagation());

      // scoreContainerAへ追加
      // duplicate removed
      

      // 廃止: per-set TB に置き換え

      // scoreContainerA は後で scoreWinContainerA にまとめて追加
      
      // 合計スコア表示用の要素
      const totalScoreA = document.createElement('div');
      totalScoreA.className = 'total-score';
      totalScoreA.textContent = this.match.scoreA || '0';
      totalScoreA.dataset.player = 'A';
      // totalScoreA は後で scoreWinContainerA にまとめて追加
    } else {
      // 通常のスコア入力欄
      const scoreAInput = document.createElement('input');
      scoreAInput.type = 'number';
      scoreAInput.min = '0';
      scoreAInput.max = '99';
      scoreAInput.className = 'score-input';
      scoreAInput.dataset.player = 'A';
      scoreAInput.value = (this.match.scoreA === null || this.match.scoreA === undefined) ? '' : this.match.scoreA;
      this.scoreAInput = scoreAInput; // Assign to instance property
      
      scoreAInput.addEventListener('change', (e) => {
        if (this.isReadOnly()) { e.target.value = (this.match.scoreA ?? '') === '' ? '' : this.match.scoreA; return; }
        this.match.scoreA = parseInt(e.target.value) || 0;
        this.updateMatchData({ scoreA: this.match.scoreA });
        this.updateDynamicElements();
        console.log('[DEBUG] scoreA changed:', this.match.scoreA, 'gameFormat:', this.match.gameFormat);
        this.checkLeagueWinCondition();
      });
      if (this.isReadOnly()) scoreAInput.disabled = true;
      
      scoreAInput.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      // スコア入力欄の上にタイブレーク入力欄を表示するコンテナ
      scoreContainerA = document.createElement('div');
      scoreContainerA.style.display = 'flex';
      scoreContainerA.style.flexDirection = 'column';
      scoreContainerA.style.alignItems = 'center';
      scoreContainerA.style.gap = '2px';
      
      // タイブレーク入力欄のクローンを作成
      const tiebreakDivA = document.createElement('div');
      tiebreakDivA.className = 'tiebreak-score-container-a';
      tiebreakDivA.style.display = 'inline-block'; // ラッパー側で表示制御
      tiebreakDivA.style.marginTop = '2px'; // スコア入力欄との間隔
      
      // タイブレークスコア入力フィールド
      const tiebreakInputA = document.createElement('input');
      tiebreakInputA.type = 'number';
      tiebreakInputA.min = '0';
      tiebreakInputA.max = '99';
      tiebreakInputA.className = 'tiebreak-score-input';
      tiebreakInputA.dataset.tiebreak = 'A'; // data-tiebreak属性を追加
      tiebreakInputA.style.width = '40px'; // 幅を調整し2桁数字に対応
      tiebreakInputA.style.height = '20px'; // 高さを小さく
      tiebreakInputA.style.fontSize = '0.8em'; // フォントサイズを小さく
      tiebreakInputA.style.padding = '0 2px'; // パディングを小さく
      tiebreakInputA.style.pointerEvents = 'auto'; // クリック可能にする
      tiebreakInputA.style.cursor = 'text'; // テキスト入力カーソルを表示
      tiebreakInputA.placeholder = 'TB';
      tiebreakInputA.tabIndex = 0; // タブフォーカス可能にする
      // 既存のタイブレークスコア値を設定
      tiebreakInputA.value = this.match.tieBreakA || '';
      
      // カッコで囲む
      const tbOpenParenA = document.createElement('span');
      tbOpenParenA.textContent = '(';
      tbOpenParenA.style.fontSize = '0.8em';
      
      const tbCloseParenA = document.createElement('span');
      tbCloseParenA.textContent = ')';
      tbCloseParenA.style.fontSize = '0.8em';
      
      tiebreakDivA.appendChild(tbOpenParenA);
      tiebreakDivA.appendChild(tiebreakInputA);
      tiebreakDivA.appendChild(tbCloseParenA);
      
      // タイブレーク入力のイベントリスナーを設定
      tiebreakInputA.addEventListener('change', (e) => {
        if (this.isReadOnly()) { e.target.value = this.match.tieBreakA ?? ''; return; }
        const value = e.target.value;
        const score = value === '' ? null : parseInt(value, 10);
        this.match.tieBreakA = score;
        this.updateMatchData({ tieBreakA: this.match.tieBreakA });
      });
      
      tiebreakInputA.addEventListener('click', (e) => {
        if (this.isReadOnly()) return;
        e.stopPropagation();
        // フォーカスを確実に当てる
        e.target.focus();
      });
      
      // フォーカスイベントを追加
      tiebreakInputA.addEventListener('focus', (e) => {
        console.log('[MATCH_CARD] タイブレーク入力欄にフォーカス');
        e.target.select(); // フォーカス時にテキストを選択
      });
      
      // マウスダウンイベントを追加
      tiebreakInputA.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      
      // スコア入力欄のみ scoreContainerA に追加
      scoreContainerA.appendChild(scoreAInput);

      // ---- 1セット形式用タイブレーク行を作成 ----
      const tiebreakRow = document.createElement('div');
      tiebreakRow.className = 'tiebreak-row';
      // 初期は非表示。_checkAndToggleTiebreakUI で条件を満たしたら "flex" に変更される
      // 初期は非表示とし、表示条件を満たした際に _checkAndToggleTiebreakUI で "flex" に切り替える
      tiebreakRow.style.display = 'none';
      tiebreakRow.style.justifyContent = 'flex-end';
      tiebreakRow.style.gap = '8px';
      // 右端に寄せるために左側をautoにする
      tiebreakRow.style.marginLeft = 'auto';

      // 個別ラッパー（1セットなので1つのみ）
      const wrapper = document.createElement('span');
      wrapper.style.display = 'none'; // 初期非表示。トグル時に inline-block
      wrapper.appendChild(tiebreakDivA);
      tiebreakRow.appendChild(wrapper);

      // MatchCard プロパティへ保持し、_checkAndToggleTiebreakUI が参照できるようにする
      this.tiebreakRow = tiebreakRow;
      this.tiebreakWrappers = [wrapper];
      this.tiebreakDivA = tiebreakDivA;
      this.tiebreakInputA = tiebreakInputA;

      // playersContainer へは createCardElement の末尾でまとめて追加される
      
      // scoreContainerA は後で scoreWinContainerA にまとめて追加
    }
    
    // Win表示/ボタン（プレイヤーA）
    const winADiv = document.createElement('div');
    winADiv.className = 'win-label';
    winADiv.dataset.player = 'A';
    
    // 常にクリックイベントを追加するように修正
    winADiv.textContent = this.match.winner === 'A' ? '✔' : '●';
    winADiv.style.color = this.match.winner === 'A' ? 'red' : '';
    if (this.match.winner === 'A') {
      winADiv.classList.remove('win-button');
    } else {
      winADiv.classList.add('win-button');
    }
    
    // 右寄せ用コンテナを生成して A 行に配置
    const scoreWinContainerA = document.createElement('div');
    scoreWinContainerA.style.display = 'flex';
    scoreWinContainerA.style.alignItems = 'center';
    scoreWinContainerA.style.gap = '4px';
    scoreWinContainerA.style.marginLeft = 'auto';

    scoreWinContainerA.appendChild(winADiv);
    if (typeof totalScoreA !== 'undefined') scoreWinContainerA.appendChild(totalScoreA);
    scoreWinContainerA.appendChild(scoreContainerA);
    playerADiv.appendChild(scoreWinContainerA);

    // --- A行を playersContainer に追加 ---
    playersContainer.appendChild(playerADiv);

    // ================================
    // プレイヤーB行の生成
    const playerBDiv = document.createElement('div');
    playerBDiv.className = 'match-card-player';

    const playerBInput = document.createElement('input');
    playerBInput.type = 'text';
    playerBInput.className = 'player-name-input';
    playerBInput.dataset.player = 'B';
    playerBInput.value = this.match.playerB;
    playerBInput.addEventListener('change', (e) => {
      if (this.isReadOnly()) { e.target.value = this.match.playerB || ''; return; }
      this.updateMatchData({ playerB: e.target.value });
    });
    if (this.isReadOnly()) playerBInput.disabled = true;
    playerBDiv.appendChild(playerBInput);

    // スコア入力B
    let scoreContainerB;
    if (this.match.gameFormat === '6game3set' || this.match.gameFormat === '4game3set' ||
        this.match.gameFormat === '4game2set' || this.match.gameFormat === '6game2set') {
      // BO3 形式
      scoreContainerB = document.createElement('div');
      scoreContainerB.style.display = 'flex';
      scoreContainerB.style.flexDirection = 'column';
      scoreContainerB.style.alignItems = 'center';
      scoreContainerB.style.gap = '2px';

      const setScoresContainerB = document.createElement('div');
      setScoresContainerB.className = 'set-scores-container';

      for (let i = 0; i < 3; i++) {
        const setInput = document.createElement('input');
        setInput.type = 'number';
        setInput.min = '0';
        setInput.max = '99';
        setInput.className = 'set-score-input';
        setInput.dataset.player = 'B';
        setInput.dataset.setPlayer = 'B';
        setInput.dataset.set = i;
        setInput.value = this.match.setScores?.B[i] || '';

        setInput.addEventListener('change', (e) => {
          if (!this.match.setScores) {
            this.match.setScores = { A: [0,0,0], B: [0,0,0] };
          }
          this.match.setScores.B[i] = parseInt(e.target.value) || 0;
          this.calculateTotalScore();
          this.updateMatchData({
            scoreA: this.match.scoreA,
            scoreB: this.match.scoreB,
            setScores: this.match.setScores
          });
          this.updateDynamicElements();
          this.checkLeagueWinCondition();
        });
        setInput.addEventListener('click', (e) => e.stopPropagation());
        setScoresContainerB.appendChild(setInput);
      }

      scoreContainerB.appendChild(setScoresContainerB);

      // 合計スコア（セットカウント）はスコア入力欄の左側に配置するため、
      // scoreWinContainerB へ後で追加
      const totalScoreB = document.createElement('div');
      totalScoreB.className = 'total-score';
      totalScoreB.textContent = this.match.scoreB || '0';
      totalScoreB.dataset.player = 'B';
    } else {
      // 単セット形式
      const scoreBInput = document.createElement('input');
      scoreBInput.type = 'number';
      scoreBInput.min = '0';
      scoreBInput.max = '99';
      scoreBInput.className = 'score-input';
      scoreBInput.dataset.player = 'B';
      scoreBInput.value = (this.match.scoreB === null || this.match.scoreB === undefined) ? '' : this.match.scoreB;
      this.scoreBInput = scoreBInput;

      scoreBInput.addEventListener('change', (e) => {
        if (this.isReadOnly()) { e.target.value = (this.match.scoreB ?? '') === '' ? '' : this.match.scoreB; return; }
        this.match.scoreB = parseInt(e.target.value) || 0;
        this.updateMatchData({ scoreB: this.match.scoreB });
        this.updateDynamicElements();
        this.checkLeagueWinCondition();
      });
      if (this.isReadOnly()) scoreBInput.disabled = true;
      scoreBInput.addEventListener('click', (e) => e.stopPropagation());

      scoreContainerB = document.createElement('div');
      scoreContainerB.style.display = 'flex';
      scoreContainerB.style.flexDirection = 'column';
      scoreContainerB.style.alignItems = 'center';
      scoreContainerB.style.gap = '2px';
      scoreContainerB.appendChild(scoreBInput);

      // B側タイブレーク入力欄（常時非表示、UI一貫性のため要素のみ保持）
      const tiebreakDivB = document.createElement('div');
      tiebreakDivB.className = 'tiebreak-score-container-b';
      tiebreakDivB.style.display = 'inline-block';
      this.tiebreakDivB = tiebreakDivB;
      scoreContainerB.appendChild(tiebreakDivB);
    }

    // WinラベルB
    const winBDiv = document.createElement('div');
    winBDiv.className = 'win-label';
    winBDiv.dataset.player = 'B';
    winBDiv.textContent = this.match.winner === 'B' ? '✔' : '●';
    winBDiv.style.color = this.match.winner === 'B' ? 'red' : '';
    if (this.match.winner !== 'B') winBDiv.classList.add('win-button');

    const scoreWinContainerB = document.createElement('div');
    scoreWinContainerB.style.display = 'flex';
    scoreWinContainerB.style.alignItems = 'center';
    scoreWinContainerB.style.gap = '4px';
    scoreWinContainerB.style.marginLeft = 'auto';

    scoreWinContainerB.appendChild(winBDiv);
    // セットカウントをスコア入力欄の左側に配置
    if (typeof totalScoreB !== 'undefined') scoreWinContainerB.appendChild(totalScoreB);
    scoreWinContainerB.appendChild(scoreContainerB);
    playerBDiv.appendChild(scoreWinContainerB);

    winBDiv.addEventListener('click', (e) => {
      if (this.isReadOnly()) { e.preventDefault(); return; }
      e.stopPropagation();
      if (this.match.winner === 'B') {
        this.match.winner = null;
        this.match.actualEndTime = null;
      } else {
        this.match.winner = 'B';
        const now = new Date();
        this.match.actualEndTime = now.toISOString();
      }
      this.updateMatchData({ winner: this.match.winner, actualEndTime: this.match.actualEndTime });
      this.updateWinStatus();
      this.updateEndTimeDisplay();
      // schedule DECIDED webhook if winner is set
      this._scheduleDecidedWebhook();
    });

    // playersContainer にB行を追加
    playersContainer.appendChild(playerBDiv);


    // Winボタンのクリックイベントを追加
    winADiv.addEventListener('click', (e) => {
      if (this.isReadOnly()) { e.preventDefault(); return; }
      e.stopPropagation(); // ダブルクリックイベントの伝播を防止
      
      // 現在の勝者をクリア
      if (this.match.winner === 'A') {
        this.match.winner = null;
        // Win状態が解除されたときに終了時刻をクリア
        this.match.actualEndTime = null;
      } else {
        // Aを勝者に設定
        this.match.winner = 'A';
        // Win状態になったときに現在時刻を自動設定
        const now = new Date();
        this.match.actualEndTime = now.toISOString();
      }
      
      // DB更新
      this.updateMatchData({ 
        winner: this.match.winner,
        actualEndTime: this.match.actualEndTime 
      });
      this.updateWinStatus();
      this.updateEndTimeDisplay();
      // schedule DECIDED webhook if winner is set
      this._scheduleDecidedWebhook();
    }); // ← クリックハンドラをここで閉じる
      

      // duplicate removed
      

      

      
      /* duplicate block removed
      tiebreakRow.className = 'tiebreak-row';
      tiebreakRow.style.display = 'flex'; // 常時表示行（個別ラッパーをトグル）
      tiebreakRow.style.justifyContent = 'flex-end';
      tiebreakRow.style.gap = '8px';
      tiebreakRow.style.marginRight = '40px';

      this.tiebreakWrappers = [];
      this.tiebreakInputs = [];
      // 3セット分のTB入力欄を横に並べる
      for (let i = 0; i < 3; i++) {
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline-block'; // 個別初期非表示
        const open = document.createElement('span'); open.textContent='('; open.style.fontSize='0.8em';
        const input = document.createElement('input');
        input.type='number'; input.min='0'; input.max='99'; input.dataset.tiebreak='A'; input.dataset.set=i; input.style.width='40px'; input.style.fontSize='0.8em'; input.placeholder='TB';
        const close = document.createElement('span'); close.textContent=')'; close.style.fontSize='0.8em';
        wrapper.appendChild(open); wrapper.appendChild(input); wrapper.appendChild(close);
        tiebreakRow.appendChild(wrapper);
        this.tiebreakWrappers[i]=wrapper;
        this.tiebreakInputs[i]=input;
        input.addEventListener('change',(e)=>{
          const v=e.target.value; const sc=v===''?null:parseInt(v,10);
          if(!Array.isArray(this.match.tieBreakA)) this.match.tieBreakA=[null,null,null];
          this.match.tieBreakA[i]=sc;
          this.updateMatchData({ tieBreakA: this.match.tieBreakA });
        });
        input.addEventListener('click',e=>e.stopPropagation());
      }
    duplicate block end */

  if (!card.contains(headerDiv)) {
    card.appendChild(headerDiv);
    card.appendChild(metaRow);
    card.appendChild(playersContainer);
  }

  // TB行を playersContainer の下に追加（存在する場合のみ）
  if (this.tiebreakRow && !playersContainer.contains(this.tiebreakRow)) {
    playersContainer.appendChild(this.tiebreakRow);
  }

  // 空白領域ダブルクリックでクイック編集（カード/ヘッダー/カテゴリ/プレイヤー領域すべてにバインド）
  const attachEditDblclick = (el) => {
    if (!el) return;
    el.addEventListener('dblclick', (e) => {
      const interactive = e.target.closest('input, select, button, .delete-button, .win-label, .set-score-input, .score-input, .tiebreak-score-input');
      if (interactive) return; // 入力系は除外
      console.log('[MATCH_CARD] dblclick openQuickEditPanel id=', this.match.id);
      this.openQuickEditPanel({
        anchor: card,
        categoryRow,
        gameFormatDisplay,
        playerAInput,
        playerBInput,
      });
    });
  };
  attachEditDblclick(card);
  attachEditDblclick(headerDiv);
  attachEditDblclick(categoryRow);
  attachEditDblclick(playersContainer);

  this._checkAndToggleTiebreakUI();
  return card;
} // End of createCardElement

openQuickEditPanel(ctx) {
  const { anchor, categoryRow, gameFormatDisplay, playerAInput, playerBInput } = ctx;
  const panel = document.createElement('div');
  panel.style.position = 'absolute';
  panel.style.zIndex = 1000;
  const rect = anchor.getBoundingClientRect();
  panel.style.left = `${rect.left + window.scrollX + 8}px`;
  panel.style.top = `${rect.top + window.scrollY + 8}px`;
  panel.style.background = '#fff';
  panel.style.border = '1px solid #ccc';
  panel.style.borderRadius = '8px';
  panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
  panel.style.padding = '10px';
  panel.style.display = 'grid';
  panel.style.gridTemplateColumns = 'auto auto';
  panel.style.gap = '6px 8px';

  const labelFmt = document.createElement('label');
  labelFmt.textContent = '形式';
  const selFmt = document.createElement('select');
  Object.entries(this.gameFormatOptions).forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label; selFmt.appendChild(opt);
  });
  selFmt.value = (this.match.gameFormat || '5game');

  const labelCat = document.createElement('label');
  labelCat.textContent = 'カテゴリ';
  const inpCat = document.createElement('input');
  inpCat.type = 'text';
  inpCat.value = this.match.category || '';

  const labelA = document.createElement('label');
  labelA.textContent = '選手A';
  const inpA = document.createElement('input');
  inpA.type = 'text';
  inpA.value = this.match.playerA || '';

  const labelB = document.createElement('label');
  labelB.textContent = '選手B';
  const inpB = document.createElement('input');
  inpB.type = 'text';
  inpB.value = this.match.playerB || '';

  const btnSave = document.createElement('button');
  btnSave.textContent = '保存';
  btnSave.style.gridColumn = '1 / span 2';
  btnSave.addEventListener('click', async () => {
    const newFmt = selFmt.value;
    const newCat = inpCat.value;
    const newA = inpA.value;
    const newB = inpB.value;
    await this.updateMatchData({ gameFormat: newFmt, category: newCat, playerA: newA, playerB: newB });
    if (categoryRow) categoryRow.textContent = newCat || '';
    if (playerAInput) playerAInput.value = newA || '';
    if (playerBInput) playerBInput.value = newB || '';
    if (gameFormatDisplay) {
      const label = this.gameFormatOptions[newFmt] || newFmt;
      gameFormatDisplay.textContent = label;
    }
    this._checkAndToggleTiebreakUI();
    document.body.removeChild(panel);
    // Auto-push to cloud (admin only; debounced)
    if (window.maybeAutoPush) window.maybeAutoPush('quick-edit');
  });

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'キャンセル';
  btnCancel.style.marginLeft = '8px';
  btnCancel.addEventListener('click', () => {
    document.body.removeChild(panel);
  });

  panel.appendChild(labelFmt); panel.appendChild(selFmt);
  panel.appendChild(labelCat); panel.appendChild(inpCat);
  panel.appendChild(labelA); panel.appendChild(inpA);
  panel.appendChild(labelB); panel.appendChild(inpB);
  panel.appendChild(btnSave); panel.appendChild(btnCancel);
  document.body.appendChild(panel);
}

  // Handles changes in the tiebreak score input fields
  _handleTiebreakChange(event) {
    const player = event.target.dataset.player;
    const value = event.target.value;
    const score = value === '' ? null : parseInt(value, 10);

    if (player === 'A') {
      this.match.tieBreakA = score;
      this.updateMatchData({ tieBreakA: this.match.tieBreakA });
    } else if (player === 'B') {
      this.match.tieBreakB = score;
      this.updateMatchData({ tieBreakB: this.match.tieBreakB });
    }
    // console.log(`[MATCH_CARD] Tiebreak score updated for player ${player}:`, score, this.match);
  }

  // タイブレーク入力欄の表示・非表示を制御
  _checkAndToggleTiebreakUI() {
    // 4G/6G 1set NoTB は常にタイブレーク入力を非表示にする
    const format = (this.match.gameFormat || '').toLowerCase();
    if (format === '6game1set_ntb' || format === '4game1set_ntb') {
      if (this.tiebreakWrappers && Array.isArray(this.tiebreakWrappers)) {
        this.tiebreakWrappers.forEach(w => w.style.display = 'none');
      }
      if (this.tiebreakRow) this.tiebreakRow.style.display = 'none';
      // 既に入力されていた値はリセット
      if (this.match.tieBreakA !== null) {
        this.match.tieBreakA = null;
      }
      if (this.match.tieBreakB !== null) {
        this.match.tieBreakB = null;
      }
      return; // 早期リターンで他形式のロジックをスキップ
    }

    // --- 既存処理 ---
    // （format は既に上で定義済み）

    // 1セット方式用に合計スコアを取得（未入力は -1 扱い）
    let scoreA = parseInt(this.match.scoreA, 10);
    let scoreB = parseInt(this.match.scoreB, 10);
    if (isNaN(scoreA)) scoreA = -1;
    if (isNaN(scoreB)) scoreB = -1;

    let showTiebreak = false;

    // 5G 形式 (4-5 / 5-4) はタイブレーク
    if (format === '5game' && ((scoreA === 5 && scoreB === 4) || (scoreA === 4 && scoreB === 5))) {
      showTiebreak = true;
    }

    // BO3 形式 (4G/6G/8G 2set・3set 等) の判定
    if (format.startsWith('6game') || format.startsWith('4game') || format.startsWith('8game')) {
      const setScores = this.match.setScores || { A: [], B: [] };
      for (let i = 0; i < setScores.A.length; i++) {
        const sA = parseInt(setScores.A[i], 10);
        const sB = parseInt(setScores.B[i], 10);
        if (isNaN(sA) || isNaN(sB)) continue;

        if (format.startsWith('6game')) {
          if ((sA === 7 && sB === 6) || (sA === 6 && sB === 7)) {
            showTiebreak = true;
            break;
          }
        } else if (format.startsWith('4game')) {
          if ((sA === 5 && sB === 4) || (sA === 4 && sB === 5)) {
            showTiebreak = true;
            break;
          }
        } else if (format.startsWith('8game')) {
          if ((sA === 9 && sB === 8) || (sA === 8 && sB === 9)) {
            showTiebreak = true;
            break;
          }
        }
      }
    }

    // 単セット形式のTB表示条件
    if (!showTiebreak) {
      if (format === '6game1set' && ((scoreA === 7 && scoreB === 6) || (scoreA === 6 && scoreB === 7))) {
        showTiebreak = true;
      } else if (format === '4game1set' && ((scoreA === 5 && scoreB === 4) || (scoreA === 4 && scoreB === 5))) {
        showTiebreak = true;
      } else if (format === '8game1set' && ((scoreA === 9 && scoreB === 8) || (scoreA === 8 && scoreB === 9))) {
        showTiebreak = true;
      }
    }

    // ----- 表示・非表示の反映 -----
    if (showTiebreak) {
      // セット毎の表示判定 (BO3 用)
      if (this.tiebreakWrappers && Array.isArray(this.tiebreakWrappers)) {
        const setScores = this.match.setScores || { A: [], B: [] };
        this.tiebreakWrappers.forEach((wrapper, idx) => {
          const sA = parseInt(setScores.A[idx], 10);
          const sB = parseInt(setScores.B[idx], 10);
          let show = false;

          if (format.startsWith('6game') && ((sA === 7 && sB === 6) || (sA === 6 && sB === 7))) show = true;
          if (format.startsWith('4game') && ((sA === 5 && sB === 4) || (sA === 4 && sB === 5))) show = true;
          if (format.startsWith('8game') && ((sA === 9 && sB === 8) || (sA === 8 && sB === 9))) show = true;

          // 2set+10MTB 形式ではファイナルセット（idx === 2）はマッチタイブレークのため別入力欄を表示しない
          if ((this.match.gameFormat === '4game2set' || this.match.gameFormat === '6game2set') && idx === 2) {
            show = false;
          }

          wrapper.style.display = show ? 'inline-block' : 'none';
          if (show) {
            const stored = Array.isArray(this.match.tieBreakA) ? this.match.tieBreakA[idx] : '';
            if (this.tiebreakInputs && this.tiebreakInputs[idx]) {
              const input = this.tiebreakInputs[idx];
              input.value = stored != null ? stored : '';
              // 入力フィールドをアクティブにする
              input.disabled = false;
              input.readOnly = false;
              input.style.pointerEvents = 'auto';
              input.style.cursor = 'text';
              input.tabIndex = 0;
              console.log('[MATCH_CARD] タイブレーク入力欄をアクティブ化:', idx);
            }
          }
        });
      }

      // 行全体を表示して、B 側入力欄は常に非表示
      // 1set 形式では先頭ラッパーのみ表示し、他は非表示
    if (format.includes('1set') && this.tiebreakWrappers && this.tiebreakWrappers.length) {
      this.tiebreakWrappers.forEach((w, idx) => {
        w.style.display = idx === 0 ? 'inline-block' : 'none';
        // 先頭ラッパーの入力フィールドをアクティブ化
        if (idx === 0 && this.tiebreakInputs && this.tiebreakInputs[idx]) {
          const input = this.tiebreakInputs[idx];
          input.disabled = false;
          input.readOnly = false;
          input.style.pointerEvents = 'auto';
          input.style.cursor = 'text';
          input.tabIndex = 0;
          console.log('[MATCH_CARD] 1セット形式タイブレーク入力欄をアクティブ化');
        }
      });
    }
      // ラッパーのいずれかが表示されているか確認し、行全体を切り替え
      const anyVisible = this.tiebreakWrappers && Array.from(this.tiebreakWrappers).some(w => w.style.display !== 'none');
      if (this.tiebreakRow) this.tiebreakRow.style.display = anyVisible ? 'flex' : 'none';
      if (this.tiebreakDivB) this.tiebreakDivB.style.display = anyVisible ? 'inline-block' : 'none';
    } else {
      // 非表示時
      if (this.tiebreakWrappers) this.tiebreakWrappers.forEach(w => w.style.display = 'none');
      if (this.tiebreakRow) this.tiebreakRow.style.display = 'none';
    }
  }


    /* DUPLICATE TIEBREAK LOGIC - START
    if (isNaN(scoreA)) scoreA = -1;
    if (isNaN(scoreB)) scoreB = -1;
    let showTiebreak = false;

    // Define conditions for showing tiebreak input
    // Based on user request: "4G,6G,8Gの試合はそれぞれ4対5,6対7.8対9はタイブレークが発生"
    // Show tiebreak input when scores indicate a tiebreak was played (e.g., 4-5, 5-4, 6-7, 7-6, etc.)
  
    // 5game format
    if (format === '5game' && ((scoreA === 5 && scoreB === 4) || (scoreA === 4 && scoreB === 5))) {
      showTiebreak = true;
    }
  
    // BO3（2set/3set）形式でのタイブレーク表示条件を追加
    if (format.startsWith('6game') || format.startsWith('4game') || format.startsWith('8game')) {
      // セットスコア配列を取得
      const setScores = this.match.setScores || { A: [], B: [] };
      // 各セットを走査し、タイブレークが起きたセットがあるか判定する
      for (let i = 0; i < setScores.A.length; i++) {
        const sA = parseInt(setScores.A[i], 10);
        const sB = parseInt(setScores.B[i], 10);
        if (isNaN(sA) || isNaN(sB)) continue;

        if (format.startsWith('6game')) {
          if ((sA === 7 && sB === 6) || (sA === 6 && sB === 7)) {
            showTiebreak = true;
            break;
          }
        } else if (format.startsWith('4game')) {
          if ((sA === 5 && sB === 4) || (sA === 4 && sB === 5)) {
            showTiebreak = true;
            break;
          }
        }
      }
    }
  
    // 単セット形式のTB表示条件
    let shouldShowSingle = false;
    if (format === '6game1set') {
      shouldShowSingle = ( (scoreA === 7 && scoreB === 6) || (scoreA === 6 && scoreB === 7) );
    } else if (format === '4game1set') {
      shouldShowSingle = ( (scoreA === 5 && scoreB === 4) || (scoreA === 4 && scoreB === 5) );
    } else if (format === '8game1set') {
      shouldShowSingle = ( (scoreA === 9 && scoreB === 8) || (scoreA === 8 && scoreB === 9) );
    }
    if (shouldShowSingle) {
      showTiebreak = true;
    }
    // Add more conditions if other formats also have tiebreaks under specific scores

    if (showTiebreak) {
      // プレイヤーA側のみタイブレーク入力欄を表示し、B側は常に非表示にする（ユーザー要望）
      // per-set 表示制御に変更
      if(this.tiebreakWrappers){
        const setScores = this.match.setScores || { A: [], B: [] };
        this.tiebreakWrappers.forEach((wrapper,idx)=>{
          const sA=parseInt(setScores.A[idx],10);
          const sB=parseInt(setScores.B[idx],10);
          let show=false;
          if(format.startsWith('6game') && ((sA===7&&sB===6)||(sA===6&&sB===7))) show=true;
          if(format.startsWith('4game') && ((sA===5&&sB===4)||(sA===4&&sB===5))) show=true;
          wrapper.style.display= show? 'inline-block':'none';
          if(show){
            const stored=Array.isArray(this.match.tieBreakA)?this.match.tieBreakA[idx]:'';
            this.tiebreakInputs[idx].value = stored!=null?stored:'';
          }
        });
        // TB 行自体の表示
        this.tiebreakRow.style.display = 'flex';
      }
      this.tiebreakDivB.style.display = 'inline-block';
    } else {
      if(this.tiebreakWrappers){this.tiebreakWrappers.forEach(w=>w.style.display='none');}
      this.tiebreakRow.style.display = 'flex';
      // オプション: メインスコアがタイブレークの条件を満たさなくなった場合、タイブレークスコアをクリアすることも検討
      // if (this.match.tieBreakA !== null) {
      //   this.match.tieBreakA = null;
      //   this.updateMatchData({ tieBreakA: null });
      // }
      // if (this.match.tieBreakB !== null) {
      //   this.match.tieBreakB = null;
      //   this.updateMatchData({ tieBreakB: null });
      // }
    }
    */
    // 動的要素を更新するメソッド - スコア入力時に呼び出される
updateDynamicElements() {
  // スコアに基づいて動的に変更が必要な要素を更新
  this._checkAndToggleTiebreakUI();
  
  // 必要に応じて他の動的要素の更新処理を追加
}

updateScoreInputsInteractivity() {
  // スコア入力のインタラクティビティに関するロジックがあればここに追加
  // 古いタイブレーク入力欄のコードは削除済み
}

// 実終了時刻のUI反映
updateEndTimeDisplay() {
  try {
    const input = this.endTimeInput;
    if (!input) return;
    const ts = this.match && this.match.actualEndTime;
    if (!ts) { input.value = ''; return; }
    const d = new Date(ts);
    if (isNaN(d.getTime())) { input.value = ''; return; }
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    input.value = `${hh}:${mm}`;
  } catch {}
}

// 勝敗確定後に外部連携を行うためのタイマースケジューラ（簡易版）
_scheduleDecidedWebhook() {
  try {
    // 既にスケジュール済みなら何もしない
    if (this._decidedWebhookTimer) return;
    // 現状は安全のため何も送らない（将来ここで window.sendResultToLeague を呼ぶ）
    this._decidedWebhookTimer = null;
  } catch {}
}

// 履歴へ移動するダブルクリック用の追加リスナ（createCardElement 内で実装済みのため互換用に空）
addDoubleClickToHistoryListener() {
  // 互換目的のプレースホルダ
  return;
}

async updateMatchData(updatedData) {
  // ---- Synchronize scoreA/scoreB ↔ setScores before saving ----
  // Merge incoming changes first so we work with latest values
  this.match = { ...this.match, ...updatedData };

    const numSets = this._getNumberOfSets();

    // Keep setScores and score strings aligned for single-set formats (including 6game1set_ntb)
    if (numSets === 1) {
      const valA = (this.match.scoreA === '' || this.match.scoreA === undefined || this.match.scoreA === null) ? null : parseInt(this.match.scoreA, 10);
      const valB = (this.match.scoreB === '' || this.match.scoreB === undefined || this.match.scoreB === null) ? null : parseInt(this.match.scoreB, 10);
      this.match.setScores = { A: [valA], B: [valB] };
      this.match.scoreA = (valA === null || isNaN(valA)) ? '' : String(valA);
      this.match.scoreB = (valB === null || isNaN(valB)) ? '' : String(valB);
    } else {
      // For multi-set: if setScores changed, recalculate total wins -> scoreA/scoreB
      if (updatedData.setScores) {
        this.calculateTotalScore();
      }
    }

    // ---- Persist to DB ----
    if (window.db && typeof window.db.updateMatch === 'function') {
      try {
        await window.db.updateMatch({ id: this.match.id, ...this.match });
      } catch (error) {
        console.error('Failed to update match in DB:', error);
      }
    } else {
      console.warn('db.updateMatch function not found, skipping DB update');
    }

    // ---- UI refresh ----
    this.updateWinStatus();
    this.updateEndTimeDisplay();
    this.updateScoreInputsInteractivity();
    // Avoid heavy UI freezes; call checkLeagueWinCondition manually when needed
  
    this.match = { ...this.match, ...updatedData };
    if (window.db && typeof window.db.updateMatch === 'function') {
      try {
        await window.db.updateMatch({ id: this.match.id, ...this.match });
      } catch (error) {
        console.error('Failed to update match in DB:', error);
      }
    } else {
      console.warn('db.updateMatch function not found, skipping DB update');
    }
    this.updateWinStatus();
    this.updateEndTimeDisplay();
    this.updateScoreInputsInteractivity();
    // Commented out to prevent UI freeze - checkLeagueWinCondition will be called manually when needed
    // this.checkLeagueWinCondition(); // スコアや試合形式変更後に勝敗条件を再チェック
}

updateWinStatus() {
  console.log('[MATCH_CARD] updateWinStatus called, winner:', this.match.winner);
  
  // セレクタを修正して、データ属性で正確に要素を取得
  const winADiv = this.element.querySelector('.win-label[data-player="A"]');
  const winBDiv = this.element.querySelector('.win-label[data-player="B"]');
  
  if (!winADiv || !winBDiv) {
    console.error('[MATCH_CARD] Win elements not found');
    return;
  }

  // プレイヤーAのWin状態を設定
  if (this.match.winner === 'A') {
    winADiv.textContent = '✔'; // チェックマークに変更
    winADiv.style.color = 'red';
    winADiv.style.fontWeight = 'bold';
    winADiv.classList.remove('win-button');
    winADiv.classList.add('win-check');
  } else {
    winADiv.textContent = '●'; // 小さい黒丸に変更
    winADiv.style.color = '';
    winADiv.style.fontWeight = '';
    winADiv.classList.add('win-button');
    winADiv.classList.remove('win-check');
  }
  
  // プレイヤーBのWin状態を設定
  if (this.match.winner === 'B') {
    winBDiv.textContent = '✔'; // チェックマークに変更
    winBDiv.style.color = 'red';
    winBDiv.style.fontWeight = 'bold';
    winBDiv.classList.remove('win-button');
    winBDiv.classList.add('win-check');
  } else {
    winBDiv.textContent = '●'; // 小さい黒丸に変更
    winBDiv.style.color = '';
    winBDiv.style.fontWeight = '';
    winBDiv.classList.add('win-button');
    winBDiv.classList.remove('win-check');
  }
  
  // --- winner timestamp capture ---
  try {
    let needSave = false;
    // 勝者が確定し actualEndTime が未設定の場合は現在時刻を保存
    if (this.match.winner && !this.match.actualEndTime) {
      const ts = new Date().toISOString();
      this.match.actualEndTime = ts;
      // 後方互換フィールド (旧コード用)
      this.match.completedAt = ts;
      needSave = true;
    }
    // NOTE(DoNotAutoArchive):
    // ここで status='Completed' にすると、アプリ再起動時にボードから消えて履歴へ
    // 自動移動してしまう（ユーザーがまだ手動で移動させていないのに）。
    // 旧挙動：勝者✔を付けてもカードはボードに残り、ダブルクリック or ドラッグで
    // 履歴へ送る。よってステータスは変更しない。
    // （ユーザーが明示的に移動したときのみ Completed へ変わる。）

    if (needSave && window.db && typeof window.db.updateMatch === 'function') {
      window.db.updateMatch({
        id: this.match.id,
        winner: this.match.winner,
        scoreA: this.match.scoreA,
        scoreB: this.match.scoreB,
        status: this.match.status, // 現状維持（自動で Completed にしない）
        actualEndTime: this.match.actualEndTime,
        completedAt: this.match.completedAt,
      })
        .then(() => {
          console.log('[MATCH_CARD] winner timestamp set', this.match.actualEndTime, 'id=', this.match.id);
          // UI にも反映
          if (typeof this.updateEndTimeDisplay === 'function') {
            this.updateEndTimeDisplay();
          }
        })
        .catch(err => console.error('Failed to update match in DB:', err));
    }
  } catch (e) {
    console.error('Error while capturing winner timestamp:', e);
  }

  console.log('[MATCH_CARD] Win status updated: A=', winADiv.textContent, 'B=', winBDiv.textContent);
}

// 勝者表示の条件をシンプル化（手動選択のみ）
shouldShowWin(player) {
  return this.match.winner === player;
}

async checkLeagueWinCondition() {
    // 4G1set NoTB (タイブレークなし) の勝者判定
    if (this.match.gameFormat === '4game1set_ntb') {
      const scoreAEntered = this.match.scoreA !== null && this.match.scoreA !== undefined && this.match.scoreA !== '';
      const scoreBEntered = this.match.scoreB !== null && this.match.scoreB !== undefined && this.match.scoreB !== '';
      let newWinner = null;
      let newStatus = this.match.status;
      if (scoreAEntered && scoreBEntered) {
        const scoreA = parseInt(this.match.scoreA, 10);
        const scoreB = parseInt(this.match.scoreB, 10);
        if ((scoreA === 4 || scoreB === 4) && Math.abs(scoreA - scoreB) >= 1 && scoreA <= 4 && scoreB <= 4) {
          newWinner = scoreA > scoreB ? 'A' : 'B';
          newStatus = 'Win';
        }
      }
      // 変更があればDB・UI更新
      if (this.match.winner !== newWinner || this.match.status !== newStatus) {
        const updatePayload = { winner: newWinner, status: newStatus };
        if (newWinner && !this.match.actualEndTime) {
          updatePayload.actualEndTime = new Date().toISOString();
        } else if (!newWinner) {
          updatePayload.actualEndTime = null;
        }
        this.updateMatchData(updatePayload);
        this.updateWinStatus();
        this.updateEndTimeDisplay();
      }
      return; // NoTB 判定後は終了
    }

    // 6G1set NoTB (タイブレークなし) の勝者判定
    if (this.match.gameFormat === '6game1set_ntb') {
      const scoreAEntered = this.match.scoreA !== null && this.match.scoreA !== undefined && this.match.scoreA !== '';
      const scoreBEntered = this.match.scoreB !== null && this.match.scoreB !== undefined && this.match.scoreB !== '';
      let newWinner = null;
      let newStatus = this.match.status;
      if (scoreAEntered && scoreBEntered) {
        const scoreA = parseInt(this.match.scoreA, 10);
        const scoreB = parseInt(this.match.scoreB, 10);
        if ((scoreA === 6 || scoreB === 6) && Math.abs(scoreA - scoreB) >= 1 && scoreA <= 6 && scoreB <= 6) {
          newWinner = scoreA > scoreB ? 'A' : 'B';
          newStatus = 'Win';
        }
      }
      // 変更があればDB・UI更新
      if (this.match.winner !== newWinner || this.match.status !== newStatus) {
        const updatePayload = { winner: newWinner, status: newStatus };
        if (newWinner && !this.match.actualEndTime) {
          updatePayload.actualEndTime = new Date().toISOString();
        } else if (!newWinner) {
          updatePayload.actualEndTime = null;
        }
        this.updateMatchData(updatePayload);
        this.updateWinStatus();
        this.updateEndTimeDisplay();
      }
      return; // NoTB 判定後は終了
    }

    // --- 以下既存処理 ---
    // デバッグ情報を画面上に表示する関数（本番環境では表示しない）
    function showDebug(msg) {
      // デバッグモードがオフの場合は何もしない
      const debugMode = false; // デバッグモードをオフに設定
      if (!debugMode) return;
      
      let dbg = document.getElementById('cascade-debug');
      if (!dbg) {
        dbg = document.createElement('div');
        dbg.id = 'cascade-debug';
        dbg.style.position = 'fixed';
        dbg.style.top = '10px';
        dbg.style.right = '10px';
        dbg.style.background = 'yellow';
        dbg.style.zIndex = 9999;
        dbg.style.fontSize = '16px';
        dbg.style.padding = '8px';
        document.body.appendChild(dbg);
      }
      dbg.innerHTML += msg + '<br>';
    }
    
    // 試合形式を小文字に統一
    const format = (this.match.gameFormat || '').toLowerCase();
    
    // 両方のスコアが入力されているか確認
    const scoreAEntered = this.match.scoreA !== null && this.match.scoreA !== undefined && this.match.scoreA !== '';
    const scoreBEntered = this.match.scoreB !== null && this.match.scoreB !== undefined && this.match.scoreB !== '';
    
    // スコアを数値化
    let scoreA = scoreAEntered ? parseInt(this.match.scoreA, 10) : null;
    let scoreB = scoreBEntered ? parseInt(this.match.scoreB, 10) : null;
    let newWinner = null;
    let newStatus = this.match.status;
    
    showDebug('[DEBUG] checkLeagueWinCondition called');
    showDebug('[DEBUG] format: ' + format);
    showDebug('[DEBUG] scoreA: ' + scoreA + ', scoreB: ' + scoreB);
    
    // BO3形式（4G/6G 2set・3set 等）のみ判定
    const bo3Formats = ['4game3set', '6game3set', '4game2set', '6game2set'];
    if (bo3Formats.includes(this.match.gameFormat)) {
      // まずcalculateTotalScoreを呼び出してセットスコアから合計スコアを計算
      this.calculateTotalScore();
      
      const setA = (this.match.setScores && Array.isArray(this.match.setScores.A)) ? this.match.setScores.A : [];
      const setB = (this.match.setScores && Array.isArray(this.match.setScores.B)) ? this.match.setScores.B : [];
      let winsA = 0;
      let winsB = 0;
      for (let i = 0; i < Math.max(setA.length, setB.length); i++) {
        const sA = parseInt(setA[i], 10);
        const sB = parseInt(setB[i], 10);
        if (isNaN(sA) || isNaN(sB)) continue; // スコア未入力のセットは無視

        // 2set+10MTB 形式のファイナルセット（マッチタイブレーク）は 10ポイント先取かつ2ポイント差が必要
        const isMatchTiebreak = (this.match.gameFormat === '4game2set' || this.match.gameFormat === '6game2set') && i === 2;
        if (isMatchTiebreak) {
          // 勝者判定条件: 10ポイント以上 & 2ポイント差
          if ((sA >= 10 || sB >= 10) && Math.abs(sA - sB) >= 2) {
            if (sA > sB) winsA++;
            else if (sB > sA) winsB++;
          }
        } else {
          // 通常セットの勝者判定 - 6G3setの場合は6ゲーム以上で2ゲーム差、または7-6の場合
          if (this.match.gameFormat === '6game3set') {
            // 6ゲーム先取、2ゲーム差必要、ただし7-6は勝利
            if ((sA >= 6 && sA - sB >= 2) || (sA === 7 && sB === 6)) {
              winsA++;
            } else if ((sB >= 6 && sB - sA >= 2) || (sB === 7 && sA === 6)) {
              winsB++;
            }
          } else if (this.match.gameFormat === '4game3set') {
            // 4ゲーム先取、2ゲーム差必要、ただし5-4は勝利
            if ((sA >= 4 && sA - sB >= 2) || (sA === 5 && sB === 4)) {
              winsA++;
            } else if ((sB >= 4 && sB - sA >= 2) || (sB === 5 && sA === 4)) {
              winsB++;
            }
          } else {
            // その他の形式は単純比較
            if (sA > sB) winsA++;
            else if (sB > sA) winsB++;
          }
        }
      }
      
      let newWinner = null;
      let newStatus = this.match.status;
      
      // 3セット制の場合は2セット先取で勝利
      if (this.match.gameFormat === '6game3set' || this.match.gameFormat === '4game3set') {
        if (winsA >= 2) {
          newWinner = 'A';
          newStatus = 'Win';
        } else if (winsB >= 2) {
          newWinner = 'B';
          newStatus = 'Win';
        }
      } else if (this.match.gameFormat === '6game2set' || this.match.gameFormat === '4game2set') {
        // 2セット制の場合も2セット先取で勝利（3セット目はマッチタイブレーク）
        if (winsA >= 2) {
          newWinner = 'A';
          newStatus = 'Win';
        } else if (winsB >= 2) {
          newWinner = 'B';
          newStatus = 'Win';
        }
      }
      
      showDebug('[DEBUG] BO3 - winsA: ' + winsA + ', winsB: ' + winsB + ', newWinner: ' + newWinner);
      
      // winner / status 更新判定
      if (this.match.winner !== newWinner || this.match.status !== newStatus) {
        const updatePayload = { winner: newWinner, status: newStatus };
        if (newWinner && !this.match.actualEndTime) {
          updatePayload.actualEndTime = new Date().toISOString();
        } else if (!newWinner) {
          updatePayload.actualEndTime = null; // 勝者取り消し時刻クリア
        }
        this.updateMatchData(updatePayload);
        this.updateWinStatus();
        this.updateEndTimeDisplay();
      }
      // BO3判定後は処理終了
      return;
    }

    // 5G形式の勝者判定（合計5ゲーム到達で多い方が勝ち）
    if (format.includes('5g') || this.match.gameFormat === '5game') {
      if (scoreAEntered && scoreBEntered) {
        const total = scoreA + scoreB;
        let newWinner = null;
        let newStatus = this.match.status;
        if (total >= 5) {
          if (scoreA > scoreB) newWinner = 'A';
          else if (scoreB > scoreA) newWinner = 'B';
          if (newWinner) newStatus = 'Win';
        } else {
          newWinner = null;
          newStatus = 'Pending';
        }
        if (this.match.winner !== newWinner || this.match.status !== newStatus) {
          const updatePayload = { winner: newWinner, status: newStatus };
          if (newWinner && !this.match.actualEndTime) {
            updatePayload.actualEndTime = new Date().toISOString();
          } else if (!newWinner) {
            updatePayload.actualEndTime = null;
          }
          this.updateMatchData(updatePayload);
          this.updateWinStatus();
          this.updateEndTimeDisplay();
        }
      }
      // 5G判定後は続行せずに下の6G判定に落ちることなく終了
      return;
    }

    // 8G1set形式の勝者判定
    if (format.includes('8g') || format.includes('8game')) {
      if (scoreAEntered && scoreBEntered) {
        let newWinner = null;
        let newStatus = this.match.status;
        // 8ゲームかつ2ゲーム差
        if ((scoreA >= 8 || scoreB >= 8) && Math.abs(scoreA - scoreB) >= 2) {
          if (scoreA > scoreB) newWinner = 'A';
          else if (scoreB > scoreA) newWinner = 'B';
          if (newWinner) newStatus = 'Win';
        }
        // 9ゲーム到達で即勝利
        else if (scoreA >= 9 || scoreB >= 9) {
          if (scoreA > scoreB) newWinner = 'A';
          else if (scoreB > scoreA) newWinner = 'B';
          if (newWinner) newStatus = 'Win';
        }
        if (this.match.winner !== newWinner || this.match.status !== newStatus) {
          const updatePayload = { winner: newWinner, status: newStatus };
          if (newWinner && !this.match.actualEndTime) {
            updatePayload.actualEndTime = new Date().toISOString();
          } else if (!newWinner) {
            updatePayload.actualEndTime = null;
          }
          this.updateMatchData(updatePayload);
          this.updateWinStatus();
          this.updateEndTimeDisplay();
        }
      }
      // 8G判定後は処理終了
      return;
    }

    // 4G1set形式の勝者判定
    if (format.includes('4g') || format.includes('4game')) {
      if (scoreAEntered && scoreBEntered) {
        let newWinner = null;
        let newStatus = this.match.status;
        // 4ゲームかつ2ゲーム差
        if ((scoreA >= 4 || scoreB >= 4) && Math.abs(scoreA - scoreB) >= 2) {
          if (scoreA > scoreB) newWinner = 'A';
          else if (scoreB > scoreA) newWinner = 'B';
          if (newWinner) newStatus = 'Win';
        }
        // 5ゲーム到達で即勝利
        else if (scoreA >= 5 || scoreB >= 5) {
          if (scoreA > scoreB) newWinner = 'A';
          else if (scoreB > scoreA) newWinner = 'B';
          if (newWinner) newStatus = 'Win';
        }
        if (this.match.winner !== newWinner || this.match.status !== newStatus) {
          const updatePayload = { winner: newWinner, status: newStatus };
          if (newWinner && !this.match.actualEndTime) {
            updatePayload.actualEndTime = new Date().toISOString();
          } else if (!newWinner) {
            updatePayload.actualEndTime = null;
          }
          this.updateMatchData(updatePayload);
          this.updateWinStatus();
          this.updateEndTimeDisplay();
        }
      }
      // 4G判定後は処理終了
      return;
    }

    // 6G1set形式の勝者判定
    if (format.includes('6g') || format.includes('6game')) {
      showDebug('[DEBUG] 6G1set判定: scoreA=' + scoreA + ' scoreB=' + scoreB);
      
      if (scoreAEntered && scoreBEntered) {
        showDebug('[DEBUG] 両方のスコアが入力済み');
        
        // 6ゲーム到達かつ2ゲーム差
        if ((scoreA >= 6 || scoreB >= 6) && Math.abs(scoreA - scoreB) >= 2) {
          showDebug('[DEBUG] 6到達＆2差クリア');
          if (scoreA > scoreB) {
            newWinner = 'A';
            newStatus = 'Win';
          } else if (scoreB > scoreA) {
            newWinner = 'B';
            newStatus = 'Win';
          }
        }
        // 7ゲーム到達で即勝利
        else if (scoreA >= 7 || scoreB >= 7) {
          showDebug('[DEBUG] 7到達で即勝利');
          if (scoreA > scoreB) {
            newWinner = 'A';
            newStatus = 'Win';
          } else if (scoreB > scoreA) {
            newWinner = 'B';
            newStatus = 'Win';
          }
        }
      } else {
        showDebug('[DEBUG] 両方のスコアが入力されていません');
        // 片方のスコアしか入力されていない場合は勝者をクリア
        newWinner = null;
        newStatus = 'Pending';
      }
      
      // 勝者・ステータス変更があればDB経由で一括更新（終了時刻含む）
      if (this.match.winner !== newWinner || this.match.status !== newStatus) {
        showDebug('[DEBUG] 勝者変更: ' + this.match.winner + ' → ' + newWinner);

        const updatePayload = { winner: newWinner, status: newStatus };
        // 勝者確定時に終了時刻を自動設定 / 取り消し時はクリア
        if (newWinner && !this.match.actualEndTime) {
          updatePayload.actualEndTime = new Date().toISOString();
        } else if (!newWinner) {
          updatePayload.actualEndTime = null;
        }

        // updateMatchData は DB 更新・UI 更新を内包するユーティリティ
        this.updateMatchData(updatePayload);
      }
      
      return; // 6G1set判定後は処理終了
    }
    
    // その他の形式（元のコード）
    if (this.match.gameFormat === 'league') {
    const scoreA = parseInt(this.match.scoreA, 10) || 0;
    let scoreB = parseInt(this.match.scoreB, 10) || 0;
    showDebug('[DEBUG] scoreA: ' + scoreA + ', scoreB: ' + scoreB);
    let newWinner = null;
    let newStatus = this.match.status;

    if ((scoreA + scoreB) >= 5) {
      if (scoreA > scoreB) newWinner = this.match.playerA;
      else if (scoreB > scoreA) newWinner = this.match.playerB;
      if (newWinner) newStatus = 'Win';
    } else {
      newWinner = null; // Reset winner if score drops below threshold
      newStatus = 'Pending'; // Reset status
    }
    if (this.match.winner !== newWinner || this.match.status !== newStatus) {
       const updatePayload = { winner: newWinner, status: newStatus };
       if (newWinner && !this.match.actualEndTime) { // 勝者が決まり、かつ終了時刻がまだ設定されていない場合
         updatePayload.actualEndTime = new Date().toISOString();
       }
       this.updateMatchData(updatePayload); // updateMatchData内でactualEndTimeが設定される
    }
  } else if (this.match.gameFormat === 'playoff') {
      let newWinner = null;
      let newStatus = 'Pending'; // Default to pending

      if (this.shouldShowWin('A')) {
        newWinner = this.match.playerA;
        newStatus = 'Win';
      } else if (this.shouldShowWin('B')) {
        newWinner = this.match.playerB;
        newStatus = 'Win';
      }
      // If neither player is shown as a winner, but scores might imply a completed game without a clear win (e.g. scores reset)
      // we might need additional logic here if status should change from 'Win' back to 'Pending'
      // For now, if no one is winning, winner remains as is or null, status might go to Pending if not already Win.
      if (newWinner === null && this.match.status === 'Win') {
        // If previously was 'Win' but now no one is winning according to shouldShowWin
        // (e.g. score was changed making it no longer a win), reset status.
        // Keep actualEndTime as it was, user can manually clear it if needed.
        newStatus = 'Pending'; 
      }

      if (this.match.winner !== newWinner || this.match.status !== newStatus) {
        const updatePayload = { winner: newWinner, status: newStatus };
        if (newWinner && !this.match.actualEndTime) { // If a new winner is determined and no end time is set
          updatePayload.actualEndTime = new Date().toISOString();
        } else if (newWinner === null && this.match.status === 'Win' && newStatus === 'Pending') {
          // If winner is removed (e.g. score changed), we don't automatically clear actualEndTime here.
          // User might want to keep it or clear it manually.
        }
        // Only call updateMatchData if there's a change in winner or status
        // updateMatchData will then call checkLeagueWinCondition again, ensure no infinite loop
        if (this.match.winner !== updatePayload.winner || this.match.status !== updatePayload.status || (updatePayload.actualEndTime && this.match.actualEndTime !== updatePayload.actualEndTime)) {
             this.updateMatchData(updatePayload); // Pass the payload to updateMatchData
        }
      }
  }
  // this.updateWinStatus(); // Called from updateMatchData
} // End of checkLeagueWinCondition

setupDragAndDrop() {
    this.element.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', this.match.id);
      e.dataTransfer.effectAllowed = 'move';
      this.element.classList.add('dragging');
    });
    this.element.addEventListener('dragend', () => {
      this.element.classList.remove('dragging');
      // After drop, recalc checkbox visibility based on new parent container
      try { this.updateBulkSelectVisibility(); } catch {}
    });
  }

async moveToHistory() {
    // Placeholder for actual implementation
}

async handleDeleteMatch() {
  try {
    // window.electronAPIが存在する場合はそれを使用、存在しない場合はwindow.confirmを使用
    let confirmed;
    if (window.electronAPI && typeof window.electronAPI.showConfirmDialog === 'function') {
      confirmed = await window.electronAPI.showConfirmDialog('この対戦カードを本当に削除してもよろしいですか？');
    } else {
      confirmed = window.confirm('この対戦カードを本当に削除してもよろしいですか？');
    }
    
    if (confirmed) {
      try {
        console.log(`Deleting match ID: ${this.match.id}`);
        // DBからの削除処理を実行
        if (window.db && typeof window.db.deleteMatch === 'function') {
          await window.db.deleteMatch(this.match.id);
          console.log(`Match ${this.match.id} deleted from DB successfully`);
        } else {
          console.warn('window.db or deleteMatch function not available, skipping DB deletion');
        }
        
        // UIから要素を削除
        if (this.element) {
          this.element.remove();
        }
        
        // イベントを発行
        const event = new CustomEvent('match-deleted', { detail: { matchId: this.match.id } });
        document.dispatchEvent(event);
        console.log(`Match ${this.match.id} visual element removed and event dispatched.`);
      } catch (error) {
        console.error('Error during match deletion process:', error);
        alert('試合の削除中にエラーが発生しました。');
      }
    }
  } catch (error) {
    console.error('Error showing confirmation dialog:', error);
    alert('確認ダイアログの表示中にエラーが発生しました。');
  }
}

update(newMatchData) {
  this.match = { ...this.match, ...newMatchData };

  const playerAInput = this.element.querySelector('.player-name-input[data-player="A"]');
  if (playerAInput && playerAInput.value !== this.match.playerA) {
    playerAInput.value = this.match.playerA;
  }
  const playerBInput = this.element.querySelector('.player-name-input[data-player="B"]');
  if (playerBInput && playerBInput.value !== this.match.playerB) {
    playerBInput.value = this.match.playerB;
  }
  const scoreAInput = this.element.querySelector('.score-input[data-player="A"]');
  if (scoreAInput && parseInt(scoreAInput.value) !== this.match.scoreA) {
    scoreAInput.value = this.match.scoreA;
  }
  const scoreBInput = this.element.querySelector('.score-input[data-player="B"]');
  if (scoreBInput && parseInt(scoreBInput.value) !== this.match.scoreB) {
    scoreBInput.value = this.match.scoreB;
  }
  const memoInput = this.element.querySelector('.match-card-memo');
  if (memoInput && memoInput.value !== this.match.memo) {
    memoInput.value = this.match.memo;
  }

  // Update court and category meta
  try {
    const courtSpan = this.element.querySelector('.match-card-court');
    if (courtSpan) {
      const cn = this.match.courtNumber != null ? parseInt(this.match.courtNumber, 10) : null;
      courtSpan.textContent = cn ? `コート${cn}` : '';
    }
    const catSpan = this.element.querySelector('.match-card-category');
    if (catSpan) {
      catSpan.textContent = this.match.category || '';
    }
  } catch (_) {}

  // ---- Update game format display (so bulk apply reflects immediately) ----
  try {
    const fmtDisp = this.element.querySelector('.match-card-game-format-display');
    if (fmtDisp) {
      const key = (this.match.gameFormat || '6game1set_ntb').toLowerCase();
      const label = (this.gameFormatOptions && this.gameFormatOptions[key]) ? this.gameFormatOptions[key] : key;
      fmtDisp.textContent = label;
    }
  } catch (_) {}

  // スコア文字列 → セットスコア配列を同期（読み込み時のスコア消失防止）
  const numSetsUpdate = this._getNumberOfSets();
  this.match.setScores = {
    A: this._parseScores(this.match.scoreA, numSetsUpdate),
    B: this._parseScores(this.match.scoreB, numSetsUpdate)
  };

  this.updateScoreInputsInteractivity();
  this.updateWinStatus();
  this.updateEndTimeDisplay();
  // checkLeagueWinCondition is called from updateMatchData if scores change, 
  // or directly if gameFormat changes. If only names/memo change, it's not strictly needed here
  // but calling it ensures consistency if other logic depends on it.
  this.checkLeagueWinCondition(); 
}

// Toggle visibility of bulk-select checkbox based on location/status
updateBulkSelectVisibility() {
  try {
    const cb = this.element ? this.element.querySelector('input.bulk-select') : null;
    if (!cb) return;
    const parent = this.element.parentElement;
    const inUnassigned = parent && parent.id === 'unassigned-cards';
    // In unassigned list -> always show. Otherwise hide.
    const eligible = !!inUnassigned;
    cb.style.display = eligible ? '' : 'none';
  } catch (_) {}
}

  // セットスコアから合計スコアを計算するメソッド
  calculateTotalScore() {
    if (!this.match.setScores) return;
    
    console.log('[MATCH_CARD] calculateTotalScore - gameFormat:', this.match.gameFormat);
    console.log('[MATCH_CARD] calculateTotalScore - setScores:', this.match.setScores);
    
    // 各セットで勝った回数をカウント
    let winsA = 0;
    let winsB = 0;
    
    // 試合形式に応じた勝利条件を適用
    const gameFormat = this.match.gameFormat || '5game';
    
    // 各セットの勝者を判定
    for (let i = 0; i < 3; i++) {
      const scoreA = this.match.setScores.A[i] || 0;
      const scoreB = this.match.setScores.B[i] || 0;
      
      // セットが空の場合はスキップ
      if (scoreA === 0 && scoreB === 0) continue;
      
      // 試合形式に応じた勝利条件を適用
      switch (gameFormat) {
        case '5game': // 5G→スコアの合計が5になり、かつ大きい数字の方にカウントする
          if ((scoreA + scoreB) >= 5 && scoreA > scoreB) {
            winsA++;
          } else if ((scoreA + scoreB) >= 5 && scoreB > scoreA) {
            winsB++;
          }
          break;
          
        case '4game1set': // 4G1set→どちらかのスコアが4or5になり、かつ相手より大きい数字の方にカウントする
          if ((scoreA >= 4 && scoreA > scoreB) || (scoreA === 5 && scoreA > scoreB)) {
            winsA++;
          } else if ((scoreB >= 4 && scoreB > scoreA) || (scoreB === 5 && scoreB > scoreA)) {
            winsB++;
          }
          break;
          
        case '6game1set': // 6G1set→どちらかのスコアが6or7になり、かつ相手より大きい数字の方にカウントする
          if ((scoreA >= 6 && scoreA > scoreB) || (scoreA === 7 && scoreA > scoreB)) {
            winsA++;
          } else if ((scoreB >= 6 && scoreB > scoreA) || (scoreB === 7 && scoreB > scoreA)) {
            winsB++;
          }
          break;
          
        case '8game-pro': // 8G-Pro→どちらかのスコアが8or9になり、かつ相手より大きい数字の方にカウントする
          if ((scoreA >= 8 && scoreA > scoreB) || (scoreA === 9 && scoreA > scoreB)) {
            winsA++;
          } else if ((scoreB >= 8 && scoreB > scoreA) || (scoreB === 9 && scoreB > scoreA)) {
            winsB++;
          }
          break;
          
        case '4game2set': // 4G2set+10TB
        case '4game3set': // 4G3set
          // セット毎に異なる勝利条件を適用
          if (i === 2 && gameFormat === '4game2set') {
            // 3セット目はどちらかのスコアが10以上で相手より大きい数字の方にカウントする
            if (scoreA >= 10 && scoreA > scoreB) {
              winsA++;
            } else if (scoreB >= 10 && scoreB > scoreA) {
              winsB++;
            }
          } else {
            // 1,2セット目はどちらかのスコアが4or5になり、かつ相手より大きい数字の方にカウントする
            if ((scoreA >= 4 && scoreA > scoreB) || (scoreA === 5 && scoreA > scoreB)) {
              winsA++;
            } else if ((scoreB >= 4 && scoreB > scoreA) || (scoreB === 5 && scoreB > scoreA)) {
              winsB++;
            }
          }
          break;
          
        case '6game2set': // 6G2set+10TB
        case '6game3set': // 6G3set
          // セット毎に異なる勝利条件を適用
          if (i === 2 && gameFormat === '6game2set') {
            // 3セット目はどちらかのスコアが10以上で相手より大きい数字の方にカウントする
            if (scoreA >= 10 && scoreA > scoreB) {
              winsA++;
            } else if (scoreB >= 10 && scoreB > scoreA) {
              winsB++;
            }
          } else {
            // 1,2セット目はどちらかのスコアが6or7になり、かつ相手より大きい数字の方にカウントする
            if ((scoreA >= 6 && scoreA > scoreB) || (scoreA === 7 && scoreA > scoreB)) {
              winsA++;
            } else if ((scoreB >= 6 && scoreB > scoreA) || (scoreB === 7 && scoreB > scoreA)) {
              winsB++;
            }
          }
          break;
          
        default: // デフォルトの場合は単純にスコアの大小で判定
          if (scoreA > scoreB) {
            winsA++;
          } else if (scoreB > scoreA) {
            winsB++;
          }
          break;
      }
    }
    
    console.log('[MATCH_CARD] calculateTotalScore - winsA:', winsA, 'winsB:', winsB);
    
    // 合計スコアを更新
    this.match.scoreA = winsA;
    this.match.scoreB = winsB;
    
    // UIを更新
    if (this.element) {
      const totalScoreA = this.element.querySelector('.total-score[data-player="A"]');
      const totalScoreB = this.element.querySelector('.total-score[data-player="B"]');
      
      if (totalScoreA) totalScoreA.textContent = winsA;
      if (totalScoreB) totalScoreB.textContent = winsB;
    }
  }
  
  // ダブルクリックで履歴へ移動する機能は無効化
  addDoubleClickToHistoryListener() {
    // 機能を無効化したので何もしない
    return;
  } // addDoubleClickToHistoryListener method

  // スコア取得メソッド - コート数変更時の状態保持用
  getScoreA() {
    if (this.element) {
      // スコア入力欄を特定（プレイヤー名入力欄を除外）
      const scoreInput = this.element.querySelector('input.score-input[data-player="A"], input.set-score-input[data-player="A"]');
      if (scoreInput) {
        // セットスコア形式の場合は合計スコアを取得
        if (scoreInput.classList.contains('set-score-input')) {
          const totalScoreElement = this.element.querySelector('.total-score[data-player="A"]');
          const val = totalScoreElement ? totalScoreElement.textContent : '';
          if (val !== '' && val != null) return val;
        } else {
          if (scoreInput.value !== '' && scoreInput.value != null) return scoreInput.value;
        }
      }
    }
    const scoreFallbackA = this.match.scoreA;
    return (scoreFallbackA === undefined || scoreFallbackA === null) ? '' : String(scoreFallbackA);
  }

  getScoreB() {
    if (this.element) {
      // スコア入力欄を特定（プレイヤー名入力欄を除外）
      const scoreInput = this.element.querySelector('input.score-input[data-player="B"], input.set-score-input[data-player="B"]');
      if (scoreInput) {
        // セットスコア形式の場合は合計スコアを取得
        if (scoreInput.classList.contains('set-score-input')) {
          const totalScoreElement = this.element.querySelector('.total-score[data-player="B"]');
          const val = totalScoreElement ? totalScoreElement.textContent : '';
          if (val !== '' && val != null) return val;
        } else {
          if (scoreInput.value !== '' && scoreInput.value != null) return scoreInput.value;
        }
      }
    }
    const scoreFallbackB = this.match.scoreB;
    return (scoreFallbackB === undefined || scoreFallbackB === null) ? '' : String(scoreFallbackB);
  }

  getTiebreakScore() {
    if (this.element) {
      const tiebreakInputA = this.element.querySelector('input[data-tiebreak="A"]');
      const tiebreakInputB = this.element.querySelector('input[data-tiebreak="B"]');
      return {
        A: tiebreakInputA ? tiebreakInputA.value : (this.match.tieBreakA || ''),
        B: tiebreakInputB ? tiebreakInputB.value : (this.match.tieBreakB || '')
      };
    }
    return {
      A: this.match.tieBreakA || '',
      B: this.match.tieBreakB || ''
    };
  }

  // セットスコアを取得
  getSetScores() {
    const setScores = { A: [], B: [] };
    const numSetsExpected = this._getNumberOfSets();
    if (this.element) {
      const setInputsA = this.element.querySelectorAll('input[data-set-player="A"]');
      const setInputsB = this.element.querySelectorAll('input[data-set-player="B"]');
      
      setInputsA.forEach((input, index) => {
        if (index < numSetsExpected) {
          setScores.A[index] = input.value || null;
        }
      });
      
      setInputsB.forEach((input, index) => {
        if (index < numSetsExpected) {
          setScores.B[index] = input.value || null;
        }
      });
      // 期待される数に合わせてトリム / パディング
      setScores.A = setScores.A.slice(0, numSetsExpected);
      setScores.B = setScores.B.slice(0, numSetsExpected);
      while (setScores.A.length < numSetsExpected) setScores.A.push(null);
      while (setScores.B.length < numSetsExpected) setScores.B.push(null);
    } else {
      // フォールバック: match.setScoresから取得
      setScores.A = this.match.setScores?.A || [];
      setScores.B = this.match.setScores?.B || [];
    }
    return setScores;
  }
} // MatchCard CLASS END
