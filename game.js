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
let isUnlimitedMode = false;
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
    initializeCanvasEvents();

    document.getElementById('playAgainButton').addEventListener('click', handlePlayAgain);
    document.getElementById('closeDailyModalButton').addEventListener('click', hideDailyModal);
    document.getElementById('toggleModeButton').addEventListener('click', toggleMode);
    document.getElementById('howToPlayButton').addEventListener('click', showInstructions);
    document.getElementById('closeInstructionsButton').addEventListener('click', hideInstructions);
    document.getElementById('modeToggleButton').addEventListener('click', toggleGameMode);

    loadStreak();
    initializeDailySeed();
    
    initializeGrid();
    
    if (!loadGameState()) {
        resetGame();
    }

    drawInitialState();
}

function initializeDailySeed() {
    const now = new Date();
    dailySeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

function startGame() {
    const today = new Date().toDateString();
    const lastPlayedDate = localStorage.getItem('dailyGameDate');
    const wasCompleted = localStorage.getItem('dailyGameCompleted') === 'true';

    if (!isUnlimitedMode && lastPlayedDate === today) {
        if (wasCompleted) {
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

    drawInitialState();
}

function resetGame() {
    currentValue = INITIAL_VALUE;
    visitedHexagons.clear();
    hideModals();

    dailyGameCompleted = false;
    dailyGamePlayed = false;

    initializeGrid();

    if (!isUnlimitedMode) {
        const today = new Date().toDateString();
        localStorage.setItem('dailyGameCompleted', 'false');
        localStorage.setItem('dailyGameDate', today);
        saveGameState();
    }

    updateUI();
    drawInitialState();
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

    let seed = isUnlimitedMode ? Math.random() * 1000000 : dailySeed;
    let randomFunc = () => seededRandom(seed++);

    const path = generateSolvablePath(randomFunc);

    for (let hex of grid) {
        if (!path.includes(hex) && hex !== goalPosition) {
            hex.values = hex.values.map(() => Math.floor(randomFunc() * 7) - 3);
        }
    }

    visitedHexagons.add(`${currentPosition.q},${currentPosition.r}`);
}

function generateSolvablePath(randomFunc) {
    const path = [currentPosition];
    let currentHex = currentPosition;
    let pathSum = 0;

    goalValue = Math.floor(randomFunc() * 20) + 1;

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
    const duration = isMobileDevice() ? 150 : 300;
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
    document.getElementById('goalValue').textContent = goalValue;
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
        return true;
    }
    return false;
}

function loadStreak() {
    streak = parseInt(localStorage.getItem('streak') || '0');
}

function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

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

function handlePlayAgain() {
    if (isUnlimitedMode) {
        startGame();
    }
}

function handleInteraction(clientX, clientY) {
    if (animationInProgress || (dailyGameCompleted && !isUnlimitedMode)) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const canvasScaling = isMobileDevice() ? 1.1 : 1;

    // Scale the touch coordinates to match the canvas coordinate system
    const x = (clientX - rect.left) * (canvas.width / rect.width) / (pixelRatio * canvasScaling);
    const y = (clientY - rect.top) * (canvas.height / rect.height) / (pixelRatio * canvasScaling);

    const clickedHex = grid.find(hex => {
        const dx = x - hex.x;
        const dy = y - hex.y;
        // Use the actual hexRadius for precise detection
        return (dx * dx + dy * dy) <= (hexRadius * hexRadius);
    });

    if (clickedHex) {
        const isAdjacent = getAdjacentHexagons(currentPosition).includes(clickedHex);
        const isGoal = clickedHex === goalPosition;

        if (isAdjacent || (isGoal && getAdjacentHexagons(currentPosition).includes(goalPosition))) {
            animationInProgress = true;
            animateMove(currentPosition, clickedHex, () => {
                processMove(clickedHex);
            });
        }
    }
}

function initializeCanvasEvents() {
    canvas.removeEventListener('click', handleClick);
    canvas.removeEventListener('touchstart', handleClick);
    canvas.removeEventListener('touchmove', preventDefaultScroll);

    canvas.addEventListener('click', handleClick, { passive: false });
    canvas.addEventListener('touchstart', handleClick, { passive: false });
    canvas.addEventListener('touchmove', preventDefaultScroll, { passive: false });
}

function preventDefaultScroll(event) {
    event.preventDefault();
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function updateGridPositions() {
    const centerX = canvas.width / (2 * window.devicePixelRatio);
    const centerY = (canvas.height / (2 * window.devicePixelRatio)) + (hexHeight * 0.5);

    const gridWidth = (GRID_SIZE - 4) * hexWidth * 3 / 4;
    const gridHeight = (GRID_SIZE - 1.95) * hexHeight / 2;

    const offsetX = centerX - gridWidth / 2;
    const offsetY = centerY - gridHeight / 2;

    for (let hex of grid) {
        hex.x = offsetX + hexWidth * 3 / 4 * hex.q;
        hex.y = offsetY + hexHeight * (hex.r + hex.q / 2);
    }
}

function resizeCanvas() {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const banner = document.getElementById('banner');
    const bannerHeight = banner.offsetHeight;

    let canvasHeight = height - bannerHeight;
    let canvasScaling = 1;
    let verticalOffset = 0;

    if (isMobileDevice()) {
        canvasScaling = 1.1; // Scale up by 10%
        verticalOffset = -50; // Move up by 50px
    }

    canvas.width = width * pixelRatio;
    canvas.height = canvasHeight * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${canvasHeight}px`;

    // Apply vertical offset for mobile
    canvas.style.marginTop = `${verticalOffset}px`;

    ctx.scale(pixelRatio * canvasScaling, pixelRatio * canvasScaling);

    // Adjust the scaling factor based on the aspect ratio and reduce by 25%
    const aspectRatio = width / canvasHeight;
    let scaleFactor;
    if (aspectRatio > 1) {
        // Landscape orientation
        scaleFactor = (canvasHeight / (GRID_SIZE * 2.5)) * 0.75;
    } else {
        // Portrait orientation
        scaleFactor = (width / (GRID_SIZE * 2.5)) * 0.75;
    }

    hexRadius = scaleFactor;
    hexHeight = hexRadius * Math.sqrt(3);
    hexWidth = hexRadius * 2;

    updateGridPositions();
    drawGrid();
    if (currentPosition) {
        drawPlayerCircle(currentPosition.x, currentPosition.y);
    }
}

function drawHexagon(x, y, values, isVisited, isGoal, isAdjacent) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const xPos = x + hexRadius * Math.cos(angle);
        const yPos = y + hexRadius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(xPos, yPos);
        } else {
            ctx.lineTo(xPos, yPos);
        }
    }
    ctx.closePath();

    if (isVisited) {
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(64, 64, 64, 0.8)' : 'rgba(192, 192, 192, 0.8)';
    } else if (isGoal) {
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(0, 128, 128, 0.8)' : 'rgba(0, 200, 200, 0.8)';
    } else if (isAdjacent) {
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(139, 69, 19, 0.8)' : 'rgba(210, 180, 140, 0.8)';
    } else {
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(139, 0, 0, 0.8)' : 'rgba(255, 100, 100, 0.8)';
    }
    ctx.fill();

    ctx.strokeStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';
    ctx.font = `${hexRadius * 0.3}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isGoal) {
        ctx.fillText("GOAL", x, y);
    } else if (!isVisited) {
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * (i + 0.5);
            const textX = x + hexRadius * Math.cos(angle) * 0.65;
            const textY = y + hexRadius * Math.sin(angle) * 0.65;
            ctx.fillText(values[i].toString(), textX, textY);
        }
    }
}

function drawPlayerCircle(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, hexRadius / 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = document.body.classList.contains('dark-mode') ? 'white' : 'black';
    ctx.fill();
    ctx.strokeStyle = document.body.classList.contains('dark-mode') ? 'black' : 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const adjacentHexagons = getAdjacentHexagons(currentPosition);
    for (const hex of grid) {
        const isVisited = visitedHexagons.has(`${hex.q},${hex.r}`);
        const isGoal = hex === goalPosition;
        const isAdjacent = adjacentHexagons.includes(hex);
        drawHexagon(hex.x, hex.y, hex.values, isVisited, isGoal, isAdjacent);
    }
}

function drawInitialState() {
    resizeCanvas();
    drawGrid();
    if (currentPosition) {
        drawPlayerCircle(currentPosition.x, currentPosition.y);
    }
    updateUI();
}

// Initialize the game
document.addEventListener('DOMContentLoaded', initializeGame);