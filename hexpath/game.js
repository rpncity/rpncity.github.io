// game.js

// Constants
const GRID_SIZE = 5;
const INITIAL_VALUE = 3;

// Game state
let canvas, ctx;
let hexRadius, hexHeight, hexWidth;
let currentValue, goalValue;
let currentPosition, goalPosition;
let grid = [];
let visitedHexagons = new Set();
let animationInProgress = false;
let isUnlimitedMode = true;
let dailyGamePlayed = false;
let dailyGameCompleted = false;
let dailySeed = null;
let streak = 0;
let lastTouchTime = 0;
let touchTimeout;

function initializeGame() {
    canvas = document.getElementById('hexGrid');
    ctx = canvas.getContext('2d');

    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleClick, { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    document.getElementById('playAgainButton').addEventListener('click', handlePlayAgain);
    document.getElementById('closeDailyModalButton').addEventListener('click', hideDailyModal);
    document.getElementById('toggleModeButton').addEventListener('click', toggleMode);
    document.getElementById('howToPlayButton').addEventListener('click', showInstructions);
    document.getElementById('closeInstructionsButton').addEventListener('click', hideInstructions);
    document.getElementById('modeToggleButton').addEventListener('click', toggleGameMode);

    optimizeForMobile();
    loadStreak();
    startGame();
}

function initializeGrid() {
    grid = [];
    for (let q = -GRID_SIZE + 1; q < GRID_SIZE; q++) {
        for (let r = -GRID_SIZE + 1; r < GRID_SIZE; r++) {
            if (Math.abs(q + r) < GRID_SIZE) {
                const values = Array(6).fill(0);
                grid.push({ q, r, x: 0, y: 0, values });
            }
        }
    }

    updateGridPositions();

    currentPosition = grid.find(hex => hex.q === 0 && hex.r === GRID_SIZE - 1);
    goalPosition = grid.find(hex => hex.q === 0 && hex.r === -GRID_SIZE + 1);

    let seed = isUnlimitedMode ? Math.random() * 1000000 : getDailySeed();
    let randomFunc = () => seededRandom(seed++);

    const path = generateSolvablePath(randomFunc);

    for (let hex of grid) {
        if (!path.includes(hex) && hex !== goalPosition) {
            hex.values = hex.values.map(() => Math.floor(randomFunc() * 7) - 3);
        }
    }

    visitedHexagons.clear();
    visitedHexagons.add(`${currentPosition.q},${currentPosition.r}`);
    document.getElementById('goalValue').textContent = goalValue;
}

function generateSolvablePath(randomFunc) {
    const path = [currentPosition];
    let currentHex = currentPosition;
    let pathSum = 0;

    goalValue = Math.floor(randomFunc() * 20) + 1;
    document.getElementById('goalValue').textContent = goalValue;

    while (currentHex !== goalPosition) {
        const neighbors = getAdjacentHexagons(currentHex);
        const nextHex = neighbors[Math.floor(randomFunc() * neighbors.length)];

        if (!nextHex) break;

        const remainingSteps = Math.abs(goalPosition.q - nextHex.q) + Math.abs(goalPosition.r - nextHex.r);
        const targetSum = goalValue * (path.length / (path.length + remainingSteps));

        const idealValue = targetSum - pathSum;
        const minValue = Math.max(Math.floor(idealValue - 1), -3);
        const maxValue = Math.min(Math.ceil(idealValue + 1), 3);
        const value = Math.floor(randomFunc() * (maxValue - minValue + 1)) + minValue;

        const direction = getDirection(currentHex, nextHex);
        nextHex.values[(direction + 3) % 6] = value;

        pathSum += value;
        path.push(nextHex);
        currentHex = nextHex;
    }

    if (path.length > 1) {
        const lastHex = path[path.length - 2];
        const direction = getDirection(lastHex, goalPosition);
        lastHex.values[direction] += goalValue - pathSum;
        lastHex.values[direction] = Math.max(-3, Math.min(3, lastHex.values[direction]));
    }

    return path;
}

function getDirection(from, to) {
    const dx = to.q - from.q;
    const dy = to.r - from.r;
    if (dx === 1 && dy === 0) return 0;
    if (dx === 0 && dy === 1) return 1;
    if (dx === -1 && dy === 1) return 2;
    if (dx === -1 && dy === 0) return 3;
    if (dx === 0 && dy === -1) return 4;
    if (dx === 1 && dy === -1) return 5;
    return -1;
}

function getAdjacentHexagons(hex) {
    const directions = [
        { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
        { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }
    ];
    return directions
        .map(dir => grid.find(h => h.q === hex.q + dir.q && h.r === hex.r + dir.r))
        .filter(h => h && !visitedHexagons.has(`${h.q},${h.r}`));
}

function handleClick(event) {
    event.preventDefault();

    if (animationInProgress || (dailyGameCompleted && !isUnlimitedMode)) return;

    let x, y;
    if (event.type === 'touchstart') {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTouchTime;
        clearTimeout(touchTimeout);

        if (tapLength < 500 && tapLength > 0) {
            event.preventDefault();
            return false;
        }

        lastTouchTime = currentTime;

        touchTimeout = setTimeout(() => {
            const touch = event.touches[0];
            handleInteraction(touch.clientX, touch.clientY);
        }, 100);
    } else {
        handleInteraction(event.clientX, event.clientY);
    }
}

function handleInteraction(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const clickedHex = grid.find(hex => {
        const dx = x - hex.x;
        const dy = y - hex.y;
        return (dx * dx + dy * dy) <= (hexRadius * hexRadius);
    });

    if (clickedHex) {
        const isAdjacent = getAdjacentHexagons(currentPosition).includes(clickedHex);
        const isGoal = clickedHex === goalPosition;

        if (isAdjacent || isGoal) {
            animationInProgress = true;
            animateMove(currentPosition, clickedHex, () => {
                processMove(clickedHex);
            });
        }
    }
}

function processMove(clickedHex) {
    if (clickedHex === goalPosition) {
        if (currentValue === goalValue) {
            endGame('Congratulations! You reached the goal with the correct value!');
        } else {
            endGame('Game Over! You reached the goal but with the wrong value.');
        }
    } else {
        const direction = getDirection(currentPosition, clickedHex);
        currentValue += clickedHex.values[(direction + 3) % 6];
        currentPosition = clickedHex;
        visitedHexagons.add(`${clickedHex.q},${clickedHex.r}`);

        updateUI();

        if (currentValue <= 0) {
            endGame('Game Over! Your value reached zero or below.');
        } else if (getAdjacentHexagons(currentPosition).length === 0) {
            endGame('Game Over! No more valid moves.');
        } else {
            drawGrid();
            drawPlayerCircle(currentPosition.x, currentPosition.y);
            animationInProgress = false;
            if (!isUnlimitedMode) {
                saveGameState();
            }
        }
    }
}

function animateMove(from, to, callback) {
    const duration = 300;
    const startTime = performance.now();

    function animate(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);

        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const x = from.x + (to.x - from.x) * easeProgress;
        const y = from.y + (to.y - from.y) * easeProgress;

        drawGrid();
        drawPlayerCircle(x, y);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            callback();
        }
    }

    requestAnimationFrame(animate);
}

function updateUI() {
    document.getElementById('currentValue').textContent = currentValue;
}

// Game state management
function startGame() {
    const lastPlayedDate = localStorage.getItem('dailyGameDate');
    const wasCompleted = localStorage.getItem('dailyGameCompleted');
    const today = new Date().toDateString();

    if (!isUnlimitedMode && lastPlayedDate === today) {
        if (wasCompleted === 'true') {
            dailyGameCompleted = true;
            dailyGamePlayed = true;
            loadGameState();
            showDailyModal('Daily challenge completed!');
        } else {
            dailyGameCompleted = false;
            dailyGamePlayed = true;
            loadGameState();
        }
    } else {
        resetGame();
    }

    resizeCanvas();
}

function resetGame() {
    currentValue = INITIAL_VALUE;
    visitedHexagons.clear();
    updateUI();
    hideModals();

    dailyGameCompleted = false;
    dailyGamePlayed = false;

    if (!isUnlimitedMode) {
        const today = new Date().toDateString();
        localStorage.setItem('dailyGameCompleted', 'false');
        localStorage.setItem('dailyGameDate', today);
        dailySeed = null;
    }

    initializeGrid();
}

function endGame(message) {
    animationInProgress = false;
    drawGrid();
    drawPlayerCircle(currentPosition.x, currentPosition.y);

    if (isUnlimitedMode) {
        showUnlimitedModal(message);
    } else {
        dailyGameCompleted = true;
        dailyGamePlayed = true;
        localStorage.setItem('dailyGameCompleted', 'true');
        localStorage.setItem('dailyGameDate', new Date().toDateString());

        if (message.includes('Congratulations')) {
            streak++;
            localStorage.setItem('streak', streak);
        } else {
            streak = 0;
            localStorage.setItem('streak', 0);
        }

        showDailyModal(message);
    }
}

// Local storage functions
function saveGameState() {
    const gameState = {
        currentValue,
        currentPosition: { q: currentPosition.q, r: currentPosition.r },
        visitedHexagons: Array.from(visitedHexagons),
        grid: grid.map(hex => ({
            q: hex.q,
            r: hex.r,
            values: hex.values
        })),
        goalValue
    };
    localStorage.setItem('dailyGameState', JSON.stringify(gameState));
    localStorage.setItem('dailyGameDate', new Date().toDateString());
}

function loadGameState() {
    const savedState = localStorage.getItem('dailyGameState');
    const savedDate = localStorage.getItem('dailyGameDate');

    if (savedState && savedDate === new Date().toDateString()) {
        const gameState = JSON.parse(savedState);
        currentValue = gameState.currentValue;
        currentPosition = grid.find(hex => hex.q === gameState.currentPosition.q && hex.r === gameState.currentPosition.r);
        visitedHexagons = new Set(gameState.visitedHexagons);
        goalValue = gameState.goalValue;

        gameState.grid.forEach(savedHex => {
            const hex = grid.find(h => h.q === savedHex.q && h.r === savedHex.r);
            if (hex) {
                hex.values = savedHex.values;
            }
        });

        updateUI();
        drawGrid();
        drawPlayerCircle(currentPosition.x, currentPosition.y);
        return true;
    }
    return false;
}

function loadStreak() {
    streak = parseInt(localStorage.getItem('streak') || '0');
}

// Utility functions
function getDailySeed() {
    if (dailySeed === null) {
        const now = new Date();
        dailySeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    }
    return dailySeed;
}

function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// UI functions
function showUnlimitedModal(message) {
    document.getElementById('unlimitedModalMessage').textContent = message;
    document.getElementById('unlimitedModalOverlay').style.display = 'flex';
}

function showDailyModal(message) {
    document.getElementById('dailyModalMessage').textContent = message;
    document.getElementById('streakCount').textContent = `Current streak: ${streak}`;
    document.getElementById('dailyModalOverlay').style.display = 'flex';
    updateTimer();
    setInterval(updateTimer, 1000);
}

function hideDailyModal() {
    document.getElementById('dailyModalOverlay').style.display = 'none';
}

function hideModals() {
    document.getElementById('unlimitedModalOverlay').style.display = 'none';
    document.getElementById('dailyModalOverlay').style.display = 'none';
}

function updateTimer() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeLeft = tomorrow - now;

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    document.getElementById('timerDisplay').textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function toggleMode() {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
    document.getElementById('toggleModeButton').textContent = document.body.classList.contains('dark-mode') ? '🌞' : '🌒';
    drawGrid();
    drawPlayerCircle(currentPosition.x, currentPosition.y);
}

function showInstructions() {
    document.getElementById('instructionsOverlay').classList.add('show');
}

function hideInstructions() {
    document.getElementById('instructionsOverlay').classList.remove('show');
}

function toggleGameMode() {
    isUnlimitedMode = !isUnlimitedMode;
    document.getElementById('modeToggleButton').textContent = isUnlimitedMode ? '♾️' : '📅';
    startGame();
}

// Event handlers
function handlePlayAgain() {
    if (isUnlimitedMode) {
        startGame();
    }
}

function optimizeForMobile() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        animateMove = (from, to, callback) => {
            const duration = 150;
            const startTime = performance.now();

            function animate(currentTime) {
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);

                const easeProgress = 1 - Math.pow(1 - progress, 3);

                const x = from.x + (to.x - from.x) * easeProgress;
                const y = from.y + (to.y - from.y) * easeProgress;

                drawGrid();
                drawPlayerCircle(x, y);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    callback();
                }
            }

            requestAnimationFrame(animate);
        };
    }
}

// Initialize the game
initializeGame();
