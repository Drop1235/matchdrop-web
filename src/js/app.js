// Main application script
document.addEventListener('DOMContentLoaded', () => {
  // Viewer mode is now opt-in via URL parameter, not by hostname.
  // Use ?viewer=1 to open read-only viewer (skip interactive init).
  const params = new URLSearchParams(location.search);
  const forceViewer = params.get('viewer') === '1';
  if (forceViewer) {
    console.log('[APP] viewer mode forced via ?viewer=1 - skipping interactive init');
    return;
  }

  // OP ingestion fallback: Ensure tid/tname from URL are reflected in localStorage before using tournaments
  try {
    const tid = params.get('tid');
    const tname = params.get('tname');
    if (tid && tname) {
      console.log('[OP ingest-app] query params detected', { tid, tname });
      const raw = localStorage.getItem('tournaments');
      const list = raw ? JSON.parse(raw) : [];
      let nextList = Array.isArray(list) ? list.slice() : [];
      const idx = nextList.findIndex(t => t && t.id === tid);
      if (idx === -1) {
        nextList.push({ id: tid, name: tname });
      } else {
        nextList[idx] = { id: tid, name: tname };
      }
      localStorage.setItem('tournaments', JSON.stringify(nextList));
      localStorage.setItem('currentTournamentId', tid);
      console.log('[OP ingest-app] tournaments updated', nextList);
    } else {
      console.log('[OP ingest-app] no tid/tname in URL');
    }
  } catch (e) {
    console.warn('[OP ingest-app] failed to ingest tid/tname', e);
  }


  // 大会リスト取得・保存用
  function getTournaments() {
    const t = localStorage.getItem('tournaments');
    return t ? JSON.parse(t) : [];
  }
  function saveTournaments(tournaments) {
    localStorage.setItem('tournaments', JSON.stringify(tournaments));
  }
  function getCurrentTournamentId() {
    return localStorage.getItem('currentTournamentId');
  }
  function setCurrentTournamentId(id) {
    localStorage.setItem('currentTournamentId', id);
  }

  // --- CourtCount persistence (大会別 + legacy fallback) ---
  function _courtCountKey() {
    const tid = getCurrentTournamentId() || 'default';
    return 'courtCount_' + tid;
  }
  function loadCourtCount(defaultValue = 12) {
    // per-tournament
    const v = localStorage.getItem(_courtCountKey());
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return n;

    // legacy fallback
    const g = localStorage.getItem('courtCount');
    const ng = parseInt(g, 10);
    if (Number.isFinite(ng) && ng > 0) return ng;

    return defaultValue;
  }
  function storeCourtCount(n) {
    localStorage.setItem(_courtCountKey(), String(n));
    localStorage.setItem('courtCount', String(n)); // legacy sync
  }

  // UI上のコート数表示を更新
  function updateCourtCountDisplay(n) {
    const disp = document.getElementById('court-count-display');
    if (disp) disp.textContent = String(n);
  }

  // UI上で最大コート数を反映（余剰コート隠す）
  function applyCourtVisibilityLimit(maxCourts) {
    const grid = document.getElementById('court-grid');
    if (grid) {
      [...grid.children].forEach((el, i) => {
        el.style.display = (i < maxCourts) ? '' : 'none';
      });
    }
    const disp = document.getElementById('court-count-display');
    if (disp) disp.textContent = maxCourts;
  }

  // DB上で maxCourts を超える試合を Unassigned に移動
  async function pruneMatchesAbove(maxCourts) {
    if (!window.db?.getAllMatches) return;
    try {
      const matches = await window.db.getAllMatches();
      const toMove = matches.filter(m => m.courtNumber && m.courtNumber > maxCourts);
      for (const m of toMove) {
        const updated = await window.db.updateMatch({
          id: m.id,
          courtNumber: null,
          rowPosition: null,
          status: 'Unassigned'
        });
        // 通知してUI更新
        document.dispatchEvent(new CustomEvent('match-updated', { detail: { match: updated }}));
      }
      if (toMove.length) {
        console.log(`[COURTS] Pruned ${toMove.length} matches >${maxCourts}.`);
      }
    } catch (err) {
      console.error('[COURTS] pruneMatchesAbove error', err);
    }
  }

  // 大会リスト初期化
  let tournaments = getTournaments();
  if (tournaments.length === 0) {
    // デフォルト大会を作成
    const defaultId = 'default-' + Date.now();
    tournaments.push({ id: defaultId, name: 'デフォルト大会' });
    saveTournaments(tournaments);
    setCurrentTournamentId(defaultId);
  }

  // 必要なDOM要素参照を先に取得（nullガード付きで運用）
  const tournamentSelect = document.getElementById('tournament-select');
  const addTournamentBtn = document.getElementById('add-tournament-btn');

  // ドロップダウン反映
  function updateTournamentSelect() {
    if (!tournamentSelect) {
      console.error('[APP] tournamentSelect element not found');
      return;
    }
    tournaments = getTournaments();
    const currentId = getCurrentTournamentId();
    tournamentSelect.innerHTML = '';
    tournaments.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === currentId) opt.selected = true;
      tournamentSelect.appendChild(opt);
    });
  }
  updateTournamentSelect();

  // 新規大会名入力モーダル制御
  const tournamentModal = document.getElementById('tournament-modal');
  const tournamentNameInput = document.getElementById('tournament-name-input');
  const tournamentModalOk = document.getElementById('tournament-modal-ok');
  const tournamentModalCancel = document.getElementById('tournament-modal-cancel');

  function openTournamentModal() {
    // 確実に入力フィールドを有効化し、クリック・入力可能にする
    if (tournamentNameInput) {
      tournamentNameInput.disabled = false;
    tournamentNameInput.removeAttribute('disabled');
      tournamentNameInput.readOnly = false;
      tournamentNameInput.style.pointerEvents = 'auto';
      tournamentNameInput.style.cursor = 'text';
      tournamentNameInput.tabIndex = 0;
    }

    tournamentModal.classList.add('active');
    tournamentModal.style.display = 'block'; // display:block を明示

    tournamentNameInput.value = '';
    setTimeout(() => tournamentNameInput.focus(), 100);
  }
  function closeTournamentModal() {
  tournamentModal.style.display = 'none';
    tournamentModal.classList.remove('active');
    tournamentNameInput.value = '';
  }

  if (addTournamentBtn) {
    addTournamentBtn.addEventListener('click', () => {
      openTournamentModal();
    });
  } else {
    console.warn('[APP] addTournamentBtn not found');
  }
  tournamentModalCancel.addEventListener('click', () => {
    closeTournamentModal();
  });
  tournamentModalOk.addEventListener('click', () => {
    const name = tournamentNameInput.value.trim();
    if (name) {
      const id = 'tournament-' + Date.now();
      tournaments.push({ id, name });
      saveTournaments(tournaments);
      setCurrentTournamentId(id);
      updateTournamentSelect();
      closeTournamentModal();
      window.location.reload();
    } else {
      tournamentNameInput.focus();
    }
  });
  tournamentNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tournamentModalOk.click();
    if (e.key === 'Escape') closeTournamentModal();
  });

  // 大会切り替え
  if (tournamentSelect) {
    tournamentSelect.addEventListener('change', (e) => {
      setCurrentTournamentId(e.target.value);
      window.location.reload(); // 大会切り替え時に全リロード（後で最適化可）
    });
  }
  // 「更新」ボタンのクリックイベント
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // ページ全体をリロード（キャッシュを無視して強制リロード）
      if (typeof window.location.reload === 'function') {
        // `true` はレガシー仕様のため try-catch でフォールバック
        try {
          window.location.reload(true);
        } catch (_) {
          window.location.reload();
        }
      } else {
        // Fallback for environments like certain Electron versions
        window.location.href = window.location.href;
      }
    });
  }

  // 大会削除機能
  const deleteTournamentBtn = document.getElementById('delete-tournament-btn');
  deleteTournamentBtn.addEventListener('click', () => {
    const currentId = getCurrentTournamentId();
    const currentName = tournaments.find(t => t.id === currentId)?.name || '';
    if (!currentId) return;
    if (tournaments.length === 1) {
      alert('大会が1つしかないため削除できません。');
      return;
    }
    if (!confirm(`大会「${currentName}」を本当に削除しますか？\nこの大会の対戦表・履歴データも全て消去されます。`)) {
      return;
    }
    // 大会リストから削除
    const newTournaments = tournaments.filter(t => t.id !== currentId);
    saveTournaments(newTournaments);
    // 大会データ削除
    localStorage.removeItem('tennisTournamentMatches_' + currentId);
    // 新しいカレントIDを決定
    const nextId = newTournaments[0]?.id;
    setCurrentTournamentId(nextId);
    updateTournamentSelect();
    window.location.reload();
  });
  // --- 大会管理機能 ここまで ---
  console.log('[APP] DOM content loaded, initializing application.');
  
  // コート数をロード（大会別に保存）
  const initialCourtCount = loadCourtCount(12);
  
  // Initialize components
  console.log('[APP] Creating Board instance.');
  
  // 既存の board インスタンスがあるか確認
  if (window.boardInstance) {
    console.log('[APP] Found existing boardInstance, using it');
    window.board = window.boardInstance;

    // enforce saved court count
    if (window.board.numberOfCourts !== initialCourtCount) {
      if (typeof window.board.setNumberOfCourts === 'function') {
        window.board.setNumberOfCourts(initialCourtCount);
      } else {
        window.board.numberOfCourts = initialCourtCount;
        if (typeof window.board.render === 'function') window.board.render();
      }
    }
    applyCourtVisibilityLimit(initialCourtCount);
    updateCourtCountDisplay(initialCourtCount);
    pruneMatchesAbove(initialCourtCount);
  } else {
    console.log('[APP] No existing boardInstance found, creating new Board');
    window.board = new Board(initialCourtCount);
    applyCourtVisibilityLimit(initialCourtCount);
    updateCourtCountDisplay(initialCourtCount);
    pruneMatchesAbove(initialCourtCount);
  }
  
  const history = new History();
  
  // Set up navigation
  const boardViewBtn = document.getElementById('board-view-btn');
  const historyViewBtn = document.getElementById('history-view-btn');
  const boardView = document.getElementById('board-view');
  const historyView = document.getElementById('history-view');
  
  console.log('[APP] Navigation elements:', {
    boardViewBtn: !!boardViewBtn,
    historyViewBtn: !!historyViewBtn,
    boardView: !!boardView,
    historyView: !!historyView
  });
  
  // ボタンが存在するか確認
  if (boardViewBtn && historyViewBtn && boardView && historyView) {
    console.log('[APP] Setting up navigation buttons');
    
    // ボードビューボタンのクリックイベント
    boardViewBtn.onclick = function() {
      console.log('[APP] Board view button clicked');
      boardView.classList.add('active-view');
      historyView.classList.remove('active-view');
      boardView.classList.remove('hidden-view');
      historyView.classList.add('hidden-view');
      
      boardViewBtn.classList.add('active');
      historyViewBtn.classList.remove('active');
    };
    
    // 履歴ビューボタンのクリックイベント
    historyViewBtn.onclick = function() {
      console.log('[APP] History view button clicked');
      historyView.classList.add('active-view');
      boardView.classList.remove('active-view');
      historyView.classList.remove('hidden-view');
      boardView.classList.add('hidden-view');
      
      historyViewBtn.classList.add('active');
      boardViewBtn.classList.remove('active');
    };
  } else {
    console.error('[APP] Navigation elements not found!');
    alert('ナビゲーション要素が見つかりません。アプリを再起動してください。');
  }
  
  // Set up add match modal
  const addMatchBtn = document.getElementById('add-match-btn');
  const addMatchModal = document.getElementById('add-match-modal');
  const closeModal = document.querySelector('.close-modal');
  const addMatchForm = document.getElementById('add-match-form');
  const courtSelect = document.getElementById('court-select');
  const positionSelect = document.getElementById('position-select');
  
  // 要素が見つかったかどうかをログに出力（デバッグ用）
  console.log('[APP] Add match button found:', !!addMatchBtn);
  console.log('[APP] Add match modal found:', !!addMatchModal);
  console.log('[APP] Close modal found:', !!closeModal);
  console.log('[APP] Add match form found:', !!addMatchForm);
  
  // 「Win」入力時の時刻表示機能
  const playerAInput = document.getElementById('player-a');
  const playerBInput = document.getElementById('player-b');

  function handleWinInput(event) {
    const inputElement = event.target;
    // inputElement とその親ノードが存在することを確認
    if (!inputElement || !inputElement.parentNode) {
      console.warn('[APP] 「Win」検出のための入力要素またはその親が見つかりません。');
      return;
    }

    const existingTimeDisplayId = inputElement.id + '-time-display';
    let timeDisplayElement = document.getElementById(existingTimeDisplayId);

    // 大文字・小文字を区別せずに "win" をチェック
    if (inputElement.value.toLowerCase().includes('win')) {
      if (!timeDisplayElement) {
        timeDisplayElement = document.createElement('span');
        timeDisplayElement.id = existingTimeDisplayId;
        timeDisplayElement.style.marginLeft = '5px'; // マージン調整
        timeDisplayElement.classList.add('win-time-display'); // CSSでのスタイリング用クラス
        // 入力フィールドの直後に時刻表示スパンを挿入
        if (inputElement.nextSibling) {
          inputElement.parentNode.insertBefore(timeDisplayElement, inputElement.nextSibling);
        } else {
          inputElement.parentNode.appendChild(timeDisplayElement);
        }
      }
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timeString = `${hours}:${minutes}:${seconds}`;
      timeDisplayElement.textContent = `(${timeString})`; // 表示形式: (HH:MM:SS)
    } else {
      // 入力値に "win" が含まれていない場合、時刻表示が存在すれば削除
      if (timeDisplayElement) {
        timeDisplayElement.remove();
      }
    }
  }

  if (playerAInput) {
    playerAInput.addEventListener('input', handleWinInput);
  }
  if (playerBInput) {
    playerBInput.addEventListener('input', handleWinInput);
  }
  // 「Win」入力時の時刻表示機能ここまで
  
  // コート選択オプションは board.updateCourtSelectOptions() で更新されるため、ここでは不要
  
  // Function to update position select options
  const updatePositionSelectOptions = () => {
    const selectedCourtValue = courtSelect.value;
    let occupiedPositions = [];

    if (selectedCourtValue && window.board) { // Check if a specific court is selected and board exists
      occupiedPositions = window.board.getOccupiedRowPositions(selectedCourtValue);
    }

    for (const option of positionSelect.options) {
      if (option.value === "") { // "Unassigned" option
        option.disabled = false;
        option.style.display = '';
      } else if (selectedCourtValue === "") { // If "Unassigned" court is selected, all positions are available
        option.disabled = false;
        option.style.display = '';
      } else {
        if (occupiedPositions.includes(option.value)) {
          option.disabled = true;
          option.style.display = 'none'; // Hide occupied slots
        } else {
          option.disabled = false;
          option.style.display = '';
        }
      }
    }
    // Ensure the current selection is valid, if not, select "Unassigned"
    if (positionSelect.selectedOptions.length > 0 && positionSelect.selectedOptions[0].disabled) {
      positionSelect.value = "";
    }
  };

  // Open modal - 試合追加ボタンのクリックイベント
  if (addMatchBtn) {
    console.log('[APP] Setting up click event listener for add match button');
    
    // インラインイベントハンドラを使用
    addMatchBtn.onclick = function() {
      console.log('[APP] Add match button clicked via onclick');
      
      if (addMatchForm) {
        addMatchForm.reset(); // Reset form first
      }
      
      if (typeof updatePositionSelectOptions === 'function') {
        updatePositionSelectOptions(); // Then update position options based on (potentially reset) court selection
      } else {
        console.error('[APP] updatePositionSelectOptions is not a function');
      }

      // Load and set preferred game format
      const preferredGameFormat = localStorage.getItem('preferredGameFormat');
      if (preferredGameFormat) {
        const gameFormatSelect = document.getElementById('game-format-select');
        if (gameFormatSelect) {
          // Check if the preferredGameFormat is a valid option in the select
          const optionExists = Array.from(gameFormatSelect.options).some(option => option.value === preferredGameFormat);
          if (optionExists) {
            gameFormatSelect.value = preferredGameFormat;
          } else {
            // Default if stored value is invalid or not an option
            gameFormatSelect.value = '5game'; 
          }
        }
      } else {
        // Default if no preference stored
        const gameFormatSelect = document.getElementById('game-format-select');
        if (gameFormatSelect) {
          gameFormatSelect.value = '5game';
        }
      }

      if (addMatchModal) {
        addMatchModal.style.display = 'block';
        
        // モーダルが表示された後に最初の入力フィールドにフォーカスを当てる
        // --- 入力欄を即時有効化しフォーカスする処理 ---
        const a = document.getElementById('player-a');
        const b = document.getElementById('player-b');
        if (a) {
          a.removeAttribute('disabled');
          a.readOnly = false;
          a.style.pointerEvents = 'auto';
        }
        if (b) {
          b.removeAttribute('disabled');
          b.readOnly = false;
          b.style.pointerEvents = 'auto';
        }
        // 1フレーム後にフォーカスを当てることで描画確定後に入力可能とする
        requestAnimationFrame(() => {
          if (a) a.focus();
        });
      }
      return false; // イベントの伝播を停止
    };
    
    // スタイルを直接設定して確実にクリック可能にする
    addMatchBtn.style.pointerEvents = 'auto';
    addMatchBtn.style.cursor = 'pointer';
    addMatchBtn.style.opacity = '1';
  } else {
    console.error('[APP] Add match button not found');
    alert('試合追加ボタンが見つかりません。アプリを再起動してください。');
  }

  // Update position select when court selection changes
  if (courtSelect) {
    courtSelect.addEventListener('change', updatePositionSelectOptions);
  }
  
  // Close modal
  if (closeModal && addMatchModal) {
    closeModal.onclick = function() {
      addMatchModal.style.display = 'none';
    };
  }
  
  // Close modal when clicking outside
  if (addMatchModal) {
    window.onclick = function(e) {
      if (e.target === addMatchModal) {
        addMatchModal.style.display = 'none';
      }
    };
  }
  
  // コート数の変更を保存
  const saveCourtsCount = async () => {
    if (!window.board) return;
    const n = window.board.numberOfCourts;
    storeCourtCount(n);
    applyCourtVisibilityLimit(n);
    updateCourtCountDisplay(n);
    await pruneMatchesAbove(n);
  };
  
  // コート数変更ボタンのイベントリスナーを追加
  const decreaseCourtsBtn = document.getElementById('decrease-courts-btn');
  const increaseCourtsBtn = document.getElementById('increase-courts-btn');
  
  if (decreaseCourtsBtn) {
    decreaseCourtsBtn.addEventListener('click', () => {
      setTimeout(saveCourtsCount, 0);  // ensure board updated
    });
  }
  
  if (increaseCourtsBtn) {
    increaseCourtsBtn.addEventListener('click', () => {
      setTimeout(saveCourtsCount, 0);
    });
  }
  
  // Handle form submission
  if (addMatchForm) {
    addMatchForm.onsubmit = async function(e) {
      e.preventDefault();
      console.log('[APP] Form submission started');
      
      const playerA = document.getElementById('player-a').value.trim();
      const playerB = document.getElementById('player-b').value.trim();
      const courtNumber = document.getElementById('court-select').value;
      const position = document.getElementById('position-select').value;
      const gameFormat = document.getElementById('game-format-select').value;
      
      // Save the selected game format for next time
      localStorage.setItem('preferredGameFormat', gameFormat);

      console.log('[APP] Form data:', { playerA, playerB, courtNumber, position, gameFormat });
      
      try {
        // Create new match object
        const newMatch = {
          playerA,
          playerB,
          gameFormat, // Add selected game format
          // 予定開始時刻は設定しない
          status: position ? 
            (position === 'current' ? 'Current' : 
             position === 'next' ? 'Next' : 
             position === 'next2' ? 'Next2' : 
             position === 'next3' ? 'Next3' : 
             position === 'next4' ? 'Next4' : 
             position === 'next5' ? 'Next5' : 'Unassigned') : 'Unassigned',
          courtNumber: courtNumber ? parseInt(courtNumber) : null,
          rowPosition: position || null
        };
        
        // メモリDBに保存し、戻り値（ID付き）を取得
        const addedMatch = await db.addMatch(newMatch);
        console.log('[APP] Match added to Memory DB:', addedMatch);
        
        // Dispatch event to notify board of new match
        const addEvent = new CustomEvent('match-added', {
          detail: { match: addedMatch }
        });
        document.dispatchEvent(addEvent);
        console.log('[APP] Event dispatched');
        
        // Reset form and close modal
        addMatchForm.reset();
        addMatchModal.style.display = 'none';
        
      } catch (error) {
        console.error('Error adding match:', error);
        alert('試合の追加に失敗しました。もう一度お試しください。');
      }
      
      return false;
    };
  }
  
  // Handle drag from board to history
  const historyTable = document.getElementById('history-table-body');
  if (historyTable) {
    historyTable.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      historyTable.classList.add('row-highlight');
    });
    
    historyTable.addEventListener('dragleave', () => {
      historyTable.classList.remove('row-highlight');
    });
    
    historyTable.addEventListener('drop', async (e) => {
      e.preventDefault();
      historyTable.classList.remove('row-highlight');
      
      // Get the match ID from the dragged card
      const matchId = parseInt(e.dataTransfer.getData('text/plain'));
      if (!matchId) return;
      
      // Get the source court and row
      const sourceCourtNumber = parseInt(e.dataTransfer.getData('source-court')) || null;
      const sourceRowType = e.dataTransfer.getData('source-row') || null;
      
      try {
        // Get the match from the database
        const matches = await db.getAllMatches();
        const match = matches.find(m => m.id === matchId);
        
        if (!match) {
          console.error('Match not found:', matchId);
          return;
        }
        
        // Set match as completed
        // 既にactualEndTimeがある場合はそれを使い、なければ今の時刻
        const actualEndTime = match.actualEndTime || new Date().toISOString();
        
        // Update the match in the database
        const updatedMatch = await db.updateMatch({
          id: matchId,
          status: 'Completed',
          actualEndTime
        });
        
        // Dispatch an event to notify the board to update
        const updateEvent = new CustomEvent('match-updated', {
          detail: { match: updatedMatch }
        });
        document.dispatchEvent(updateEvent);
        
      } catch (error) {
        console.error('Error completing match:', error);
      }
    });
  }
  
  console.log('[APP] Application initialization complete');
});

// グローバルエラーハンドラーを設定
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', { message, source, lineno, colno, error });
  return false;
};
