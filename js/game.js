const PIECE_INFO = {
    HUMAN:  { name: '人',   emoji: '👤', level: 6 },
    BROOM:  { name: '扫把', emoji: '🧹', level: 5 },
    DOG:    { name: '狗',   emoji: '🐶', level: 4 },
    CAT:    { name: '猫',   emoji: '🐱', level: 3 },
    MOUSE:  { name: '鼠',   emoji: '🐭', level: 2 },
    ROACH:  { name: '蟑螂', emoji: '🐛', level: 1 },
    HEART:  { name: '心',   emoji: '❤️', level: 0 }
};

const COVERED_EMOJI = '🎴';

const state = {
    board: [],
    redCemetery: [],
    blueCemetery: [],
    currentTurn: 'red',
    selected: null,
    gameOver: false,
    winner: null,
    pendingResurrect: null
};

/* ---------- 初始化 ---------- */

function initGame() {
    state.board = generateBoard();
    state.redCemetery = [];
    state.blueCemetery = [];
    state.currentTurn = 'red';
    state.selected = null;
    state.gameOver = false;
    state.winner = null;
    state.pendingResurrect = null;

    document.getElementById('resurrect-panel').style.display = 'none';

    initDOM();
    renderBoard();
    updateCemeteryDisplay();
    updateStatus();
}

function generateBoard() {
    const pieces = [];
    // 红方 16 子
    for (let i = 0; i < 6; i++) pieces.push({ piece: 'ROACH', side: 'red' });
    for (let i = 0; i < 3; i++) pieces.push({ piece: 'MOUSE', side: 'red' });
    for (let i = 0; i < 3; i++) pieces.push({ piece: 'CAT', side: 'red' });
    for (let i = 0; i < 2; i++) pieces.push({ piece: 'DOG', side: 'red' });
    pieces.push({ piece: 'BROOM', side: 'red' });
    pieces.push({ piece: 'HUMAN', side: 'red' });
    // 蓝方 16 子
    for (let i = 0; i < 6; i++) pieces.push({ piece: 'ROACH', side: 'blue' });
    for (let i = 0; i < 3; i++) pieces.push({ piece: 'MOUSE', side: 'blue' });
    for (let i = 0; i < 3; i++) pieces.push({ piece: 'CAT', side: 'blue' });
    for (let i = 0; i < 2; i++) pieces.push({ piece: 'DOG', side: 'blue' });
    pieces.push({ piece: 'BROOM', side: 'blue' });
    pieces.push({ piece: 'HUMAN', side: 'blue' });
    // 心 4 颗
    for (let i = 0; i < 4; i++) pieces.push({ piece: 'HEART', side: 'neutral' });

    // Fisher-Yates 洗牌
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    const board = [];
    let idx = 0;
    for (let r = 0; r < 6; r++) {
        const row = [];
        for (let c = 0; c < 6; c++) {
            row.push({ ...pieces[idx], revealed: false, id: idx });
            idx++;
        }
        board.push(row);
    }
    return board;
}

/* ---------- DOM ---------- */

function initDOM() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
            const div = document.createElement('div');
            div.className = 'cell';
            div.id = `cell-${r}-${c}`;
            div.addEventListener('click', () => onCellClick(r, c));
            boardEl.appendChild(div);
        }
    }
}

function renderCell(r, c) {
    const cell = state.board[r][c];
    const div = document.getElementById(`cell-${r}-${c}`);
    div.className = 'cell';

    if (!cell.revealed) {
        div.classList.add('covered');
        div.textContent = COVERED_EMOJI;
    } else if (cell.piece === null) {
        div.classList.add('empty');
        div.textContent = '';
    } else if (cell.piece === 'HEART') {
        div.classList.add('heart');
        div.textContent = PIECE_INFO.HEART.emoji;
    } else {
        const info = PIECE_INFO[cell.piece];
        div.textContent = info.emoji;
        if (cell.side === 'red') div.classList.add('red');
        else if (cell.side === 'blue') div.classList.add('blue');
    }

    if (state.selected && state.selected.r === r && state.selected.c === c) {
        div.classList.add('selected');
    }

    if (state.selected && isValidMove(state.selected.r, state.selected.c, r, c)) {
        div.classList.add('valid-target');
    }
}

function renderBoard() {
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
            renderCell(r, c);
        }
    }
}

/* ---------- 交互 ---------- */

function onCellClick(r, c) {
    if (state.gameOver) return;
    if (state.currentTurn !== 'red') return;
    if (state.pendingResurrect) return;

    const cell = state.board[r][c];
    const selected = state.selected;

    if (!selected) {
        if (!cell.revealed) {
            revealCell(r, c);
        } else if (cell.side === 'red' && cell.piece !== null) {
            state.selected = { r, c };
            renderBoard();
        }
    } else {
        if (selected.r === r && selected.c === c) {
            state.selected = null;
            renderBoard();
        } else if (isValidMove(selected.r, selected.c, r, c)) {
            executeMove(selected.r, selected.c, r, c);
        } else if (cell.revealed && cell.side === 'red' && cell.piece !== null) {
            state.selected = { r, c };
            renderBoard();
        } else {
            state.selected = null;
            renderBoard();
            if (!cell.revealed) {
                revealCell(r, c);
            }
        }
    }
}

/* ---------- 翻牌 ---------- */

function revealCell(r, c) {
    const cell = state.board[r][c];
    cell.revealed = true;
    renderCell(r, c);

    if (cell.piece === 'HEART') {
        handleHeart(r, c);
    } else {
        endTurn();
    }
}

/* ---------- 移动 / 战斗 ---------- */

function isValidMove(fromR, fromC, toR, toC) {
    if (toR < 0 || toR >= 6 || toC < 0 || toC >= 6) return false;
    const dr = Math.abs(toR - fromR);
    const dc = Math.abs(toC - fromC);
    if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) return false;

    const toCell = state.board[toR][toC];
    const fromCell = state.board[fromR][fromC];
    if (!toCell.revealed) return false;
    if (toCell.piece === null) return true;
    if (toCell.side === fromCell.side) return false;
    if (toCell.side === 'neutral') return false;
    return true;
}

function executeMove(fromR, fromC, toR, toC) {
    const fromCell = state.board[fromR][fromC];
    const toCell = state.board[toR][toC];

    state.selected = null;

    if (toCell.piece === null) {
        state.board[toR][toC] = { ...fromCell };
        state.board[fromR][fromC] = createEmptyCell();
        renderCell(fromR, fromC);
        renderCell(toR, toC);
        endTurn();
    } else {
        resolveBattle(fromR, fromC, toR, toC);
    }
}

function resolveBattle(fromR, fromC, toR, toC) {
    const attacker = state.board[fromR][fromC];
    const defender = state.board[toR][toC];

    let result;
    if (attacker.piece === 'ROACH' && defender.piece === 'HUMAN') {
        result = 'attacker_win';
    } else if (attacker.piece === 'HUMAN' && defender.piece === 'ROACH') {
        result = 'defender_win';
    } else {
        const aLvl = PIECE_INFO[attacker.piece].level;
        const dLvl = PIECE_INFO[defender.piece].level;
        if (aLvl > dLvl) result = 'attacker_win';
        else if (aLvl < dLvl) result = 'defender_win';
        else result = 'draw';
    }

    if (result === 'attacker_win') {
        addToCemetery(defender.piece, defender.side);
        state.board[toR][toC] = { ...attacker };
        state.board[fromR][fromC] = createEmptyCell();
    } else if (result === 'defender_win') {
        addToCemetery(attacker.piece, attacker.side);
        state.board[fromR][fromC] = createEmptyCell();
    } else {
        addToCemetery(attacker.piece, attacker.side);
        addToCemetery(defender.piece, defender.side);
        state.board[toR][toC] = createEmptyCell();
        state.board[fromR][fromC] = createEmptyCell();
    }

    renderCell(fromR, fromC);
    renderCell(toR, toC);
    updateCemeteryDisplay();
    endTurn();
}

/* ---------- 心 / 复活 ---------- */

function handleHeart(r, c) {
    const side = state.currentTurn;
    const cemetery = side === 'red' ? state.redCemetery : state.blueCemetery;

    if (cemetery.length === 0) {
        state.board[r][c] = createEmptyCell();
        renderCell(r, c);
        endTurn();
    } else {
        if (side === 'red') {
            showResurrectPanel(r, c);
        } else {
            const best = getBestResurrectPiece(cemetery);
            performResurrect(best, r, c);
        }
    }
}

function showResurrectPanel(r, c) {
    state.pendingResurrect = { r, c };
    const panel = document.getElementById('resurrect-panel');
    const opts = document.getElementById('resurrect-options');
    opts.innerHTML = '';

    const cemetery = state.redCemetery;
    const counts = {};
    cemetery.forEach(p => { counts[p] = (counts[p] || 0) + 1; });

    Object.keys(counts).forEach(piece => {
        const info = PIECE_INFO[piece];
        const btn = document.createElement('button');
        btn.className = 'resurrect-btn';
        btn.innerHTML = `<span class="piece-emoji">${info.emoji}</span> ${info.name} x${counts[piece]}`;
        btn.addEventListener('click', () => performResurrect(piece, r, c));
        opts.appendChild(btn);
    });

    panel.style.display = 'block';
}

function performResurrect(piece, r, c) {
    const side = state.currentTurn;
    const cemetery = side === 'red' ? state.redCemetery : state.blueCemetery;
    const idx = cemetery.indexOf(piece);
    if (idx !== -1) cemetery.splice(idx, 1);

    state.board[r][c] = { piece, side, revealed: true, id: -1 };
    state.pendingResurrect = null;
    document.getElementById('resurrect-panel').style.display = 'none';

    renderCell(r, c);
    updateCemeteryDisplay();
    endTurn();
}

function getBestResurrectPiece(cemetery) {
    let best = cemetery[0];
    let bestLvl = PIECE_INFO[best].level;
    for (const p of cemetery) {
        const lvl = PIECE_INFO[p].level;
        if (lvl > bestLvl) {
            best = p;
            bestLvl = lvl;
        }
    }
    return best;
}

/* ---------- AI ---------- */

function aiTurn() {
    setTimeout(() => {
        if (state.gameOver) return;

        const moves = getAllLegalMoves('blue');
        const eatMoves = moves.filter(m => {
            const target = state.board[m.toR][m.toC];
            return target.piece !== null && target.side !== 'blue' && target.side !== 'neutral';
        });

        // 过滤掉必败的吃子，绝不主动送死
        const safeEatMoves = eatMoves.filter(m => {
            const attacker = state.board[m.fromR][m.fromC];
            const defender = state.board[m.toR][m.toC];
            return predictBattleResult(attacker, defender) !== 'defender_win';
        });

        if (safeEatMoves.length > 0) {
            const winMoves = safeEatMoves.filter(m => {
                const attacker = state.board[m.fromR][m.fromC];
                const defender = state.board[m.toR][m.toC];
                return predictBattleResult(attacker, defender) === 'attacker_win';
            });

            let pool;
            if (winMoves.length > 0) {
                // 必胜吃子中，优先吃敌方等级最高的
                winMoves.sort((a, b) => {
                    const lvlA = PIECE_INFO[state.board[a.toR][a.toC].piece].level;
                    const lvlB = PIECE_INFO[state.board[b.toR][b.toC].piece].level;
                    return lvlB - lvlA;
                });
                const bestLvl = PIECE_INFO[state.board[winMoves[0].toR][winMoves[0].toC].piece].level;
                pool = winMoves.filter(m => PIECE_INFO[state.board[m.toR][m.toC].piece].level === bestLvl);
            } else {
                // 只有同归于尽时，优先用己方低级换敌方高级
                pool = safeEatMoves.slice();
                pool.sort((a, b) => {
                    const aDiff = PIECE_INFO[state.board[a.toR][a.toC].piece].level
                                - PIECE_INFO[state.board[a.fromR][a.fromC].piece].level;
                    const bDiff = PIECE_INFO[state.board[b.toR][b.toC].piece].level
                                - PIECE_INFO[state.board[b.fromR][b.fromC].piece].level;
                    return bDiff - aDiff;
                });
            }

            const move = pool[Math.floor(Math.random() * pool.length)];
            executeMove(move.fromR, move.fromC, move.toR, move.toC);
            return;
        }

        const emptyMoves = moves.filter(m => state.board[m.toR][m.toC].piece === null);
        if (emptyMoves.length > 0) {
            // 1) 优先"逼近"：移动后下一步能必胜吃敌方棋子，按目标等级排序
            const approachMoves = [];
            for (const m of emptyMoves) {
                const movingPiece = state.board[m.fromR][m.fromC];
                let bestTargetLevel = 0;
                const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                for (const [dr, dc] of dirs) {
                    const nr = m.toR + dr, nc = m.toC + dc;
                    if (nr < 0 || nr >= 6 || nc < 0 || nc >= 6) continue;
                    const target = state.board[nr][nc];
                    if (target.revealed && target.piece !== null && target.side !== 'blue' && target.side !== 'neutral') {
                        if (predictBattleResult(movingPiece, target) === 'attacker_win') {
                            const lvl = PIECE_INFO[target.piece].level;
                            if (lvl > bestTargetLevel) bestTargetLevel = lvl;
                        }
                    }
                }
                if (bestTargetLevel > 0) {
                    approachMoves.push({ move: m, score: bestTargetLevel });
                }
            }
            if (approachMoves.length > 0) {
                approachMoves.sort((a, b) => b.score - a.score);
                const bestScore = approachMoves[0].score;
                const pool = approachMoves.filter(a => a.score === bestScore).map(a => a.move);
                const move = pool[Math.floor(Math.random() * pool.length)];
                executeMove(move.fromR, move.fromC, move.toR, move.toC);
                return;
            }

            // 2) 其次"逃跑"：当前位置旁边有能赢自己的敌方棋子，且移动后能脱离危险
            const escapeMoves = [];
            for (const m of emptyMoves) {
                const movingPiece = state.board[m.fromR][m.fromC];
                const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                // 当前位置是否危险
                let inDanger = false;
                for (const [dr, dc] of dirs) {
                    const nr = m.fromR + dr, nc = m.fromC + dc;
                    if (nr < 0 || nr >= 6 || nc < 0 || nc >= 6) continue;
                    const neighbor = state.board[nr][nc];
                    if (neighbor.revealed && neighbor.piece !== null && neighbor.side !== 'blue' && neighbor.side !== 'neutral') {
                        if (predictBattleResult(neighbor, movingPiece) === 'attacker_win') {
                            inDanger = true; break;
                        }
                    }
                }
                if (!inDanger) continue;
                // 新位置是否安全
                let stillDanger = false;
                for (const [dr, dc] of dirs) {
                    const nr = m.toR + dr, nc = m.toC + dc;
                    if (nr < 0 || nr >= 6 || nc < 0 || nc >= 6) continue;
                    const neighbor = state.board[nr][nc];
                    if (neighbor.revealed && neighbor.piece !== null && neighbor.side !== 'blue' && neighbor.side !== 'neutral') {
                        if (predictBattleResult(neighbor, movingPiece) === 'attacker_win') {
                            stillDanger = true; break;
                        }
                    }
                }
                if (!stillDanger) escapeMoves.push(m);
            }
            if (escapeMoves.length > 0) {
                const move = escapeMoves[Math.floor(Math.random() * escapeMoves.length)];
                executeMove(move.fromR, move.fromC, move.toR, move.toC);
                return;
            }

            // 3) 都没满足，再随机移动
            const move = emptyMoves[Math.floor(Math.random() * emptyMoves.length)];
            executeMove(move.fromR, move.fromC, move.toR, move.toC);
            return;
        }

        const covered = [];
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 6; c++) {
                if (!state.board[r][c].revealed) covered.push({ r, c });
            }
        }
        if (covered.length > 0) {
            const cell = covered[Math.floor(Math.random() * covered.length)];
            revealCell(cell.r, cell.c);
        }
    }, 500);
}

function getAllLegalMoves(side) {
    const moves = [];
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
            const cell = state.board[r][c];
            if (cell.revealed && cell.side === side && cell.piece !== null) {
                const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                for (const [dr, dc] of dirs) {
                    const nr = r + dr, nc = c + dc;
                    if (isValidMove(r, c, nr, nc)) {
                        moves.push({ fromR: r, fromC: c, toR: nr, toC: nc });
                    }
                }
            }
        }
    }
    return moves;
}

function predictBattleResult(attacker, defender) {
    if (attacker.piece === 'ROACH' && defender.piece === 'HUMAN') return 'attacker_win';
    if (attacker.piece === 'HUMAN' && defender.piece === 'ROACH') return 'defender_win';
    const aLvl = PIECE_INFO[attacker.piece].level;
    const dLvl = PIECE_INFO[defender.piece].level;
    if (aLvl > dLvl) return 'attacker_win';
    if (aLvl < dLvl) return 'defender_win';
    return 'draw';
}

/* ---------- 回合 / 胜负 ---------- */

function hasAnyAction(side) {
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
            if (!state.board[r][c].revealed) return true;
        }
    }
    return getAllLegalMoves(side).length > 0;
}

function endTurn() {
    checkGameOver();
    if (state.gameOver) return;

    state.currentTurn = state.currentTurn === 'red' ? 'blue' : 'red';

    if (!hasAnyAction(state.currentTurn)) {
        const winner = state.currentTurn === 'red' ? 'blue' : 'red';
        endGame(winner);
        return;
    }

    updateStatus();

    if (state.currentTurn === 'blue') {
        aiTurn();
    }
}

function checkGameOver() {
    let redAlive = 0, blueAlive = 0;
    let redCovered = 0, blueCovered = 0;
    let coveredHearts = 0;

    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
            const cell = state.board[r][c];
            if (cell.piece === null) continue;
            if (!cell.revealed) {
                if (cell.piece === 'HEART') coveredHearts++;
                else if (cell.side === 'red') redCovered++;
                else if (cell.side === 'blue') blueCovered++;
            } else {
                if (cell.side === 'red') redAlive++;
                else if (cell.side === 'blue') blueAlive++;
            }
        }
    }

    const redOut = (redAlive === 0 && redCovered === 0 && coveredHearts === 0);
    const blueOut = (blueAlive === 0 && blueCovered === 0 && coveredHearts === 0);

    if (redOut && blueOut) {
        endGame('draw');
    } else if (redOut) {
        endGame('blue');
    } else if (blueOut) {
        endGame('red');
    }
}

function endGame(winner) {
    state.gameOver = true;
    state.winner = winner;
    const msg = winner === 'draw' ? '平局！' : (winner === 'red' ? '🔴 红方获胜！' : '🔵 蓝方获胜！');
    document.getElementById('game-message').textContent = msg;
    document.getElementById('turn-indicator').innerHTML = `游戏结束：${msg}`;
}

/* ---------- UI 更新 ---------- */

function updateStatus() {
    const turnEl = document.getElementById('turn-indicator');
    const msgEl = document.getElementById('game-message');
    if (state.currentTurn === 'red') {
        turnEl.innerHTML = '当前回合：<span class="red-text">🔴 红方</span>';
        msgEl.textContent = state.gameOver ? msgEl.textContent : '点击盖牌翻开，或点击己方翻开棋子移动';
    } else {
        turnEl.innerHTML = '当前回合：<span class="blue-text">🔵 蓝方（AI）</span>';
        if (!state.gameOver) msgEl.textContent = 'AI 思考中...';
    }
}

function updateCemeteryDisplay() {
    document.querySelector('#red-cemetery .cemetery-pieces').textContent =
        state.redCemetery.map(p => PIECE_INFO[p].emoji).join(' ');
    document.querySelector('#blue-cemetery .cemetery-pieces').textContent =
        state.blueCemetery.map(p => PIECE_INFO[p].emoji).join(' ');
}

/* ---------- 工具 ---------- */

function createEmptyCell() {
    return { piece: null, side: null, revealed: true, id: -1 };
}

function addToCemetery(piece, side) {
    if (side === 'red') state.redCemetery.push(piece);
    else if (side === 'blue') state.blueCemetery.push(piece);
}

/* ---------- 启动 ---------- */

document.getElementById('restart-btn').addEventListener('click', initGame);
initGame();
