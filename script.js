document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const gameViewport = document.getElementById('game-viewport');
    const gameBoard = document.getElementById('game-board');
    const resetButton = document.getElementById('reset-button');
    const mineCounterDisplay = document.getElementById('mine-counter');
    const timerDisplay = document.getElementById('timer');
    const messageOverlay = document.getElementById('message-overlay');
    const messageText = document.getElementById('message-text');

    // Game Settings
    const ROWS = 50;
    const COLS = 50;
    const MINES_COUNT = 330;
    const HEX_WIDTH = 40;
    const HEX_HEIGHT = 46.19;

    // Game State & Element Cache
    let grid = [];
    let hexagonElements = [];
    let gameOver = false;
    let minesPlaced = false;
    let revealedCells = 0;
    let flagsPlaced = 0;
    let timerInterval;
    let time = 0;

    // Drag-to-scroll state
    let isDragging = false;
    let hasDragged = false;
    let startX, startY;
    let scrollLeftStart, scrollTopStart;

    function startGame() {
        gameOver = false;
        minesPlaced = false;
        revealedCells = 0;
        flagsPlaced = 0;
        time = 0;

        clearInterval(timerInterval);
        timerDisplay.textContent = 'Time: 0s';
        mineCounterDisplay.textContent = `Mines: ${MINES_COUNT}`;
        messageOverlay.style.display = 'none';

        createDataGrid();
        createVisualGrid();

        // Add all event listeners for a new game
        gameBoard.addEventListener('click', handleLeftClick);
        gameBoard.addEventListener('contextmenu', handleRightClick);
        gameBoard.addEventListener('dblclick', handleDoubleClick);

        gameViewport.scrollLeft = (gameBoard.scrollWidth - gameViewport.clientWidth) / 2;
        gameViewport.scrollTop = (gameBoard.scrollHeight - gameViewport.clientHeight) / 2;
        applyFisheyeEffect();
    }

    function createDataGrid() {
        grid = Array(ROWS).fill(null).map(() => Array(COLS).fill(null).map(() => ({
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            adjacentMines: 0
        })));
    }

    function createVisualGrid() {
        gameBoard.innerHTML = '';
        hexagonElements = [];
        const hexHorizontalSpacing = HEX_WIDTH * 0.75;
        const hexVerticalSpacing = HEX_HEIGHT;

        for (let col = 0; col < COLS; col++) {
            for (let row = 0; row < ROWS; row++) {
                const hexagon = document.createElement('div');
                hexagon.classList.add('hexagon');
                hexagon.dataset.row = row;
                hexagon.dataset.col = col;
                const x = col * hexHorizontalSpacing;
                const y = row * hexVerticalSpacing + (col % 2 === 1 ? hexVerticalSpacing / 2 : 0);
                hexagon.style.left = `${x}px`;
                hexagon.style.top = `${y}px`;
                gameBoard.appendChild(hexagon);
                hexagonElements.push(hexagon);
            }
        }
        gameBoard.appendChild(messageOverlay);

        const boardWidth = (COLS - 1) * hexHorizontalSpacing + HEX_WIDTH;
        const boardHeight = ROWS * hexVerticalSpacing + (hexVerticalSpacing / 2);
        gameBoard.style.width = `${boardWidth}px`;
        gameBoard.style.height = `${boardHeight}px`;
    }

    function applyFisheyeEffect() {
        const viewportRect = gameViewport.getBoundingClientRect();
        const centerX = gameViewport.scrollLeft + viewportRect.width / 2;
        const centerY = gameViewport.scrollTop + viewportRect.height / 2;
        const radius = viewportRect.width / 2;

        for (const hexagon of hexagonElements) {
            const hexRect = hexagon.getBoundingClientRect();
            const hexX = parseFloat(hexagon.style.left) + hexRect.width / 2;
            const hexY = parseFloat(hexagon.style.top) + hexRect.height / 2;
            const dx = hexX - centerX;
            const dy = hexY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < radius) {
                const normalizedDist = distance / radius;
                const scale = (Math.cos(normalizedDist * Math.PI / 2) + 1) / 1.5;
                const pullFactor = 0.4 * (1 - scale);
                const tx = -dx * pullFactor;
                const ty = -dy * pullFactor;
                hexagon.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
                hexagon.style.zIndex = Math.floor(100 * scale);
            } else {
                hexagon.style.transform = 'scale(0.4)';
                hexagon.style.zIndex = 0;
            }
        }
    }

    function placeMines(clickedRow, clickedCol) {
        const allCells = [];
        for (let r = 0; r < ROWS; r++) { for (let c = 0; c < COLS; c++) { if (r !== clickedRow || c !== clickedCol) { allCells.push({ r, c }); } } }
        for (let i = allCells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [allCells[i], allCells[j]] = [allCells[j], allCells[i]]; }
        for (let i = 0; i < MINES_COUNT; i++) { const cell = allCells[i]; grid[cell.r][cell.c].isMine = true; }
        for (let r = 0; r < ROWS; r++) { for (let c = 0; c < COLS; c++) { if (!grid[r][c].isMine) { grid[r][c].adjacentMines = countAdjacentMines(r, c); } } }
        minesPlaced = true;
    }

    function getNeighbors(row, col) {
        const neighbors = [];
        const isOddCol = col % 2 === 1;
        const neighborOffsets = isOddCol ? [{ r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 1, c: -1 }, { r: 0, c: 1 }, { r: 1, c: 1 }] : [{ r: -1, c: 0 }, { r: 1, c: 0 }, { r: -1, c: -1 }, { r: 0, c: -1 }, { r: -1, c: 1 }, { r: 0, c: 1 }];
        for (const offset of neighborOffsets) {
            let newRow = row + offset.r; let newCol = col + offset.c;
            newRow = (newRow + ROWS) % ROWS; newCol = (newCol + COLS) % COLS;
            neighbors.push({ row: newRow, col: newCol });
        }
        return neighbors;
    }

    function countAdjacentMines(row, col) { return getNeighbors(row, col).filter(n => grid[n.row][n.col].isMine).length; }

    function handleLeftClick(e) {
        if (hasDragged) return;
        const hexagon = e.target.closest('.hexagon');
        if (gameOver || !hexagon) return;
        const row = parseInt(hexagon.dataset.row); const col = parseInt(hexagon.dataset.col);
        const cell = grid[row][col];
        if (cell.isFlagged || cell.isRevealed) return;
        if (!minesPlaced) { placeMines(row, col); startTimer(); }
        if (cell.isMine) { endGame(false); return; }
        revealCell(row, col);
        checkWinCondition();
    }

    function handleRightClick(e) {
        e.preventDefault();
        if (hasDragged) return;
        const hexagon = e.target.closest('.hexagon');
        if (gameOver || !hexagon) return;
        const row = parseInt(hexagon.dataset.row); const col = parseInt(hexagon.dataset.col);
        const cell = grid[row][col];
        if (cell.isRevealed) return;
        cell.isFlagged = !cell.isFlagged;
        hexagon.classList.toggle('flagged');
        flagsPlaced += cell.isFlagged ? 1 : -1;
        updateMineCounter();
    }

    function handleDoubleClick(e) {
        if (hasDragged || gameOver) return;
        const hexagon = e.target.closest('.hexagon');
        if (!hexagon) return;

        const row = parseInt(hexagon.dataset.row);
        const col = parseInt(hexagon.dataset.col);
        const cell = grid[row][col];

        // Chording only works on revealed cells with a number
        if (!cell.isRevealed || cell.adjacentMines === 0) return;

        const neighbors = getNeighbors(row, col);
        const flaggedNeighbors = neighbors.filter(n => grid[n.row][n.col].isFlagged).length;

        // If flagged neighbors match the cell's number, reveal other non-flagged neighbors
        if (flaggedNeighbors === cell.adjacentMines) {
            neighbors.forEach(n => {
                if (!grid[n.row][n.col].isRevealed && !grid[n.row][n.col].isFlagged) {
                    revealCell(n.row, n.col);
                }
            });
            checkWinCondition();
        }
    }

    function revealCell(row, col) {
        const cell = grid[row][col];
        if (!cell || cell.isRevealed || cell.isFlagged) return;
        cell.isRevealed = true;
        revealedCells++;
        const hexagon = document.querySelector(`[data-row='${row}'][data-col='${col}']`);
        hexagon.classList.add('revealed');
        if (cell.adjacentMines > 0) {
            hexagon.innerHTML = `<span class="hex-number">${cell.adjacentMines}</span>`;
            hexagon.dataset.mines = cell.adjacentMines;
        } else {
            getNeighbors(row, col).forEach(n => revealCell(n.row, n.col));
        }
    }

    function endGame(isWin) {
        gameOver = true;
        clearInterval(timerInterval);
        messageText.textContent = isWin ? 'Congratulations, you won!' : 'Game Over!';
        messageOverlay.style.display = 'flex';
        // Remove listeners to prevent further interaction
        gameBoard.removeEventListener('click', handleLeftClick);
        gameBoard.removeEventListener('contextmenu', handleRightClick);
        gameBoard.removeEventListener('dblclick', handleDoubleClick);
        if (!isWin) {
            grid.forEach((row, r) => {
                row.forEach((cell, c) => {
                    if (cell.isMine) {
                        const hexagon = document.querySelector(`[data-row='${r}'][data-col='${c}']`);
                        hexagon.classList.add('mine');
                    }
                });
            });
        }
    }

    function checkWinCondition() { if (revealedCells === ROWS * COLS - MINES_COUNT) { endGame(true); } }
    function updateMineCounter() { mineCounterDisplay.textContent = `Mines: ${MINES_COUNT - flagsPlaced}`; }
    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => { time++; timerDisplay.textContent = `Time: ${time}s`; }, 1000);
    }

    // --- Event Listeners ---
    gameViewport.addEventListener('scroll', () => { requestAnimationFrame(applyFisheyeEffect); });
    gameViewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        hasDragged = false;
        gameViewport.style.cursor = 'grabbing';
        startX = e.pageX;
        startY = e.pageY;
        scrollLeftStart = gameViewport.scrollLeft;
        scrollTopStart = gameViewport.scrollTop;
    });
    gameViewport.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX;
        const y = e.pageY;
        const walkX = x - startX;
        const walkY = y - startY;
        if (Math.abs(walkX) > 3 || Math.abs(walkY) > 3) { hasDragged = true; }
        gameViewport.scrollLeft = scrollLeftStart - walkX;
        gameViewport.scrollTop = scrollTopStart - walkY;
    });
    const stopDragging = () => { isDragging = false; gameViewport.style.cursor = 'grab'; };
    gameViewport.addEventListener('mouseup', stopDragging);
    gameViewport.addEventListener('mouseleave', stopDragging);

    resetButton.addEventListener('click', startGame);
    startGame();
});
