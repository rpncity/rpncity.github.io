// grid.js

function resizeCanvas() {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const banner = document.getElementById('banner');
    const bannerHeight = banner.offsetHeight;

    const canvasHeight = height - bannerHeight;

    canvas.width = width * pixelRatio;
    canvas.height = canvasHeight * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.scale(pixelRatio, pixelRatio);

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

function updateGridPositions() {
    const centerX = canvas.width / (2 * window.devicePixelRatio);
    const centerY = (canvas.height / (2 * window.devicePixelRatio)) + (hexHeight * 0.5);

    const gridWidth = (GRID_SIZE - 4) * hexWidth * 3 / 4;
    const gridHeight = (GRID_SIZE - 1.8) * hexHeight / 2;

    const offsetX = centerX - gridWidth / 2;
    const offsetY = centerY - gridHeight / 2;

    for (let hex of grid) {
        hex.x = offsetX + hexWidth * 3 / 4 * hex.q;
        hex.y = offsetY + hexHeight * (hex.r + hex.q / 2);
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

function handleInteraction(clientX, clientY) {
    if (animationInProgress || (dailyGameCompleted && !isUnlimitedMode)) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Scale the touch coordinates to match the canvas coordinate system
    const x = (clientX - rect.left) * (canvas.width / rect.width) / pixelRatio;
    const y = (clientY - rect.top) * (canvas.height / rect.height) / pixelRatio;

    const clickedHex = grid.find(hex => {
        const dx = x - hex.x;
        const dy = y - hex.y;
        // Use the actual hexRadius for precise detection
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

// Function to reinitialize canvas event listeners
function initializeCanvasEvents() {
    canvas.removeEventListener('click', handleInteraction);
    canvas.removeEventListener('touchstart', handleInteraction);
    canvas.removeEventListener('touchmove', preventDefaultScroll);

    canvas.addEventListener('click', (event) => {
        event.preventDefault();
        handleInteraction(event.clientX, event.clientY);
    }, { passive: false });

    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();
        const touch = event.touches[0];
        handleInteraction(touch.clientX, touch.clientY);
    }, { passive: false });

    canvas.addEventListener('touchmove', preventDefaultScroll, { passive: false });
}

function preventDefaultScroll(event) {
    event.preventDefault();
}

// Initial setup
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
initializeCanvasEvents();
