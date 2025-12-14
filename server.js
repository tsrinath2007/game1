const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store room state
const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create_room', () => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomId] = {
            players: [socket.id],
            board: Array(9).fill(null),
            turn: 'x', // 'x' goes first. The creator is always 'x'.
            gameActive: true
        };
        socket.join(roomId);
        socket.emit('room_created', roomId);
        console.log(`Room ${roomId} created by ${socket.id}`);
    });

    socket.on('join_room', (roomId) => {
        roomId = roomId.toUpperCase();
        if (rooms[roomId] && rooms[roomId].players.length < 2) {
            rooms[roomId].players.push(socket.id);
            socket.join(roomId);

            // Notify both players to start
            io.to(roomId).emit('game_start', {
                roomId: roomId,
                players: rooms[roomId].players
            });
            console.log(`User ${socket.id} joined room ${roomId}`);
        } else {
            socket.emit('error_message', 'Room not found or full.');
        }
    });

    socket.on('make_move', ({ roomId, index }) => {
        const room = rooms[roomId];
        if (!room || !room.gameActive) return;

        // Determine which player sent the move
        const playerIndex = room.players.indexOf(socket.id);
        const symbol = playerIndex === 0 ? 'x' : 'o';

        // Check if it's this player's turn
        if (symbol !== room.turn) return;

        // Check if cell is empty
        if (!room.board[index]) {
            room.board[index] = symbol;
            room.turn = room.turn === 'x' ? 'o' : 'x'; // Swap turn

            io.to(roomId).emit('update_board', {
                index,
                symbol,
                nextTurn: room.turn
            });

            checkWin(roomId, symbol);
        }
    });

    socket.on('restart_game', (roomId) => {
        if (rooms[roomId]) {
            rooms[roomId].board = Array(9).fill(null);
            rooms[roomId].turn = 'x';
            rooms[roomId].gameActive = true;
            io.to(roomId).emit('game_reset');
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
        // Clean up rooms (simplified logic)
        for (const roomId in rooms) {
            if (rooms[roomId].players.includes(socket.id)) {
                io.to(roomId).emit('player_disconnected');
                delete rooms[roomId];
            }
        }
    });
});

const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function checkWin(roomId, symbol) {
    const room = rooms[roomId];
    const board = room.board;

    let won = WINNING_COMBINATIONS.some(combination => {
        return combination.every(index => board[index] === symbol);
    });

    if (won) {
        room.gameActive = false;
        io.to(roomId).emit('game_over', { winner: symbol });
    } else if (board.every(cell => cell !== null)) {
        room.gameActive = false;
        io.to(roomId).emit('game_over', { winner: 'draw' });
    }
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
