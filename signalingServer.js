const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const port = 3000;

const rooms = {};  // Store peers by room
const MAX_PLAYERS_PER_ROOM = 4;  // Set maximum players per room

// Create the HTTP server
const server = http.createServer((req, res) => {
    // Serve the HTML file when the root URL is accessed
    if (req.url === '/') {
        const filePath = path.join(__dirname, 'cardz.html');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading the page');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content, 'utf-8');
            }
        });
    } else {
        res.writeHead(404);
        res.end('Page not found');
    }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        const { type, from, to, room, signal } = data;

        if (type === 'join') {
            // If the room doesn't exist, create it
            if (!rooms[room]) {
                rooms[room] = [];
            }

            // Check if the room is full
            if (rooms[room].length >= MAX_PLAYERS_PER_ROOM) {
                // Send an error message back to the client if the room is full
                ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
                console.log(`Player ${from} tried to join full room ${room}`);
                return;
            }

            // Add the player to the room
            rooms[room].push({ id: from, ws });
            console.log(`Player ${from} joined room ${room}`);

            // Notify other peers in the room about the new player
            rooms[room].forEach(peer => {
                if (peer.id !== from) {
                    peer.ws.send(JSON.stringify({ type: 'join', from, room }));
                }
            });
        } else if (type === 'signal') {
            // Relay signaling messages to the target peer in the room
            const targetPeer = rooms[room].find(peer => peer.id === to);
            if (targetPeer) {
                targetPeer.ws.send(JSON.stringify({ type: 'signal', from, to, room, signal }));
            }
        }
    });

    ws.on('close', () => {
        // Clean up disconnected peers from rooms
        for (const room in rooms) {
            rooms[room] = rooms[room].filter(peer => peer.ws !== ws);
            if (rooms[room].length === 0) {
                delete rooms[room];  // Clean up empty rooms
            }
        }
        console.log('A player disconnected');
    });
});

// Start the server on port 3000
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
