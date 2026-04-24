const PIECE_INFO = {
    HUMAN:  { name: '人',   emoji: '👤', level: 6 },
    BROOM:  { name: '扫把', emoji: '🧹', level: 5 },
    DOG:    { name: '狗',   emoji: '🐶', level: 4 },
    CAT:    { name: '猫',   emoji: '🐱', level: 3 },
    MOUSE:  { name: '鼠',   emoji: '🐭', level: 2 },
    ROACH:  { name: '蟑螂', emoji: '🕷️', level: 1 },
    HEART:  { name: '心',   emoji: '❤️', level: 0 }
};

const COVERED_EMOJI = '🎴';

const IMAGE_MAP = {
    HUMAN:  { red: 'image/green_human.jpg',  blue: 'image/red_human.jpg' },
    BROOM:  { red: 'image/green_broom.jpg',  blue: 'image/red_broom.jpg' },
    DOG:    { red: 'image/green_dog.png',    blue: 'image/red_dog.png' },
    CAT:    { red: 'image/green_cat.png',    blue: 'image/red_cat.png' },
    MOUSE:  { red: 'image/green_mouse.png',  blue: 'image/red_mouse.png' },
    ROACH:  { red: 'image/neutral_roach.png', blue: 'image/neutral_roach.png' },
    HEART:  { neutral: 'image/neutral_heart.png' }
};

const state = {
    board: [],
    redCemetery: [],
    blueCemetery: [],
    currentTurn: 'red',
    selected: null,
    gameOver: false,
    winner: null,
    pendingResurrect: null,
    gameMode: 'single',
    busy: false
};

/* ---------- 初始化 ---------- */

function startGame(mode) {
    state.gameMode = mode;
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    initGame();
}

function backToMenu() {
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex';
    document.getElementById('game-over-modal').style.display = 'none';
}

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
    document.getElementById('game-over-modal').style.display = 'none';

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
        div.innerHTML = `<img src="${IMAGE_MAP.HEART.neutral}" alt="heart">`;
    } else {
        const info = PIECE_INFO[cell.piece];
        const imgPath = IMAGE_MAP[cell.piece][cell.side];
        div.innerHTML = `<img src="${imgPath}" alt="${info.name}">`;
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
    if (state.busy) return;
    if (state.gameMode === 'single' && state.currentTurn !== 'red') return;
    if (state.pendingResurrect) return;

    const cell = state.board[r][c];
    const selected = state.selected;
    const mySide = state.currentTurn;

    if (!selected) {
        if (!cell.revealed) {
            revealCell(r, c);
        } else if (cell.side === mySide && cell.piece !== null) {
            state.selected = { r, c };
            renderBoard();
        }
    } else {
        if (selected.r === r && selected.c === c) {
            state.selected = null;
            renderBoard();
        } else if (isValidMove(selected.r, selected.c, r, c)) {
            executeMove(selected.r, selected.c, r, c);
        } else if (cell.revealed && cell.side === mySide && cell.piece !== null) {
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

    const div = document.getElementById(`cell-${r}-${c}`);
    if (div) {
        div.classList.add('flip-anim');
        setTimeout(() => div.classList.remove('flip-anim'), 300);
    }

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

function getPieceImagePath(cell) {
    if (!cell.piece) return null;
    if (cell.piece === 'HEART') return IMAGE_MAP.HEART.neutral;
    return IMAGE_MAP[cell.piece][cell.side];
}

function animateMove(fromR, fromC, toR, toC, imgPath, callback) {
    const fromDiv = document.getElementById(`cell-${fromR}-${fromC}`);
    const toDiv = document.getElementById(`cell-${toR}-${toC}`);
    if (!fromDiv || !toDiv || !imgPath) { callback(); return; }

    const fromRect = fromDiv.getBoundingClientRect();
    const toRect = toDiv.getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.className = 'move-ghost';
    ghost.style.left = fromRect.left + 'px';
    ghost.style.top = fromRect.top + 'px';
    ghost.style.width = fromRect.width + 'px';
    ghost.style.height = fromRect.height + 'px';
    ghost.innerHTML = `<img src="${imgPath}" alt="">`;
    document.body.appendChild(ghost);

    requestAnimationFrame(() => {
        ghost.style.transform = `translate(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px)`;
    });

    setTimeout(() => {
        ghost.remove();
        callback();
    }, 250);
}

function executeMove(fromR, fromC, toR, toC) {
    const fromCell = state.board[fromR][fromC];
    const toCell = state.board[toR][toC];

    state.selected = null;

    if (toCell.piece === null) {
        const imgPath = getPieceImagePath(fromCell);
        state.board[toR][toC] = { ...fromCell };
        state.board[fromR][fromC] = createEmptyCell();
        renderBoard();

        animateMove(fromR, fromC, toR, toC, imgPath, () => {
            endTurn();
        });
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

    renderBoard();
    updateCemeteryDisplay();

    if (result === 'attacker_win') {
        const imgPath = getPieceImagePath(attacker);
        animateMove(fromR, fromC, toR, toC, imgPath, () => {
            const toDiv = document.getElementById(`cell-${toR}-${toC}`);
            if (toDiv) {
                toDiv.classList.add('pop-anim');
                setTimeout(() => toDiv.classList.remove('pop-anim'), 250);
            }
            endTurn();
        });
    } else if (result === 'draw') {
        const imgPath = getPieceImagePath(attacker);
        animateMove(fromR, fromC, toR, toC, imgPath, () => {
            const fromDiv = document.getElementById(`cell-${fromR}-${fromC}`);
            const toDiv = document.getElementById(`cell-${toR}-${toC}`);
            if (fromDiv) { fromDiv.classList.add('shake-anim'); setTimeout(() => fromDiv.classList.remove('shake-anim'), 200); }
            if (toDiv)   { toDiv.classList.add('shake-anim'); setTimeout(() => toDiv.classList.remove('shake-anim'), 200); }
            endTurn();
        });
    } else {
        const fromDiv = document.getElementById(`cell-${fromR}-${fromC}`);
        if (fromDiv) { fromDiv.classList.add('shake-anim'); setTimeout(() => fromDiv.classList.remove('shake-anim'), 200); }
        endTurn();
    }
}

/* ---------- 心 / 复活 ---------- */

function handleHeart(r, c) {
    const side = state.currentTurn;
    const cemetery = side === 'red' ? state.redCemetery : state.blueCemetery;

    if (cemetery.length === 0) {
        state.busy = true;
        setTimeout(() => {
            state.board[r][c] = createEmptyCell();
            renderCell(r, c);
            state.busy = false;
            endTurn();
        }, 500);
    } else {
        if (state.gameMode === 'double' || side === 'red') {
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

    const cemetery = state.currentTurn === 'red' ? state.redCemetery : state.blueCemetery;
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

        // 再筛"安全吃子"：吃完后不会被敌方相邻棋子立刻反杀
        const secureEatMoves = safeEatMoves.filter(m => isSafeAfterMove(m));

        // 提前计算场上盖牌，后面多处要用
        const covered = [];
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 6; c++) {
                if (!state.board[r][c].revealed) covered.push({ r, c });
            }
        }

        if (secureEatMoves.length > 0) {
            const winMoves = secureEatMoves.filter(m => {
                const attacker = state.board[m.fromR][m.fromC];
                const defender = state.board[m.toR][m.toC];
                return predictBattleResult(attacker, defender) === 'attacker_win';
            });

            let pool;
            if (winMoves.length > 0) {
                winMoves.sort((a, b) => {
                    const lvlA = PIECE_INFO[state.board[a.toR][a.toC].piece].level;
                    const lvlB = PIECE_INFO[state.board[b.toR][b.toC].piece].level;
                    return lvlB - lvlA;
                });
                const bestLvl = PIECE_INFO[state.board[winMoves[0].toR][winMoves[0].toC].piece].level;
                pool = winMoves.filter(m => PIECE_INFO[state.board[m.toR][m.toC].piece].level === bestLvl);
            } else {
                pool = secureEatMoves.slice();
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
        const safeEmptyMoves = emptyMoves.filter(m => isSafeAfterMove(m));

        if (safeEmptyMoves.length > 0) {
            // 有安全移动时，35% 概率选择翻牌（如果有盖牌），避免一味走路
            if (covered.length > 0 && Math.random() < 0.35) {
                const cell = covered[Math.floor(Math.random() * covered.length)];
                revealCell(cell.r, cell.c);
                return;
            }

            const approachMoves = [];
            for (const m of safeEmptyMoves) {
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
                if (bestTargetLevel > 0) approachMoves.push({ move: m, score: bestTargetLevel });
            }
            if (approachMoves.length > 0) {
                approachMoves.sort((a, b) => b.score - a.score);
                const bestScore = approachMoves[0].score;
                const pool = approachMoves.filter(a => a.score === bestScore).map(a => a.move);
                const move = pool[Math.floor(Math.random() * pool.length)];
                executeMove(move.fromR, move.fromC, move.toR, move.toC);
                return;
            }

            const escapeMoves = [];
            for (const m of safeEmptyMoves) {
                const movingPiece = state.board[m.fromR][m.fromC];
                const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
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
                if (inDanger) escapeMoves.push(m);
            }
            if (escapeMoves.length > 0) {
                const move = escapeMoves[Math.floor(Math.random() * escapeMoves.length)];
                executeMove(move.fromR, move.fromC, move.toR, move.toC);
                return;
            }

            const move = safeEmptyMoves[Math.floor(Math.random() * safeEmptyMoves.length)];
            executeMove(move.fromR, move.fromC, move.toR, move.toC);
            return;
        }

        // 没有安全移动，走危险移动也比卡住强
        if (emptyMoves.length > 0) {
            const move = emptyMoves[Math.floor(Math.random() * emptyMoves.length)];
            executeMove(move.fromR, move.fromC, move.toR, move.toC);
            return;
        }

        // 翻牌
        if (covered.length > 0) {
            const cell = covered[Math.floor(Math.random() * covered.length)];
            revealCell(cell.r, cell.c);
            return;
        }

        // 兜底：理论上走不到这里，因为 hasAnyAction 会拦截
        // 但如果走到了，强制结束回合避免卡死
        endTurn();
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

function isSafeAfterMove(move) {
    const attacker = state.board[move.fromR][move.fromC];
    const defender = state.board[move.toR][move.toC];
    const newR = move.toR, newC = move.toC;

    // 蟑螂吃人：1级换6级，哪怕吃完被反杀也是血赚，直接认为安全
    if (attacker.piece === 'ROACH' && defender.piece === 'HUMAN') {
        return true;
    }

    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of dirs) {
        const nr = newR + dr, nc = newC + dc;
        if (nr < 0 || nr >= 6 || nc < 0 || nc >= 6) continue;
        const neighbor = state.board[nr][nc];
        if (neighbor.revealed && neighbor.piece !== null && neighbor.side !== attacker.side && neighbor.side !== 'neutral') {
            if (predictBattleResult(neighbor, attacker) === 'attacker_win') {
                return false;
            }
        }
    }
    return true;
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

    if (state.currentTurn === 'blue' && state.gameMode === 'single') {
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
    state.selected = null;
    renderBoard();

    const msg = winner === 'draw' ? '平局！' : (winner === 'blue' ? '🔴 红方获胜！' : '🟢 绿方获胜！');
    document.getElementById('game-message').textContent = msg;
    document.getElementById('turn-indicator').innerHTML = `游戏结束：${msg}`;

    const modal = document.getElementById('game-over-modal');
    document.getElementById('modal-result').textContent = msg;
    modal.style.display = 'flex';
}

/* ---------- UI 更新 ---------- */

function updateStatus() {
    const turnEl = document.getElementById('turn-indicator');
    const msgEl = document.getElementById('game-message');
    if (state.gameOver) return;
    if (state.currentTurn === 'blue') {
        turnEl.innerHTML = '当前回合：<span class="ai-text">🔴 红方</span>';
        msgEl.textContent = state.gameMode === 'single' ? 'AI 思考中...' : '红方回合：点击盖牌翻开，或点击己方翻开棋子移动';
    } else {
        turnEl.innerHTML = '当前回合：<span class="player-text">🟢 绿方</span>';
        msgEl.textContent = '点击盖牌翻开，或点击己方翻开棋子移动';
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

const IMAGES_TO_PRELOAD = [
    'image/green_human.jpg',
    'image/red_human.jpg',
    'image/green_broom.jpg',
    'image/red_broom.jpg',
    'image/green_dog.png',
    'image/red_dog.png',
    'image/green_cat.png',
    'image/red_cat.png',
    'image/green_mouse.png',
    'image/red_mouse.png',
    'image/neutral_roach.png',
    'image/neutral_heart.png'
];

function preloadImages(callback) {
    const startTime = Date.now();
    const total = IMAGES_TO_PRELOAD.length;
    let loaded = 0;

    function tryCallback() {
        const elapsed = Date.now() - startTime;
        const remain = Math.max(0, 1000 - elapsed);
        setTimeout(callback, remain);
    }

    function updateProgress() {
        const percent = Math.round((loaded / total) * 100);
        const fill = document.getElementById('progress-fill');
        const text = document.getElementById('progress-text');
        if (fill) fill.style.width = percent + '%';
        if (text) text.textContent = percent + '%';
    }

    if (total === 0) {
        tryCallback();
        return;
    }

    IMAGES_TO_PRELOAD.forEach(src => {
        const img = new Image();
        img.onload = () => { loaded++; updateProgress(); if (loaded === total) tryCallback(); };
        img.onerror = () => { loaded++; updateProgress(); if (loaded === total) tryCallback(); };
        img.src = src;
    });
}

function onAssetsLoaded() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex';
}

document.getElementById('restart-btn').addEventListener('click', initGame);
document.getElementById('modal-restart-btn').addEventListener('click', initGame);
document.getElementById('btn-single').addEventListener('click', () => startGame('single'));
document.getElementById('btn-double').addEventListener('click', () => startGame('double'));
document.getElementById('back-btn').addEventListener('click', backToMenu);

preloadImages(onAssetsLoaded);
