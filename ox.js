const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('status');
const restartBtn = document.getElementById('restartBtn');
const welcomeScreen = document.getElementById('welcomeScreen');
const gameContainer = document.querySelector('.game-container');

// Menu Elements
const nameEntrySection = document.getElementById('nameEntrySection');
const menuOptions = document.getElementById('menuOptions');
const lobbyStatus = document.getElementById('lobbyStatus');
const lobbyMessage = document.getElementById('lobbyMessage');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const copyContainer = document.getElementById('copyContainer');
const backBtn = document.getElementById('backBtn');
const greetingMsg = document.getElementById('greetingMsg');

// Inputs
const playerNameInput = document.getElementById('playerNameInput');
const submitNameBtn = document.getElementById('submitNameBtn');
const localBtn = document.getElementById('localBtn');
const hostBtn = document.getElementById('hostBtn');
const joinBtn = document.getElementById('joinBtn');
const copyBtn = document.getElementById('copyBtn');
const joinInput = document.getElementById('joinInput');

const X_CLASS = 'x';
const O_CLASS = 'o';
const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

let oTurn;
let gameActive = true;
let isMultiplayer = false;
let peer = null;
let conn = null;
let mySide = null;
let myTurn = false;
let myName = "Player";

let opponentName = "Opponent";
let myRematchReq = false;
let oppRematchReq = false;

// --- Name Handlers ---
// --- Name Handlers ---
// Auto-load from Global Storage
const storedName = localStorage.getItem('srinath_game_name');
if (storedName) {
    myName = storedName;
    if (nameEntrySection) nameEntrySection.classList.add('hidden');
    if (menuOptions) {
        menuOptions.classList.remove('hidden');
        menuOptions.classList.add('show');
    }
    if (greetingMsg) greetingMsg.innerText = `Hello, ${myName}!`;
}

if (submitNameBtn) submitNameBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        myName = name;
        // Update global as fallback
        localStorage.setItem('srinath_game_name', name);

        nameEntrySection.classList.add('hidden');
        menuOptions.classList.remove('hidden');
        menuOptions.classList.add('show');
        greetingMsg.innerText = `Hello, ${myName}!`;
    } else {
        alert("Please enter a valid name.");
    }
});

function enterFullScreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen().catch(e => console.log(e));
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
}

if (localBtn) localBtn.addEventListener('click', () => { enterFullScreen(); startLocalGame(); });
if (hostBtn) hostBtn.addEventListener('click', () => { enterFullScreen(); startHosting(); });
if (joinBtn) joinBtn.addEventListener('click', () => { enterFullScreen(); joinGame(); });
if (backBtn) backBtn.addEventListener('click', resetMenu);
if (copyBtn) copyBtn.addEventListener('click', () => {
    roomIdDisplay.select();
    document.execCommand('copy');
    copyBtn.innerText = 'Copied!';
    setTimeout(() => copyBtn.innerText = 'Copy ID', 2000);
});
if (restartBtn) restartBtn.addEventListener('click', handleRestart);

/* --- Game Logic --- */

function startLocalGame() {
    isMultiplayer = false;
    hideWelcomeScreen();
    startGame();
}

function startGame() {
    oTurn = false;
    gameActive = true;
    cells.forEach(cell => {
        cell.classList.remove(X_CLASS);
        cell.classList.remove(O_CLASS);
        cell.classList.remove('active-win');
        cell.innerText = '';
        cell.removeEventListener('click', handleClick);
        cell.addEventListener('click', handleClick);
    });
    setBoardHoverClass();
    updateStatusMessage();

    if (isMultiplayer) {
        restartBtn.style.display = 'none';
        if (mySide === 'x') {
            statusText.innerText = "Your Turn (X)";
            restartBtn.style.display = 'inline-block';
        } else {
            statusText.innerText = `${opponentName}'s Turn (O)`;
        }
    } else {
        restartBtn.style.display = 'inline-block';
    }
}

function handleClick(e) {
    if (!gameActive) return;

    if (isMultiplayer && !myTurn) return;

    const cell = e.target;
    if (cell.classList.contains(X_CLASS) || cell.classList.contains(O_CLASS)) return;

    const currentClass = oTurn ? O_CLASS : X_CLASS;

    placeMark(cell, currentClass);

    if (isMultiplayer) {
        const index = [...cells].indexOf(cell);
        if (conn && conn.open) {
            conn.send({ type: 'move', index: index, class: currentClass });
        }
        myTurn = false;
        updateStatusMessage();
    }

    checkGameEnd(currentClass);
}

function handleRemoteMove(index, remoteClass) {
    const cell = cells[index];
    placeMark(cell, remoteClass);
    checkGameEnd(remoteClass);
    if (gameActive) {
        myTurn = true;
        updateStatusMessage();
    }
}

function checkGameEnd(currentClass) {
    if (checkWin(currentClass)) {
        endGame(false);
    } else if (isDraw()) {
        endGame(true);
    } else {
        swapTurns();
        setBoardHoverClass();
        if (!isMultiplayer) updateStatusMessage();
    }
}

function placeMark(cell, currentClass) {
    cell.classList.add(currentClass);
    cell.innerText = currentClass.toUpperCase();
}

function swapTurns() {
    oTurn = !oTurn;
}

function setBoardHoverClass() {
    board.classList.remove(X_CLASS);
    board.classList.remove(O_CLASS);
    if (oTurn) {
        board.classList.add(O_CLASS);
    } else {
        board.classList.add(X_CLASS);
    }
}

function checkWin(currentClass) {
    return WINNING_COMBINATIONS.some(combination => {
        return combination.every(index => {
            return cells[index].classList.contains(currentClass);
        });
    });
}

function isDraw() {
    return [...cells].every(cell => {
        return cell.classList.contains(X_CLASS) || cell.classList.contains(O_CLASS);
    });
}

function endGame(draw) {
    gameActive = false;
    if (draw) {
        statusText.innerText = "It's a Draw!";
        statusText.style.color = '#94a3b8';
    } else {
        let winnerName = "";
        if (isMultiplayer) {
            winnerName = (oTurn && mySide === 'o') || (!oTurn && mySide === 'x') ? myName : opponentName;
            // Simplified logic: whoever's turn it was WON.
            const winnerSymbol = oTurn ? "O" : "X";
            const amIWinner = (winnerSymbol === mySide.toUpperCase());
            winnerName = amIWinner ? "You" : opponentName;
        } else {
            winnerName = oTurn ? "O" : "X";
        }

        statusText.innerText = `${winnerName} Win${winnerName === 'You' ? '' : 's'}!`;
        statusText.style.color = oTurn ? '#f472b6' : '#818cf8';
        highlightWinningCells(oTurn ? O_CLASS : X_CLASS);
    }

    // Reset Rematch State
    myRematchReq = false;
    oppRematchReq = false;

    if (isMultiplayer) {
        restartBtn.innerText = "Request Rematch";
        if (mySide !== 'x') restartBtn.style.display = 'inline-block'; // Show for both now
    } else {
        restartBtn.innerText = "New Game";
    }
}

function updateStatusMessage() {
    if (isMultiplayer) {
        if (myTurn) {
            statusText.innerText = `Your Turn (${mySide.toUpperCase()})`;
            statusText.style.color = mySide === 'x' ? '#818cf8' : '#f472b6';
        } else {
            statusText.innerText = `${opponentName}'s Turn`;
            statusText.style.color = '#94a3b8';
        }
    } else {
        statusText.innerText = `Player ${oTurn ? "O" : "X"}'s Turn`;
        statusText.style.color = '#94a3b8';
    }
}

function highlightWinningCells(currentClass) {
    WINNING_COMBINATIONS.forEach(combination => {
        const isWinningCombo = combination.every(index => {
            return cells[index].classList.contains(currentClass);
        });
        if (isWinningCombo) {
            combination.forEach(index => cells[index].classList.add('active-win'));
        }
    });
}

function handleRestart() {
    if (isMultiplayer) {
        if (!myRematchReq) {
            // I am requesting
            myRematchReq = true;
            restartBtn.innerText = "Waiting for Opponent...";
            restartBtn.disabled = true;
            restartBtn.style.background = '#64748b'; // Grey out

            if (conn && conn.open) conn.send({ type: 'rematch_request' });

            // Check if opponent already requested
            if (oppRematchReq) {
                // Both agreed!
                startMultiplayerNewGame();
            }
        }
    } else {
        startGame();
    }
}

function startMultiplayerNewGame() {
    // Reset UI
    restartBtn.disabled = false;
    restartBtn.removeAttribute('style');
    restartBtn.style.display = 'none'; // Hide by default until turn logic

    // Sync start
    startGame();
    // Send start signal just in case, though usually handled by logic if I'm the one triggering
    if (conn && conn.open) conn.send({ type: 'rematch_confirm' });
}

// --- Log Visitor to LocalStorage ---
function logVisitor(name) {
    let log = JSON.parse(localStorage.getItem('visitorLog') || '[]');
    const date = new Date().toLocaleString();
    log.push({ name: name, date: date });
    localStorage.setItem('visitorLog', JSON.stringify(log));
}

/* --- PeerJS Logic --- */

/* --- PeerJS Logic --- */
const APP_PREFIX = "srinath-ox-";

function initPeer(customId = null) {
    try {
        if (peer) peer.destroy();
        // If Host, use custom ID. Clients use auto-ID.
        if (customId) {
            peer = new Peer(APP_PREFIX + customId, { debug: 2 });
        } else {
            peer = new Peer(null, { debug: 2 });
        }
    } catch (e) {
        alert("PeerJS error: " + e);
        return;
    }

    // Safety Timeout
    const initTimeout = setTimeout(() => {
        if (lobbyMessage.innerText.includes("Generating")) {
            alert("Connection to matchmaking server timed out. Please check your internet or retry.");
            resetMenu();
        }
    }, 15000);

    peer.on('error', (err) => {
        clearTimeout(initTimeout);
        if (err.type === 'unavailable-id') {
            alert("Room Code taken. Retrying...");
            startHosting(); // Retry
        } else {
            console.error(err);
            lobbyMessage.innerText = "Error: " + err.type;
            alert("Network Error: " + err.type);
            resetMenu();
        }
    });

    peer.on('open', (id) => {
        clearTimeout(initTimeout);
        // If we provided a customId (I am host), 'id' will be prefix+customId

        if (menuOptions.classList.contains('hidden')) { // Ensure we are still in host mode
            // We want to display ONLY the digital code, stripping the prefix
            let displayId = id;
            if (id.startsWith(APP_PREFIX)) {
                displayId = id.replace(APP_PREFIX, '');
            }

            roomIdDisplay.value = displayId;
            lobbyMessage.innerText = `Waiting for player...`;
            copyContainer.classList.remove('hidden');
        }
    });

    peer.on('connection', (connection) => {
        handleConnection(connection, true);
    });
}

function startHosting() {
    menuOptions.classList.remove('show');
    menuOptions.classList.add('hidden');
    lobbyStatus.classList.remove('hidden');
    lobbyMessage.innerText = "Generating Room ID...";

    // Generate 4-digit Code
    const code = Math.floor(1000 + Math.random() * 9000);
    initPeer(code);

    mySide = 'x';
    myTurn = true;
}

function joinGame() {
    const destCode = joinInput.value.trim();
    if (!destCode) return alert("Please enter a Game ID");

    menuOptions.classList.remove('show');
    menuOptions.classList.add('hidden');
    lobbyStatus.classList.remove('hidden');
    lobbyMessage.innerText = "Connecting...";

    try { peer = new Peer(); } catch (e) { alert("PeerJS error: " + e); resetMenu(); return; }

    peer.on('open', () => {
        // Connect to PREFIX + Code
        conn = peer.connect(APP_PREFIX + destCode, {
            metadata: { name: myName }
        });
        handleConnection(conn, false);
    });

    peer.on('error', (err) => {
        alert("Connect Error: " + err.type);
        resetMenu();
    });

    mySide = 'o';
    myTurn = false;
}

function handleConnection(connection, isHost) {
    conn = connection;

    conn.on('open', () => {
        // If I am host, I need to send my name back to joiner
        // Joiner sent name in metadata (only available if we access it, but PeerJS metadata is primarily for initial connection)
        // Better: exchange names via data channel immediately
        conn.send({ type: 'name', name: myName });
    });

    conn.on('data', (data) => {
        if (data.type === 'name') {
            opponentName = data.name || "Opponent";
            logVisitor(opponentName); // Log the opponent!

            // If I am host, I haven't sent my name yet in this flow?
            // Actually, let's both send names on open.

            console.log("Connected to " + opponentName);
            isMultiplayer = true;
            hideWelcomeScreen();
            startGame();

        } else if (data.type === 'move') {
            handleRemoteMove(data.index, data.class);
        } else if (data.type === 'rematch_request') {
            oppRematchReq = true;
            if (myRematchReq) {
                // We both accept
                startMultiplayerNewGame();
            } else {
                statusText.innerText = `${opponentName} wants a rematch!`;
                statusText.style.color = '#bef264';
                restartBtn.innerText = "Accept Rematch";
                restartBtn.style.display = 'inline-block';
            }

        } else if (data.type === 'rematch_confirm') {
            startMultiplayerNewGame();
        }
    });

    conn.on('close', () => {
        alert(`${opponentName} disconnected`);
        location.reload();
    });
}

function hideWelcomeScreen() {
    welcomeScreen.classList.add('fade-out');
    gameContainer.classList.remove('hidden');
    gameContainer.classList.add('show');
}

function resetMenu() {
    if (peer) peer.destroy();

    // reset visibility
    nameEntrySection.classList.add('hidden'); // Actually keep name if set?
    // Let's assume name is set, just show menu options
    menuOptions.classList.remove('hidden');
    menuOptions.classList.add('show');

    lobbyStatus.classList.add('hidden');
    copyContainer.classList.add('hidden');
    welcomeScreen.classList.remove('fade-out');
}
