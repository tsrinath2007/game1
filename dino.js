const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const roomControls = document.getElementById('roomControls');
const mainMenuBtns = document.getElementById('mainMenuBtns');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const playerListDiv = document.getElementById('playerList');
const leaderboardDiv = document.getElementById('leaderboard');
const startBtn = document.getElementById('startBtn');
const waitingMsg = document.getElementById('waitingMsg');
const finalScoreDisp = document.getElementById('finalScore');
const winnerDisp = document.getElementById('winnerDisplay');
const dinoColorInput = document.getElementById('dinoColor');

// User Data
let myName = localStorage.getItem('srinath_game_name') || "Player";
let myColor = dinoColorInput.value;
let myId = null; // Peer ID

// Game State
let gameActive = false;
let score = 0;
let gameSpeed = 5;
let gravity = 0.6;
let obstacles = [];
let frame = 0;
let animationId;

// Multiplayer State
let peer = null;
let isHost = false;
let connections = []; // For Host: list of data connections
let hostConn = null;  // For Client: connection to host
let players = {};     // { peerId: { name, color, score, alive } }

// Dino Object
const dino = {
    x: 50,
    y: 300,
    w: 40,
    h: 40,
    dy: 0,
    jumpForce: 12,
    originalY: 300,
    grounded: true,
    color: myColor
};

/* --- Event Listeners --- */

dinoColorInput.addEventListener('change', (e) => {
    myColor = e.target.value;
    dino.color = myColor;
    // Save preference?
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') jump();
});
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
});

document.getElementById('hostBtn').addEventListener('click', initHost);
document.getElementById('joinBtn').addEventListener('click', joinGame);
startBtn.addEventListener('click', () => {
    if (isHost) {
        broadcast({ type: 'start' });
        startGame();
    }
});
document.getElementById('spectateBtn').addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    // Restart loop to show "Lobby/Idle" state while waiting
    // This allows the user to see the leaderboard updating live
    if (!gameActive) update();
});
document.getElementById('backToLobbyBtn').addEventListener('click', () => location.reload());

roomIdDisplay.addEventListener('click', () => {
    roomIdDisplay.select();
    document.execCommand('copy');
    alert("Copied!");
});

/* --- Game Engine --- */

function jump() {
    if (!gameActive) return;
    if (dino.grounded) {
        dino.dy = -dino.jumpForce;
        dino.grounded = false;
    }
}

function spawnObstacle() {
    // Determine type based on score to increase difficulty
    // Start with plants. Crows appear later.
    const spawnCrow = score > 300 && Math.random() > 0.7; // 30% chance of crow if score > 300

    // Size & Type
    const size = 30 + Math.random() * 20; // 30-50px
    let type = spawnCrow ? 'crow' : 'plant';

    let yPos;
    let color;

    if (type === 'plant') {
        yPos = 300 + (40 - size); // Ground aligned (dino h is 40)
        color = '#22c55e'; // Green
    } else {
        // Crow: Can be high or low
        // Low: y=290 (duckable/jumpable), High: y=250 (walkable under)
        // Let's stick to jumpable for now or slightly elevated
        const heightVariant = Math.random();
        if (heightVariant > 0.5) yPos = 260; // High (jump?)
        else yPos = 290; // Low

        color = '#94a3b8'; // Grey bird
    }

    obstacles.push({
        x: canvas.width,
        y: yPos,
        w: size,
        h: size, // Crow might be wider than tall
        color: color,
        type: type,
        frameOffset: Math.random() * 10
    });
}

// --- Draw Functions ---

function drawDino(x, y, w, h, color) {
    ctx.fillStyle = color;
    // Simple Dino Shape (Head, Body, Legs)
    // Body
    ctx.fillRect(x, y + h / 2, w, h / 2 - 5);
    // Head
    ctx.fillRect(x + w / 2, y, w / 2, h / 2);
    // Tail
    ctx.fillRect(x - 5, y + h / 2 + 5, 5, 10);
    // Legs
    if (Math.floor(frame / 10) % 2 === 0 || !dino.grounded) {
        ctx.fillRect(x + 5, y + h - 5, 5, 5); // Left
        ctx.fillRect(x + w - 10, y + h - 5, 5, 5); // Right
    } else {
        ctx.fillRect(x + 5, y + h - 10, 5, 5); // Left UP
        ctx.fillRect(x + w - 10, y + h - 10, 5, 5); // Right UP
    }

    // Eye
    ctx.fillStyle = 'white';
    ctx.fillRect(x + w - 10, y + 5, 5, 5);
}

function drawPlant(obs) {
    ctx.fillStyle = obs.color;
    // Cactus shape: Main trunk + arms
    const w = obs.w;
    const h = obs.h;
    const x = obs.x;
    const y = obs.y;

    // Trunk
    ctx.fillRect(x + w / 3, y, w / 3, h);
    // Left Arm
    ctx.fillRect(x, y + h / 3, w / 3, h / 4);
    ctx.fillRect(x, y + h / 3 - 10, w / 6, h / 4); // upward tip
    // Right Arm
    ctx.fillRect(x + 2 * w / 3, y + h / 4, w / 3, h / 4);
    ctx.fillRect(x + w - w / 6, y + h / 4 - 10, w / 6, h / 4); // upward tip
}

function drawCrow(obs) {
    ctx.fillStyle = obs.color;
    const x = obs.x;
    const y = obs.y;
    const w = obs.w;
    const h = obs.h;

    // Flapping Wing
    const flap = Math.floor((frame + obs.frameOffset) / 10) % 2 === 0;

    // Body
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(x + 10, y + h / 2 - 5, 8, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2 - 5);
    ctx.lineTo(x - 10, y + h / 2);
    ctx.lineTo(x, y + h / 2 + 5);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#475569';
    if (flap) {
        // Wing Up
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h / 2);
        ctx.lineTo(x + w / 2 + 20, y - 10);
        ctx.lineTo(x + w / 2 - 10, y + h / 2);
        ctx.fill();
    } else {
        // Wing Down
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h / 2);
        ctx.lineTo(x + w / 2 + 20, y + h + 5);
        ctx.lineTo(x + w / 2 - 10, y + h / 2);
        ctx.fill();
    }
}

function update() {
    frame++;
    animationId = requestAnimationFrame(update);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Ground
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 340, canvas.width, 2);

    if (gameActive) {
        // Physics
        dino.dy += gravity;
        dino.y += dino.dy;

        if (dino.y > dino.originalY) {
            dino.y = dino.originalY;
            dino.dy = 0;
            dino.grounded = true;
        }

        // Obstacles spawning
        if (frame % 100 === 0) {
            spawnObstacle();
            gameSpeed += 0.05;
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            obs.x -= gameSpeed;

            // Draw based on type
            if (obs.type === 'crow') drawCrow(obs);
            else drawPlant(obs);

            // Collision - Hitbox adjustments
            // Shrink hitbox slightly for fairness
            const hitboxPadding = 5;
            if (
                dino.x + hitboxPadding < obs.x + obs.w - hitboxPadding &&
                dino.x + dino.w - hitboxPadding > obs.x + hitboxPadding &&
                dino.y + hitboxPadding < obs.y + obs.h - hitboxPadding &&
                dino.y + dino.h - hitboxPadding > obs.y + hitboxPadding
            ) {
                handleDeath();
            }

            if (obs.x + obs.w < 0) {
                obstacles.splice(i, 1);
                score += 10;
            }
        }

        // Score & Sync
        score++;
        if (frame % 10 === 0) sendUpdate();
        drawHUD();

    } else {
        // Lobby Preview: Idle Dino + Ground
        if (dino.y > dino.originalY) dino.y = dino.originalY;
        // Draw a fake plant just for vibes? Nah, keep it clean.
    }

    // Always draw Dino
    drawDino(dino.x, dino.y, dino.w, dino.h, dino.color);
}


function handleDeath() {
    gameActive = false;
    cancelAnimationFrame(animationId);

    // Final Update
    if (peer) sendUpdate(false); // alive = false

    gameOverScreen.classList.remove('hidden');
    finalScoreDisp.innerText = "Score: " + score;
    document.getElementById('statusMsg').innerText = "You Died!";
}

function sendUpdate(alive = true) {
    const payload = {
        type: 'update',
        id: myId,
        score: score,
        alive: alive
    };

    if (isHost) {
        // Update my own record in players
        if (players[myId]) {
            players[myId].score = score;
            players[myId].alive = alive;
        }
        broadcast(payload); // Actually echo to everyone? No, send FULL leaderboard to everyone
        broadcastLeaderboard();
    } else if (hostConn && hostConn.open) {
        hostConn.send(payload);
    }
}

function drawHUD() {
    ctx.fillStyle = '#fff';
    ctx.font = "20px monospace";
    ctx.fillText("Score: " + score, 650, 30);
    ctx.fillText("Speed: " + Math.round(gameSpeed * 10) / 10, 650, 60);
}

function renderLeaderboard() {
    leaderboardDiv.innerHTML = '<strong>Leaderboard</strong>';

    // Sort by alive then score
    const sorted = Object.values(players).sort((a, b) => {
        if (a.alive && !b.alive) return -1;
        if (!a.alive && b.alive) return 1;
        return b.score - a.score;
    });

    sorted.forEach(p => {
        const row = document.createElement('div');
        row.className = 'lb-item';
        row.innerHTML = `
            <span style="color: ${p.color}; width: 80px; overflow:hidden;">${p.name}</span>
            <span class="${p.alive ? 'lb-alive' : 'lb-dead'}">${p.alive ? 'Run' : 'Dead'}</span>
            <span>${p.score}</span>
        `;
        leaderboardDiv.appendChild(row);
    });
}

function startGame() {
    lobbyScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden'); // Fix: Ensure Game Over is hidden too
    resetGame();
    gameActive = true;
    // update() is already running via the direct call below
}

function resetGame() {
    score = 0;
    obstacles = [];
    gameSpeed = 5;
    frame = 0;
    dino.y = 300;
    dino.dy = 0;
    dino.grounded = true;

    // Reset players alive state
    Object.keys(players).forEach(k => {
        players[k].score = 0;
        players[k].alive = true;
    });
    renderLeaderboard();
}

/* --- Multiplayer Logic --- */

/* --- Multiplayer Logic --- */
const APP_PREFIX = "srinath-dino-";

function initPeer(customId = null) {
    try {
        if (peer) peer.destroy();
        // If Host, use custom ID. If Client (joining), auto-id is fine for their own peer, 
        // they just need to CONNECT to the host's ID.
        if (customId) {
            peer = new Peer(APP_PREFIX + customId, { debug: 1 });
        } else {
            peer = new Peer(null, { debug: 1 }); // Client gets auto ID
        }
    } catch (e) { alert(e); }

    peer.on('error', err => {
        if (err.type === 'unavailable-id') {
            alert("Room Code taken. Retrying...");
            initHost(); // Retry generation
        } else {
            alert("Network Error: " + err.type);
        }
    });

    return new Promise(resolve => {
        peer.on('open', id => {
            myId = id;
            resolve(id);
        });
    });
}

async function initHost() {
    mainMenuBtns.classList.add('hidden');
    roomControls.classList.remove('hidden');
    waitingMsg.classList.add('hidden');
    startBtn.classList.remove('hidden');

    // Generate 4-digit code
    const roomCode = Math.floor(1000 + Math.random() * 9000);

    await initPeer(roomCode);
    isHost = true;

    // Show ONLY the code, not the full ID
    roomIdDisplay.value = roomCode;

    // Add myself
    players[myId] = { name: myName, color: myColor, score: 0, alive: true };
    updatePlayerList();
    renderLeaderboard();

    peer.on('connection', conn => {
        connections.push(conn);
        conn.on('data', data => handleHostData(data, conn.peer));
        conn.on('open', () => { });
        conn.on('close', () => {
            delete players[conn.peer];
            updatePlayerList();
            broadcastLeaderboard();
        });
    });
}

async function joinGame() {
    const code = document.getElementById('joinInput').value.trim();
    if (!code) return alert("Enter Room Code");

    mainMenuBtns.classList.add('hidden');
    roomControls.classList.remove('hidden');
    startBtn.classList.add('hidden');
    waitingMsg.classList.remove('hidden');
    waitingMsg.innerText = "Connecting to Room " + code + "...";

    await initPeer(); // Client gets random ID

    // Connect to PREFIX + Code
    hostConn = peer.connect(APP_PREFIX + code);

    hostConn.on('open', () => {
        waitingMsg.innerText = "Waiting for Request...";
        hostConn.send({
            type: 'join',
            name: myName,
            color: myColor,
            id: myId
        });
    });

    hostConn.on('data', handleClientData);

    hostConn.on('close', () => {
        alert("Host disconnected");
        location.reload();
    });
}

/* --- Host Handling --- */
function handleHostData(data, peerId) {
    if (data.type === 'join') {
        players[data.id] = { name: data.name, color: data.color, score: 0, alive: true };
        updatePlayerList();
        broadcastLeaderboard(); // detailed update
    } else if (data.type === 'update') {
        if (players[data.id]) {
            players[data.id].score = data.score;
            players[data.id].alive = data.alive;
        }
        broadcastLeaderboard(); // Sync everyone
    }
}

function broadcast(data) {
    connections.forEach(c => {
        if (c.open) c.send(data);
    });
}

function broadcastLeaderboard() {
    // Send the full players object to everyone so they have state
    broadcast({
        type: 'leaderboard',
        players: players
    });
    // Also update host UI
    renderLeaderboard();
}

function updatePlayerList() {
    playerListDiv.innerHTML = '';
    Object.values(players).forEach(p => {
        const d = document.createElement('div');
        d.innerHTML = `<span style="color:${p.color}">●</span> ${p.name}`;
        playerListDiv.appendChild(d);
    });
}

/* --- Client Handling --- */
function handleClientData(data) {
    if (data.type === 'leaderboard') {
        players = data.players;
        renderLeaderboard();
        updatePlayerList(); // Also update lobby list if sticking around
        waitingMsg.innerText = "Waiting for Host to start...";
    } else if (data.type === 'start') {
        startGame();
    } else if (data.type === 'rematch_req_notification') {
        // Only host receiving this? No, maybe everyone sees who asked?
        // Let's simplified: Host sees it in the winnerDisplay or similar
        if (isHost) {
            // alert(data.name + " wants a rematch!"); // Too intrusive
            requestRematchBtn.innerText = `Rematch Requested by ${data.name}`;
            requestRematchBtn.classList.add('pulse');
        }
    }
}

// Start Render Loop Immediately
update();

/* --- Rematch Logic --- */
const requestRematchBtn = document.createElement('button');
requestRematchBtn.className = 'base-btn primary-btn';
requestRematchBtn.innerText = 'Request Rematch';
requestRematchBtn.style.marginTop = '1rem';
// Add to Game Over Screen
document.getElementById('gameOverScreen').appendChild(requestRematchBtn);

requestRematchBtn.addEventListener('click', () => {
    if (isHost) {
        // Host triggers restart
        broadcast({ type: 'start' });
        startGame();
    } else {
        // Client requests
        requestRematchBtn.innerText = "Request Sent...";
        requestRematchBtn.disabled = true;
        if (hostConn && hostConn.open) {
            hostConn.send({ type: 'rematch_req', name: myName });
        }
    }
});

// Update Host Logic to handle rematch_req
const originalHandleHostData = handleHostData;
handleHostData = function (data, peerId) {
    originalHandleHostData(data, peerId);
    if (data.type === 'rematch_req') {
        const pName = data.name;
        // Notify Host UI
        // We can reuse the button text
        requestRematchBtn.innerText = `Rematch requested by ${pName} (Click to Start)`;
        requestRematchBtn.style.background = '#e11d48'; // Pulse color?
    }
};

// Hook into Game Over to reset button state
const originalHandleDeath = handleDeath;
handleDeath = function () {
    originalHandleDeath();
    // Reset button
    if (isHost) {
        requestRematchBtn.innerText = "Play Again (Host)";
        requestRematchBtn.disabled = false;
        requestRematchBtn.style.display = 'inline-block';
        requestRematchBtn.style.background = ''; // reset
    } else {
        requestRematchBtn.innerText = "Request Rematch";
        requestRematchBtn.disabled = false;
        requestRematchBtn.style.display = 'inline-block';
    }
};

// Hide button during play
const originalStartGame = startGame;
startGame = function () {
    // Safety: Cancel any existing loop to prevent double-speed
    cancelAnimationFrame(animationId);

    // Call original logic (which calls base startGame -> resets vars)
    originalStartGame();

    // Explicitly restart the game loop since handleDeath killed it
    update();

    requestRematchBtn.style.display = 'none';
};
