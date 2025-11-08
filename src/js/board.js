// Board Component for managing the court grid
class Board {
  constructor(numberOfCourts = 12, slotsPerCourt = 6) {
    console.log('[BOARD] Constructor called');
    this.numberOfCourts = numberOfCourts;
    this.slotsPerCourt = slotsPerCourt; // 1コートあたりの枠数（第1〜第N試合）
    this.courtGrid = document.getElementById('court-grid');
    this.matchCards = new Map(); // Map to store match card instances by ID
    this.courtNames = {}; // Map to store custom court names
    
    // コート設定の要素を取得
    this.courtCountDisplay = document.getElementById('court-count-display');
    this.decreaseCourtsBtn = document.getElementById('decrease-courts-btn');
    this.increaseCourtsBtn = document.getElementById('increase-courts-btn');
    this.deleteAllMatchesBtn = document.getElementById('delete-all-matches-btn');
    
    // ローカルストレージからコート名を読み込む
    this.loadCourtNames();
    
    // グローバルスコープに自身を設定
    window.boardInstance = this;
    
    this.init();
  }

  // Initialize the board
  async init() {
    this.createCourtGrid();
    await this.loadMatches();
    this.setupEventListeners();
    // this.loadGameFormat() は定義されていないため削除
    this.setupCourtSettings(); // This will also set up game format control
    this.updateCourtSelectOptions(); // Populate court select options on init
    this.setupUnassignedArea(); // 未割当エリアのドラッグ＆��ロップ機能を設定
    this.setupExportFunctions(); // エクスポート機能のセットアップ
  }

  // Create the court grid with the specified number of courts
  createCourtGrid() {
    this.courtGrid.innerHTML = '';
    
    for (let i = 1; i <= this.numberOfCourts; i++) {
      const courtSlot = document.createElement('div');
      courtSlot.className = 'court-slot';
      courtSlot.dataset.courtNumber = i;
      
      const courtHeader = document.createElement('div');
      courtHeader.className = 'court-header';
      
      // コート名の編集機能を追加
      const courtNameSpan = document.createElement('span');
      courtNameSpan.className = 'court-name-edit';
      courtNameSpan.textContent = this.getCourtName(i);
      courtNameSpan.dataset.courtNumber = i;
      courtNameSpan.addEventListener('click', this.handleCourtNameClick.bind(this));
      
      courtHeader.appendChild(courtNameSpan);
      
      const courtRows = document.createElement('div');
      courtRows.className = 'court-rows';
      
      // 枠数に応じて行を動的に生成（第1〜第N試合）
      const rowKeys = this.getRowKeys();
      rowKeys.forEach((key, idx) => {
        const label = `第${idx + 1}試合`;
        const row = this.createCourtRow(key, label);
        courtRows.appendChild(row);
      });
      
      courtSlot.appendChild(courtHeader);
      courtSlot.appendChild(courtRows);
      
      this.courtGrid.appendChild(courtSlot);
    }
    
    // コート数表示を更新
    if (this.courtCountDisplay) {
      this.courtCountDisplay.textContent = this.numberOfCourts;
    }
  }

  // Create a court row with the specified type and placeholder text
  createCourtRow(rowType, placeholderText) {
    const row = document.createElement('div');
    row.className = `court-row ${rowType}-row`;
    row.dataset.rowType = rowType;
    
    // Add placeholder text for empty rows
    const placeholder = document.createElement('div');
    placeholder.className = 'row-placeholder';
    placeholder.textContent = placeholderText;
    row.appendChild(placeholder);
    
    // カードコンテナを追加
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-container';
    row.appendChild(cardContainer);
    
    // Set up drop zone functionality
    // DragDropUtilsの機能を直接実装
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // Add highlight to the target row
      if (e.target.classList.contains('court-row')) {
        e.target.classList.add('row-highlight');
      } else if (e.target.closest('.court-row')) {
        e.target.closest('.court-row').classList.add('row-highlight');
      }
    });
    
    row.addEventListener('dragleave', (e) => {
      // Remove highlight from the row
      if (e.target.classList.contains('court-row')) {
        e.target.classList.remove('row-highlight');
      } else if (e.target.closest('.court-row')) {
        e.target.closest('.court-row').classList.remove('row-highlight');
      }
    });
    
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      
      // Remove highlight from all rows
      document.querySelectorAll('.row-highlight').forEach(row => {
        row.classList.remove('row-highlight');
      });
      
      // Get the match ID from the dragged card
      const matchIdRaw = e.dataTransfer.getData('text/plain');
      if (!matchIdRaw) return;
      const matchId = isNaN(Number(matchIdRaw)) ? String(matchIdRaw) : Number(matchIdRaw);
      
      // Get the target court row
      let targetRow = null;
      if (e.target.classList.contains('court-row')) {
        targetRow = e.target;
      } else if (e.target.closest('.court-row')) {
        targetRow = e.target.closest('.court-row');
      }
      
      if (!targetRow) return;
      
      // Get the court number and row type
      const courtSlot = targetRow.closest('.court-slot');
      const courtNumber = parseInt(courtSlot.dataset.courtNumber);
      const rowType = targetRow.dataset.rowType;
      
      // Get the source court and row
      const sourceCourtNumber = parseInt(e.dataTransfer.getData('source-court')) || null;
      const sourceRowType = e.dataTransfer.getData('source-row') || null;
      
      try {
        // Get the match from the database
        const matches = await db.getAllMatches();
        const match = matches.find(m => String(m.id) === String(matchId));
        
        if (!match) {
          console.error('Match not found:', matchId);
          return;
        }
        
        // Update match status based on the target row（動的対応）
        let newStatus = 'Unassigned';
        let actualStartTime = match.actualStartTime;
        let actualEndTime = match.actualEndTime;
        
        if (rowType === 'current') {
          newStatus = 'Current';
          if (match.status !== 'Current') {
            actualStartTime = new Date().toISOString();
          }
        } else if (rowType && rowType.startsWith('next')) {
          const suffix = (rowType === 'next') ? '' : rowType.replace('next', '');
          newStatus = 'Next' + suffix; // Next, Next2, ... Next19
        }
        
        // Check if moving to history (completed)
        if (rowType === 'history') {
          newStatus = 'Completed';
          // Preserve existing actualEndTime if it already exists, otherwise set it now
          if (!match.actualEndTime) {
            actualEndTime = new Date().toISOString();
          }
        }
        
        // Update the match in the database
        const updatedMatch = await db.updateMatch({
          id: matchId,
          courtNumber,
          rowPosition: rowType,
          status: newStatus,
          actualStartTime,
          actualEndTime
        });
        
        // Dispatch an event to notify the board to update
        const updateEvent = new CustomEvent('match-updated', {
          detail: { match: updatedMatch }
        });
        document.dispatchEvent(updateEvent);
        
      } catch (error) {
        console.error('Error updating match:', error);
      }
    });
    
    return row;
  }

  // Load matches from the database and place them on the board
  async loadMatches() {
    try {
      // Get all matches from the database
      const matches = await db.getAllMatches();
      
      // 既存のDOM上のマッチカードをすべて削除（重複防止）
      try {
        document.querySelectorAll('.match-card').forEach(el => el.remove());
      } catch {}
      // 未割当エリアを明示的にクリア（存在する場合）
      try {
        const ua = document.getElementById('unassigned-cards');
        if (ua) ua.querySelectorAll('.match-card').forEach(el => el.remove());
      } catch {}

      // Clear existing match cards
      this.matchCards.clear();
      
      // Place matches on the board based on their court and row position
      matches.forEach(match => {
        if (match.status === 'Completed') {
          // Don't place completed matches on the board
          return;
        }
        
        this.createAndPlaceMatchCard(match); // createAndPlaceMatchCard will handle assigned/unassigned
      });
      
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  }

  // Create a match card and place it on the board
  createAndPlaceMatchCard(match) {
    console.log('[BOARD] createAndPlaceMatchCard called with match:', match);
    console.log('[BOARD] Match game format:', match.gameFormat);
    
    if (!match) {
      console.error('[BOARD] Error: match is undefined or null');
      return null;
    }
    
    if (!match.id) {
      console.error('[BOARD] Error: match.id is undefined or null');
      return null;
    }
    
    // 既存DOMノードがあれば一度除去（重複防止）
    try {
      const oldNode = document.getElementById(`match-${match.id}`) || document.querySelector(`.match-card[data-match-id="${match.id}"]`);
      if (oldNode && oldNode.parentNode) oldNode.parentNode.removeChild(oldNode);
    } catch {}

    // Create the match card
    console.log('[BOARD] Creating new MatchCard instance');
    const matchCard = new MatchCard(match);
    console.log('[BOARD] MatchCard created:', matchCard);

    // マッチカードをマップに登録（更新処理や次回のコートグリッド更新で参照するため）
    this.matchCards.set(String(match.id), matchCard);
    console.log('[BOARD] MatchCard match game format:', matchCard.match.gameFormat);
    console.log('[BOARD] MatchCard element:', matchCard.element);
    
    // 型を正規化
    const courtNum = match.courtNumber != null ? parseInt(match.courtNumber) : null;
    const rowPos = match.rowPosition ? String(match.rowPosition) : '';

    // 未割当の場合は未割当カードエリアに配置
    if (!courtNum || !rowPos) {
      const unassignedCards = document.getElementById('unassigned-cards');
      if (unassignedCards) {
        unassignedCards.appendChild(matchCard.element);
        // Ensure bulk checkbox visibility after the element enters DOM
        try { if (typeof matchCard.updateBulkSelectVisibility === 'function') matchCard.updateBulkSelectVisibility(); } catch {}
        return matchCard;
      }
    }
    
    // Find the target court and row
    const courtSlot = document.querySelector(`.court-slot[data-court-number="${courtNum}"]`);
    if (!courtSlot) return;
    
    const row = courtSlot.querySelector(`.court-row[data-row-type="${rowPos}"]`);
    if (!row) return;
    
    // Clear the placeholder if it exists
    const placeholder = row.querySelector('.row-placeholder');
    if (placeholder) {
      placeholder.style.display = 'none';
    }
    
    // カードコンテナを取得し、カードを追加
    const cardContainer = row.querySelector('.card-container');
    if (cardContainer) {
      cardContainer.appendChild(matchCard.element);
    } else {
      // 後方互換性のためにカードコンテナがない場合は行に直接追加
      row.appendChild(matchCard.element);
    }
    try { if (typeof matchCard.updateBulkSelectVisibility === 'function') matchCard.updateBulkSelectVisibility(); } catch {}
  }

  // Set up event listeners for board-related events
  setupEventListeners() {
    console.log('[BOARD] Setting up event listeners');
    
    // Listen for match updates
    document.addEventListener('match-updated', (e) => {
      const { match } = e.detail;
      console.log('[BOARD] Received match-updated event');
      
      // Handle the updated match
      this.handleMatchUpdate(match);
    });
    
    // Listen for deleted matches
  document.addEventListener('match-deleted', (e) => {
    const { matchId } = e.detail;
    console.log('[BOARD] Received match-deleted event for match ID:', matchId);

    // Remove from map
    if (this.matchCards.has(String(matchId))) {
      const matchCard = this.matchCards.get(String(matchId));
      // Ensure UI element is removed (safety)
      if (matchCard && matchCard.element) {
        matchCard.element.remove();
      }
      this.matchCards.delete(String(matchId));
    }

    // そのコートのプレースホルダー表示を更新
    if (e.detail.courtNumber) {
      this.showPlaceholderIfEmpty(e.detail.courtNumber, e.detail.rowPosition);
    }
  });

  // Listen for new matches
    document.addEventListener('match-added', (e) => {
      const { match } = e.detail;
      console.log('[BOARD] Received match-added event for match ID:', match.id, match);
      
      // Add the new match to the board.
      // createAndPlaceMatchCard will handle whether it's assigned or unassigned.
      this.createAndPlaceMatchCard(match);
    });
    
    // ドラッグ中のオートスクロール（ページ全体）
    const edge = 80; // px from top/bottom to trigger
    const step = 30; // scroll amount per event
    document.addEventListener('dragover', (e) => {
      // どの要素上でも、上/下端に近づいたらスクロール
      const y = e.clientY;
      const h = window.innerHeight || document.documentElement.clientHeight;
      if (y < edge) {
        window.scrollBy(0, -step);
      } else if (y > h - edge) {
        window.scrollBy(0, step);
      }
    });

    console.log('[BOARD] Event listeners setup complete');
  }
  
  // デバッグ用：イベントリスナーが登録されているか確認するメソッド
  _checkEventListeners(eventName) {
    return 'Event listeners check - This is just a placeholder. Real DOM event listeners cannot be directly inspected.';
  }
  
  // コート設定と試合形式設定の機能をセットアップ
  setupCourtSettings() {
    // コート数の増減ボタンのイベントリスナーを設定
    if (this.decreaseCourtsBtn) {
      this.decreaseCourtsBtn.addEventListener('click', async () => {
        if (this.numberOfCourts > 1) {
          // 削除されるコートにマッチカードがあるかチェック
          const matchesInLastCourt = this.getMatchesInCourt(this.numberOfCourts);
          
          if (matchesInLastCourt.length > 0) {
            // 確認ダイアログを表示
            const confirmMessage = `コート${this.numberOfCourts}に${matchesInLastCourt.length}件のマッチカードがあります。\nコートを減らすとこれらのマッチカードの履歴も削除されますがよろしいですか？`;
            
            if (confirm(confirmMessage)) {
              // ユーザーがOKした場合、該当するマッチを削除
              this.deleteMatchesInCourt(this.numberOfCourts);
              this.numberOfCourts--;
              await this.updateCourtGrid();
            }
            // ユーザーがキャンセルした場合は何もしない
          } else {
            // 削除されるコートにマッチカードがない場合はそのまま減らす
            this.numberOfCourts--;
            await this.updateCourtGrid();
          }
        }
      });
    }
    
    if (this.increaseCourtsBtn) {
      this.increaseCourtsBtn.addEventListener('click', async () => {
        if (this.numberOfCourts < 24) { // 最大24コートまで
          this.numberOfCourts++;
          await this.updateCourtGrid();
        }
      });
    }
    
    if (this.deleteAllMatchesBtn) {
      this.deleteAllMatchesBtn.addEventListener('click', async () => {
        // 現在のマッチカード数を取得
        const matchCount = this.matchCards.size;
        
        if (matchCount === 0) {
          alert('削除するマッチカードがありません。');
          return;
        }
        
        // 確認ダイアログを表示
        const confirmMessage = `全ての試合カード（${matchCount}件）を削除しますがよろしいですか？\nこの操作は取り消せません。`;
        
        if (confirm(confirmMessage)) {
          // ユーザーがOKした場合、全マッチカードを削除
          this.deleteAllMatches();
        }
      });
    }

  }

  // コートグリッドを更新（既存のマッチカードデータを保持）
  async updateCourtGrid() {
    console.log('[BOARD] updateCourtGrid called');
    
    // 現在のマッチカードの状態を保存
    const currentMatchStates = new Map();
    console.log('[BOARD] Current matchCards size:', this.matchCards.size);
    
    for (const [matchId, matchCard] of this.matchCards) {
      console.log('[BOARD] Processing matchCard ID:', matchId, 'matchCard:', matchCard);
      
      if (matchCard && matchCard.match) {
      const format = (matchCard.match.gameFormat || '').toLowerCase();
      const multiSet = /2set|3set/.test(format);
      // マッチカードをマップに登録（更新処理や次回のコートグリッド更新で参照するため）
      // 現在のスコアを取得して保存（DOM削除前に確実に内部データを保持）
      let scoreA = matchCard.match.scoreA;
      let scoreB = matchCard.match.scoreB;
      
      console.log('[BOARD] Initial scores from match data - ScoreA:', scoreA, 'ScoreB:', scoreB);
      
      // マルチセット形式の場合は合計スコアを再計算
      if (multiSet) {
        try { matchCard.calculateTotalScore(); } catch(e){ console.warn('calculateTotalScore failed',e);} 
        scoreA = matchCard.match.scoreA;
        scoreB = matchCard.match.scoreB;
      }
      
      // DOM入力値も参考として取得（ただし内部データを優先）
      const domScoreA = matchCard.getScoreA ? matchCard.getScoreA() : null;
      const domScoreB = matchCard.getScoreB ? matchCard.getScoreB() : null;
      
      // DOM入力値が有効で内部データと異なる場合のみ更新
      if (domScoreA !== null && domScoreA !== '' && domScoreA !== scoreA) {
        console.log('[BOARD] Using DOM scoreA:', domScoreA, 'instead of match data:', scoreA);
        scoreA = domScoreA;
      }
      if (domScoreB !== null && domScoreB !== '' && domScoreB !== scoreB) {
        console.log('[BOARD] Using DOM scoreB:', domScoreB, 'instead of match data:', scoreB);
        scoreB = domScoreB;
      }
      
      // 数値として保持されている場合は文字列へ変換
      if (typeof scoreA === 'number') scoreA = String(scoreA);
      if (typeof scoreB === 'number') scoreB = String(scoreB);
      
      // null/undefined の場合は空文字に統一
      if (scoreA == null) scoreA = '';
      if (scoreB == null) scoreB = '';
      
      const currentState = {
        ...matchCard.match,
        scoreA: scoreA,
        scoreB: scoreB,
        setScores: matchCard.getSetScores ? matchCard.getSetScores() : matchCard.match.setScores,
        tieBreakA: matchCard.getTiebreakScore ? matchCard.getTiebreakScore().A : matchCard.match.tieBreakA,
        tieBreakB: matchCard.getTiebreakScore ? matchCard.getTiebreakScore().B : matchCard.match.tieBreakB,
        winner: matchCard.match.winner
      };
      currentMatchStates.set(matchId, currentState);
      
      console.log('[BOARD] Saved state for match', matchId, '- ScoreA:', scoreA, 'ScoreB:', scoreB, 'Full state:', currentState);
    }
    }
    console.log('[BOARD] Saved states count:', currentMatchStates.size);

    // マッチカードマップをクリア
    this.matchCards.clear();

    // コートグリッドを再作成
    this.createCourtGrid();
    
    // 保存した状態でマッチカードを復元
    for (const [matchId, matchState] of currentMatchStates) {
      console.log('[BOARD] Restoring match', matchId, 'with scoreA:', matchState.scoreA, 'scoreB:', matchState.scoreB);
      // データベースから最新のマッチデータを取得（非同期）
      let matchData = null;
      if (window.db && typeof window.db.getMatch === 'function') {
        try {
          matchData = await window.db.getMatch(matchId);
        } catch (error) {
          console.warn('Failed to get match from database during restore:', error);
        }
      }
      
      // マッチデータが見つからない場合は、保存された状態をそのまま使用
      if (!matchData) {
        matchData = matchState;
      } else {
        // データベースのマッチデータに保存されたスコア値をマージ
        matchData.scoreA = matchState.scoreA;
        matchData.scoreB = matchState.scoreB;
        matchData.setScores = matchState.setScores;
        matchData.tieBreakA = matchState.tieBreakA;
        matchData.tieBreakB = matchState.tieBreakB;
        matchData.winner = matchState.winner;
        
        console.log('[BOARD] Merged match data:', matchData);
      }
      
      // データベースの該当マッチも更新
      if (window.db) {
        await window.db.updateMatch(matchData).catch(error => {
          console.warn('Failed to update match in database during court grid update:', error);
        });
      }
      
      // マッチカードを再作成して配置
      this.createAndPlaceMatchCard(matchData);
    }
    
    // コート選択オプションを更新
    this.updateCourtSelectOptions();
    
    console.log('[BOARD] updateCourtGrid completed');
  }

  // コート名をクリックした時の処理
  handleCourtNameClick(event) {
    const span = event.target;
    const courtNumber = parseInt(span.dataset.courtNumber);
    const currentName = span.textContent;
    
    // 入力フィールドを作成
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'court-name-input';
    input.value = currentName;
    input.dataset.courtNumber = courtNumber;
    
    // スパンを入力フィールドに置き換え
    span.parentNode.replaceChild(input, span);
    input.focus();
    
    // 入力完了時の処理
    const finishEdit = () => {
      const newName = input.value.trim() || `コート ${courtNumber}`;
      this.setCourtName(courtNumber, newName);
      
      // 入力フィールドをスパンに戻す
      const newSpan = document.createElement('span');
      newSpan.className = 'court-name-edit';
      newSpan.textContent = newName;
      newSpan.dataset.courtNumber = courtNumber;
      newSpan.addEventListener('click', this.handleCourtNameClick.bind(this));
      
      input.parentNode.replaceChild(newSpan, input);
      
      // コート選択オプションも更新
      this.updateCourtSelectOptions();
    };
    
    // イベントリスナーを設定
    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        finishEdit();
      }
    });
  }

  // コート名を取得
  getCourtName(courtNumber) {
    return this.courtNames[courtNumber] || `コート ${courtNumber}`;
  }
  
  // コート名を設定
  setCourtName(courtNumber, name) {
    this.courtNames[courtNumber] = name;
    this.saveCourtNames();
  }
  
  // コート名をローカルストレージに保存
  saveCourtNames() {
    localStorage.setItem('courtNames', JSON.stringify(this.courtNames));
  }
  
  // コート名をローカルストレージから読み込む
  loadCourtNames() {
    const savedNames = localStorage.getItem('courtNames');
    if (savedNames) {
      this.courtNames = JSON.parse(savedNames);
    }
  }
  
  // コート選択オプションを更新
  updateCourtSelectOptions() {
    // 1. 既存の .court-select すべてを更新
    const courtSelects = document.querySelectorAll('.court-select');
    courtSelects.forEach(select => {
      // 現在の選択値を保存
      const currentValue = select.value;
      // オプションをクリア
      select.innerHTML = '';
      // 未割当オプションを追加
      const unassignedOption = document.createElement('option');
      unassignedOption.value = '';
      unassignedOption.textContent = '未割当';
      select.appendChild(unassignedOption);
      // コートオプションを追加
      for (let i = 1; i <= this.numberOfCourts; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = this.getCourtName(i);
        select.appendChild(option);
      }
    });
    // 2. 新規試合追加モーダルのcourt-select(id="court-select")も必ず更新
    const modalCourtSelect = document.getElementById('court-select');
    if (modalCourtSelect) {
      const prevValue = modalCourtSelect.value;
      modalCourtSelect.innerHTML = '';
      const unassignedOption = document.createElement('option');
      unassignedOption.value = '';
      unassignedOption.textContent = '未割当';
      modalCourtSelect.appendChild(unassignedOption);
      for (let i = 1; i <= this.numberOfCourts; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = this.getCourtName(i);
        modalCourtSelect.appendChild(option);
      }
      // 可能なら前の選択値を復元
      if ([...modalCourtSelect.options].some(opt => opt.value === prevValue)) {
        modalCourtSelect.value = prevValue;
      }
    }
  }

  // 未割当エリアのドラッグ＆ドロップ機能を設定
  setupUnassignedArea() {
    const unassignedArea = document.getElementById('unassigned-cards');
    if (!unassignedArea) return;
    
    // ドラッグオーバー時のイベント
    unassignedArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      unassignedArea.classList.add('drag-over');
    });
    
    // ドラッグリーブ時のイベント
    unassignedArea.addEventListener('dragleave', (e) => {
      unassignedArea.classList.remove('drag-over');
    });
    
    // ドロップ時のイベント
    unassignedArea.addEventListener('drop', async (e) => {
      e.preventDefault();
      unassignedArea.classList.remove('drag-over');
      
      // ドラッグされたカードのIDを取得
      const matchIdRaw = e.dataTransfer.getData('text/plain');
      if (!matchIdRaw) return;
      const matchId = isNaN(Number(matchIdRaw)) ? String(matchIdRaw) : Number(matchIdRaw);
      
      // ソースのコートと行を取得
      const sourceCourtNumber = parseInt(e.dataTransfer.getData('source-court')) || null;
      const sourceRowType = e.dataTransfer.getData('source-row') || null;
      
      try {
        // データベースから試合を取得
        const matches = await db.getAllMatches();
        const match = matches.find(m => String(m.id) === String(matchId));
        
        if (!match) {
          console.error('Match not found:', matchId);
          return;
        }
        
        // 試合のステータスを未割当に更新
        const updatedMatch = await db.updateMatch({
          id: matchId,
          courtNumber: null,
          rowPosition: null,
          status: 'Unassigned'
        });
        
        // ボードに更新を通知するイベントを発行
        const updateEvent = new CustomEvent('match-updated', {
          detail: { match: updatedMatch }
        });
        document.dispatchEvent(updateEvent);
        
      } catch (error) {
        console.error('Error updating match:', error);
      }
    });
  }
  
  // Handle match updates
  handleMatchUpdate(match) {
    // Get the existing match card
    const existingCard = this.matchCards.get(String(match.id));
    
    if (existingCard) {
      // If the match is completed, remove it from the board
      if (match.status === 'Completed') {
        existingCard.element.remove();
        this.matchCards.delete(String(match.id));
        this.matchCards.delete(match.id);
        
        // Show the placeholder if the row is now empty
        if (match.courtNumber && match.rowPosition) {
          this.showPlaceholderIfEmpty(match.courtNumber, match.rowPosition);
        }
        
        // Dispatch an event to notify the history view to update
        const historyEvent = new CustomEvent('history-updated');
        document.dispatchEvent(historyEvent);
        
        return;
      }
      
      // 位置の比較（未割当含む）
      const oldCourtNumber = existingCard.match.courtNumber != null ? parseInt(existingCard.match.courtNumber) : null;
      const oldRowPosition = existingCard.match.rowPosition ? String(existingCard.match.rowPosition) : '';
      const newCourtNumber = match.courtNumber != null ? parseInt(match.courtNumber) : null;
      const newRowPosition = match.rowPosition ? String(match.rowPosition) : '';

      // 位置が変わらない場合は、その場でデータのみ更新し、DOMの再挿入を避ける（並び順維持）
      if (oldCourtNumber === newCourtNumber && oldRowPosition === newRowPosition) {
        existingCard.update(match);
        try { if (typeof existingCard.updateBulkSelectVisibility === 'function') existingCard.updateBulkSelectVisibility(); } catch {}
        return;
      }

      // 既存のカードを現在の位置から削除
      existingCard.element.remove();
      
      // 古い位置がコートの行だった場合、プレースホルダーを表示
      if (oldCourtNumber && oldRowPosition) {
        this.showPlaceholderIfEmpty(oldCourtNumber, oldRowPosition);
      }
      
      // カードデータを更新
      existingCard.update(match);
      
      // 新しい位置に配置
      if (!newCourtNumber || !newRowPosition) {
        // 未割当の場合は未割当カードエリアに配置
        const unassignedCards = document.getElementById('unassigned-cards');
        if (unassignedCards) {
          unassignedCards.appendChild(existingCard.element);
        }
      } else {
        // コートの行に配置
        const courtSlot = document.querySelector(`.court-slot[data-court-number="${newCourtNumber}"]`);
        if (!courtSlot) return;
        
        const row = courtSlot.querySelector(`.court-row[data-row-type="${newRowPosition}"]`);
        if (!row) return;
        
        // プレースホルダーを非表示
        const placeholder = row.querySelector('.row-placeholder');
        if (placeholder) {
          placeholder.style.display = 'none';
        }
        
        // カードコンテナに追加
        const cardContainer = row.querySelector('.card-container');
        cardContainer.appendChild(existingCard.element);
      }
      try { if (typeof existingCard.updateBulkSelectVisibility === 'function') existingCard.updateBulkSelectVisibility(); } catch {}
    } else if (match.status !== 'Completed') {
      // 新規カードの場合は作成して配置
      this.createAndPlaceMatchCard(match);
    }
  }

  // Show the placeholder if a row is empty
  showPlaceholderIfEmpty(courtNumber, rowPosition) {
    const courtSlot = document.querySelector(`.court-slot[data-court-number="${courtNumber}"]`);
    if (!courtSlot) return;
    
    const row = courtSlot.querySelector(`.court-row[data-row-type="${rowPosition}"]`);
    if (!row) return;
    
    // Check if the row has any match cards
    const hasMatchCards = row.querySelector('.match-card');
    
    // Show the placeholder if there are no match cards
    const placeholder = row.querySelector('.row-placeholder');
    if (placeholder && !hasMatchCards) {
      placeholder.style.display = 'block';
    }
  }

  // Add a new match to the board
  addMatch(match) {
    // 何もしない
  }

  getOccupiedRowPositions(courtNumber) {
    // 修正: カードが削除された後も正しく位置を取得できるようにする
    const occupiedPositions = [];
    if (!courtNumber) { // If courtNumber is null or undefined (e.g., "Unassigned" court)
      return []; // No specific positions are occupied for "Unassigned" court
    }

    const numericCourtNumber = parseInt(courtNumber);

    // 実際のDOMから現在の状態を確認する
    const courtSlot = document.querySelector(`.court-slot[data-court-number="${numericCourtNumber}"]`);
    if (courtSlot) {
      const rows = courtSlot.querySelectorAll('.court-row');
      rows.forEach(row => {
        const rowType = row.dataset.rowType;
        // カードコンテナ内のカードを確認
        const cardContainer = row.querySelector('.card-container');
        const hasCard = cardContainer && cardContainer.querySelector('.match-card');
        
        // カードがない場合は空き状態と判断
        if (!hasCard && this.getRowKeys().includes(rowType)) {
          // 空き状態なのでoccupiedPositionsには追加しない
        } else if (hasCard && this.getRowKeys().includes(rowType)) {
          occupiedPositions.push(rowType);
        }
      });
    }
    
    return [...new Set(occupiedPositions)]; // Return unique positions
  }

  // 枠キー配列を取得（例: ['current','next','next2',...,'next19']）
  getRowKeys() {
    const keys = [];
    const n = Math.max(1, Math.min(20, parseInt(this.slotsPerCourt || 6, 10)));
    for (let i = 0; i < n; i++) {
      if (i === 0) keys.push('current');
      else if (i === 1) keys.push('next');
      else keys.push('next' + i);
    }
    return keys;
  }

  // 枠数を更新して再描画
  async setSlotsPerCourt(n) {
    const v = Math.max(1, Math.min(20, parseInt(n, 10) || 6));
    if (this.slotsPerCourt === v) return;
    this.slotsPerCourt = v;
    await this.updateCourtGrid();
  }

  // コートに配置されているマッチカードを取得
  getMatchesInCourt(courtNumber) {
    const matches = [];
    this.matchCards.forEach((matchCard, matchId) => {
      const a = matchCard.match && matchCard.match.courtNumber != null ? parseInt(matchCard.match.courtNumber) : null;
      const b = courtNumber != null ? parseInt(courtNumber) : null;
      if (a != null && b != null && a === b) {
        matches.push(matchCard.match);
      }
    });
    return matches;
  }

  // コートに配置されているマッチカードを削除
  deleteMatchesInCourt(courtNumber) {
    this.matchCards.forEach((matchCard, matchId) => {
      if (matchCard.match.courtNumber === courtNumber) {
        // UI要素を削除
        matchCard.element.remove();
        
        // データベースからも削除
        if (window.db) {
          window.db.deleteMatch(matchId).catch(error => {
            console.warn('Failed to delete match from database:', error);
          });
        }
        
        // マッチカードマップから削除
        this.matchCards.delete(matchId);
      }
    });
  }

  // 全マッチカードを削除（UIブロックを回避するためにアイドル時間で分割実行）
  deleteAllMatches() {
    const allCards = Array.from(document.querySelectorAll('.match-card'));
    const BATCH_SIZE = 200; // 一度に削除するカード数
    const removeBatch = (start = 0) => {
      const end = Math.min(start + BATCH_SIZE, allCards.length);
      for (let i = start; i < end; i++) {
        allCards[i].remove();
      }
      if (end < allCards.length) {
        // 残りがあれば次のアイドルタイムで続行
        if (window.requestIdleCallback) {
          requestIdleCallback(() => removeBatch(end));
        } else {
          setTimeout(() => removeBatch(end), 0);
        }
      } else {
        // すべて削除完了
        this.matchCards.clear();
        // データベース削除は UI 操作が落ち着いた後のアイドルタイムで実行
        const deleteDb = () => {
          if (window.db) {
            window.db.deleteAllMatches()
              .then(() => {
                // クラウドにも空状態を保存（管理者モードのみ有効）。これにより更新で復活しない。
                try { if (typeof window.pushNow === 'function') { window.pushNow(); } } catch (e) { console.warn('Failed to push after clear', e); }
              })
              .catch(err => console.warn('Failed to delete all matches from database:', err));
          }
        };
        if (window.requestIdleCallback) {
          requestIdleCallback(deleteDb);
        } else {
          setTimeout(deleteDb, 0);
        }
      }
    };
    removeBatch();
  }

  // エクスポート機能のセットアップ
  setupExportFunctions() {
    const exportBtn = document.getElementById('board-export-btn');
    const exportTypeSelect = document.getElementById('board-export-type');
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const exportType = exportTypeSelect.value;
        if (exportType === 'csv') {
          this.exportToCSV();
        } else if (exportType === 'screenshot') {
          this.exportToScreenshot();
        }
      });
    }
  }

  // CSV形式で対戦表をエクスポート
  async exportToCSV() {
    try {
      // 全てのマッチカードからデータを収集
      const allMatches = [];
      this.matchCards.forEach((matchCard, matchId) => {
        // マッチカードインスタンスから最新のスコアデータを取得
        const matchData = { ...matchCard.match };
        
        // マッチカードから最新のスコアを取得
        try {
          const currentScoreA = matchCard.getScoreA();
          const currentScoreB = matchCard.getScoreB();
          const currentSetScores = matchCard.getSetScores();
          const currentTiebreakScores = matchCard.getTiebreakScore();
          
          // 最新のスコアデータで更新
          if (currentScoreA !== undefined && currentScoreA !== null) {
            matchData.scoreA = currentScoreA;
          }
          if (currentScoreB !== undefined && currentScoreB !== null) {
            matchData.scoreB = currentScoreB;
          }
          if (currentSetScores && (currentSetScores.A.length > 0 || currentSetScores.B.length > 0)) {
            matchData.setScores = currentSetScores;
          }
          if (currentTiebreakScores) {
            matchData.tieBreakA = currentTiebreakScores.A;
            matchData.tieBreakB = currentTiebreakScores.B;
          }
        } catch (error) {
          console.warn('マッチカードからスコア取得エラー:', error);
        }
        
        allMatches.push(matchData);
      });
      
      if (allMatches.length === 0) {
        alert('書き出し可能な試合データがありません');
        return;
      }
      
      // コート番号でソート
      allMatches.sort((a, b) => {
        const courtA = parseInt(a.courtNumber) || 999;
        const courtB = parseInt(b.courtNumber) || 999;
        return courtA - courtB;
      });
      
      // CSVヘッダー作成
      let csvContent = 'コート,プレイヤーA,プレイヤーB,スコア,実際終了時刻,勝者\n';
      
      // 各マッチを行として追加
      allMatches.forEach(match => {
        const courtNumber = match.courtNumber || 'N/A';
        const playerA = `"${match.playerA.replace(/"/g, '""')}"`;
        const playerB = `"${match.playerB.replace(/"/g, '""')}"`;
        
        // スコア情報を構築
        let scoreText = 'N/A';
        console.log('Match data for court', courtNumber, ':', {
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          setScores: match.setScores,
          gameFormat: match.gameFormat
        }); // デバッグ用
        
        // 試合形式を確認
        const gameFormat = (match.gameFormat || '').toLowerCase();
        const isMultiSet = gameFormat.includes('2set') || gameFormat.includes('3set');
        
        if (isMultiSet && match.setScores) {
          // マルチセット形式の場合
          console.log('Multi-set format detected, setScores:', match.setScores);
          
          let scoresA, scoresB;
          if (Array.isArray(match.setScores)) {
            // 配列形式の場合（古い形式）
            scoresA = match.setScores;
            scoresB = match.setScoresB || [];
          } else if (match.setScores.A && match.setScores.B) {
            // オブジェクト形式の場合（現在の形式）
            scoresA = match.setScores.A;
            scoresB = match.setScores.B;
          } else {
            // その他の形式を確認
            scoresA = match.setScores.playerA || match.setScores.a || [];
            scoresB = match.setScores.playerB || match.setScores.b || [];
          }
          
          const scoreParts = [];
          const maxSets = Math.max(scoresA ? scoresA.length : 0, scoresB ? scoresB.length : 0);
          
          for (let i = 0; i < maxSets; i++) {
            const scoreA = scoresA && scoresA[i] !== undefined && scoresA[i] !== null && scoresA[i] !== '' ? scoresA[i] : '';
            const scoreB = scoresB && scoresB[i] !== undefined && scoresB[i] !== null && scoresB[i] !== '' ? scoresB[i] : '';
            
            if (scoreA !== '' || scoreB !== '') {
              let setScore = `${scoreA}-${scoreB}`;
              
              // タイブレークスコアがある場合は追加
              if (match.tieBreakA && match.tieBreakA !== '' && !isNaN(match.tieBreakA)) {
                setScore += `(${match.tieBreakA})`;
              }
              scoreParts.push(setScore);
            }
          }
          
          if (scoreParts.length > 0) {
            // Excel-safe literal: ="text" prevents date conversion and keeps as string
            scoreText = '="' + scoreParts.join(' ') + '"';
          }
        } else {
          // シングルゲーム形式の場合（5game、4game1set等）
          console.log('Single game format detected, scoreA:', match.scoreA, 'scoreB:', match.scoreB);
          
          const scoreA = match.scoreA !== undefined && match.scoreA !== null && match.scoreA !== '' ? match.scoreA : '';
          const scoreB = match.scoreB !== undefined && match.scoreB !== null && match.scoreB !== '' ? match.scoreB : '';
          
          if (scoreA !== '' || scoreB !== '') {
            let gameScore = `${scoreA}-${scoreB}`;
            
            // タイブレークスコアがある場合は追加
            if (match.tieBreakA && match.tieBreakA !== '' && !isNaN(match.tieBreakA)) {
              gameScore += `(${match.tieBreakA})`;
            }
            
            // Excel-safe literal: ="text"
            scoreText = '="' + gameScore + '"';
          }
        }
        
        console.log('Final score text for court', courtNumber, ':', scoreText);
        
        // 実際終了時刻を取得
        const actualEnd = match.actualEndTime ? new Date(match.actualEndTime).toLocaleString('ja-JP') : 'N/A';
        
        // 勝者情報を修正（A/Bではなく実際の名前を表示）
        let winnerName = 'N/A';
        if (match.winner) {
          if (match.winner === 'A' || match.winner === 'playerA') {
            winnerName = `"${match.playerA.replace(/"/g, '""')}"`;
          } else if (match.winner === 'B' || match.winner === 'playerB') {
            winnerName = `"${match.playerB.replace(/"/g, '""')}"`;
          } else {
            // 既に名前が入っている場合
            winnerName = `"${match.winner.replace(/"/g, '""')}"`;
          }
        }
        
        csvContent += `${courtNumber},${playerA},${playerB},${scoreText},${actualEnd},${winnerName}\n`;
      });
      
      // ファイル名を生成
      const defaultFilename = `対戦表_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`;
      
      // 保存処理
      if (window.api && window.api.saveCSVFile) {
        try {
          const result = await window.api.saveCSVFile(csvContent, defaultFilename);
          if (result.success) {
            console.log('ファイルが保存されました:', result.path);
          } else if (result.canceled) {
            console.log('CSV保存がキャンセルされました');
          } else {
            console.error('CSV保存エラー:', result.error);
            alert('ファイルの保存に失敗しました: ' + result.error);
          }
        } catch (error) {
          console.error('CSV保存APIエラー:', error);
          this._fallbackCSVSave(csvContent, defaultFilename);
        }
      } else {
        console.warn('ネイティブのCSV保存APIが利用できないため、ブラウザの保存機能を使用します');
        this._fallbackCSVSave(csvContent, defaultFilename);
      }
    } catch (error) {
      console.error('CSVエクスポートエラー:', error);
      alert('データの書き出し中にエラーが発生しました');
    }
  }

  // フォールバックCSV保存機能
  _fallbackCSVSave(csvContent, filename) {
    try {
      // BOMを追加してExcelで文字化けを防ぐ
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const csvData = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8' });
      
      const url = URL.createObjectURL(csvData);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('CSVファイルがダウンロードされました:', filename);
    } catch (error) {
      console.error('フォールバックCSV保存エラー:', error);
      alert('CSVファイルの保存に失敗しました');
    }
  }

  // スクリーンショットエクスポート
  async exportToScreenshot() {
    let exportBtn, originalText;
    try {
      console.log('スクリーンショット機能開始');
      
      // html2canvasライブラリの確認
      if (typeof html2canvas === 'undefined') {
        console.error('html2canvas is undefined');
        alert('スクリーンショット機能に必要なライブラリが読み込まれていません。\nページを再読み込みしてから再度お試しください。');
        return;
      }
      
      console.log('html2canvas is available');
      
      // 対戦表のキャプチャ対象を決定
      let targetElement = document.querySelector('.main-board-area');
      let elementType = '.main-board-area';
      if (!targetElement) {
        targetElement = document.getElementById('court-grid');
        elementType = '#court-grid';
        if (!targetElement) {
          console.error('対戦表要素が見つかりません。.main-board-area または #court-grid が存在しません。');
          alert('対戦表が見つかりません。ページを再読み込みしてから再度お試しください。');
          return;
        }
      }
      console.log(`対戦表要素 (${elementType}) が見つかりました:`, targetElement);

      // スクリーンショット作成中のメッセージを表示
      exportBtn = document.getElementById('board-export-btn');
      originalText = exportBtn ? exportBtn.textContent : 'エクスポート';
      if (exportBtn) {
        exportBtn.textContent = '作成中...';
        exportBtn.disabled = true;
      }

      console.log('スクリーンショット作成開始');

      // Capture the full scrollable area
      const scrollHeight = targetElement.scrollHeight;
      const canvas = await html2canvas(targetElement, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        allowTaint: true,
        logging: true,
        scrollY: -window.scrollY,
        windowHeight: scrollHeight,
        height: scrollHeight
      });

      console.log('スクリーンショット作成完了');
      
      // ファイル名を生成
      const defaultFilename = `対戦表_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.png`;
      
      // CanvasをBlobに変換
      canvas.toBlob(async (blob) => {
        try {
          if (window.api && window.api.saveImageFile) {
            try {
              // BlobをArrayBufferに変換
              const arrayBuffer = await blob.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              
              const result = await window.api.saveImageFile(uint8Array, defaultFilename);
              if (result.success) {
                console.log('スクリーンショットが保存されました:', result.path);
                alert('スクリーンショットが保存されました');
              } else if (result.canceled) {
                console.log('スクリーンショット保存がキャンセルされました');
              } else {
                console.error('スクリーンショット保存エラー:', result.error);
                alert('スクリーンショットの保存に失敗しました: ' + result.error);
              }
            } catch (error) {
              console.error('スクリーンショット保存APIエラー:', error);
              this._fallbackImageSave(blob, defaultFilename);
            }
          } else {
            console.warn('ネイティブのスクリーンショット保存APIが利用できないため、ブラウザの保存機能を使用します');
            this._fallbackImageSave(blob, defaultFilename);
          }
        } finally {
          // ボタンを元に戻す
          if (exportBtn) {
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
          }
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('スクリーンショットエクスポートエラー:', error);
      alert('スクリーンショットの作成中にエラーが発生しました: ' + error.message);
    } finally {
      // エラー時もボタンを元に戻す
      try {
        document.getElementById('board-export-btn').textContent = originalText;
        document.getElementById('board-export-btn').disabled = false;
      } catch (e) {
        console.error('ボタンのリセットに失敗:', e);
      }
    }
  }

  // フォールバックスクリーンショット保存機能
  _fallbackImageSave(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('スクリーンショットがダウンロードされました:', filename);
    } catch (error) {
      console.error('フォールバックスクリーンショット保存エラー:', error);
      alert('スクリーンショットの保存に失敗しました');
    }
  }
}
