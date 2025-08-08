document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const gameBoard = document.getElementById('game-board');
    const resetButton = document.getElementById('reset-button');
    const mineCounterDisplay = document.getElementById('mine-counter');
    const timerDisplay = document.getElementById('timer');
    const messageOverlay = document.getElementById('message-overlay');
    const messageText = document.getElementById('message-text');

    // Game Settings
    const ROWS = 15;
    const COLS = 20;
    const MINES_COUNT = 40;
    const HEX_WIDTH = 40;
    const HEX_HEIGHT = 46.19;

    // Game State
    let grid = [];
    let gameOver = false;
    let minesPlaced = false;
    let revealedCells = 0;
    let flagsPlaced = 0;
    let timerInterval;
    let time = 0;

    function startGame() {
        // Reset state
        gameOver = false;
        minesPlaced = false;
        revealedCells = 0;
        flagsPlaced = 0;
        time = 0;

        // Reset UI
        clearInterval(timerInterval);
        timerDisplay.textContent = 'Time: 0s';
        mineCounterDisplay.textContent = `Mines: ${MINES_COUNT}`;
        messageOverlay.style.display = 'none';

        // Setup game
        createDataGrid();
        createVisualGrid();

        // Remove old listeners and add new ones
        gameBoard.removeEventListener('click', handleLeftClick);
        gameBoard.removeEventListener('contextmenu', handleRightClick);
        gameBoard.addEventListener('click', handleLeftClick);
        gameBoard.addEventListener('contextmenu', handleRightClick);
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
        gameBoard.innerHTML = ''; // Clear board for reset, keeps overlay element
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
            }
        }
        // Re-append overlay so it's on top
        gameBoard.appendChild(messageOverlay);

        const boardWidth = (COLS - 1) * hexHorizontalSpacing + HEX_WIDTH;
        const boardHeight = ROWS * hexVerticalSpacing + (hexVerticalSpacing / 2);
        gameBoard.style.width = `${boardWidth}px`;
        gameBoard.style.height = `${boardHeight}px`;
    }

    // Refactored mine placement for better performance and fairness
    function placeMines(clickedRow, clickedCol) {
        const allCells = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (r !== clickedRow || c !== clickedCol) {
                    allCells.push({ r, c });
                }
            }
        }

        // Shuffle the cells array
        for (let i = allCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
        }

        // Place mines
        for (let i = 0; i < MINES_COUNT; i++) {
            const cell = allCells[i];
            grid[cell.r][cell.c].isMine = true;
        }

        // Calculate adjacent mines for all cells
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (!grid[r][c].isMine) {
                    grid[r][c].adjacentMines = countAdjacentMines(r, c);
                }
            }
        }
        minesPlaced = true;
    }

    function getNeighbors(row, col) {
        const neighbors = [];
        const isOddCol = col % 2 === 1;
        const neighborOffsets = isOddCol ? [
            { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 1, c: -1 }, { r: 0, c: 1 }, { r: 1, c: 1 }
        ] : [
            { r: -1, c: 0 }, { r: 1, c: 0 }, { r: -1, c: -1 }, { r: 0, c: -1 }, { r: -1, c: 1 }, { r: 0, c: 1 }
        ];

        for (const offset of neighborOffsets) {
            let newRow = row + offset.r;
            let newCol = col + offset.c;

            newRow = (newRow + ROWS) % ROWS;
            newCol = (newCol + COLS) % COLS;

            neighbors.push({ row: newRow, col: newCol });
        }
        return neighbors;
    }

    function countAdjacentMines(row, col) {
        return getNeighbors(row, col).filter(n => grid[n.row][n.col].isMine).length;
    }

    function handleLeftClick(e) {
        const hexagon = e.target.closest('.hexagon');
        if (gameOver || !hexagon) return;

        const row = parseInt(hexagon.dataset.row);
        const col = parseInt(hexagon.dataset.col);
        const cell = grid[row][col];

        if (cell.isFlagged || cell.isRevealed) return;

        if (!minesPlaced) {
            placeMines(row, col);
            startTimer();
        }

        if (cell.isMine) {
            endGame(false);
            return;
        }

        revealCell(row, col);
        checkWinCondition();
    }

    function handleRightClick(e) {
        e.preventDefault();
        const hexagon = e.target.closest('.hexagon');
        if (gameOver || !hexagon) return;

        const row = parseInt(hexagon.dataset.row);
        const col = parseInt(hexagon.dataset.col);
        const cell = grid[row][col];

        if (cell.isRevealed) return;

        cell.isFlagged = !cell.isFlagged;
        hexagon.classList.toggle('flagged');
        flagsPlaced += cell.isFlagged ? 1 : -1;
        updateMineCounter();
    }

    function revealCell(row, col) {
        const cell = grid[row][col];
        if (!cell || cell.isRevealed || cell.isFlagged) return;

        cell.isRevealed = true;
        revealedCells++;
        const hexagon = document.querySelector(`[data-row='${row}'][data-col='${col}']`);
        hexagon.classList.add('revealed');

        if (cell.adjacentMines > 0) {
            hexagon.textContent = cell.adjacentMines;
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

    function checkWinCondition() {
        if (revealedCells === ROWS * COLS - MINES_COUNT) {
            endGame(true);
        }
    }

    function updateMineCounter() {
        mineCounterDisplay.textContent = `Mines: ${MINES_COUNT - flagsPlaced}`;
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            time++;
            timerDisplay.textContent = `Time: ${time}s`;
        }, 1000);
    }

    resetButton.addEventListener('click', startGame);

    startGame();
});
