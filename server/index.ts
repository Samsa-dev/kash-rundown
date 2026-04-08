import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GameRoom } from './ws/GameRoom';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
app.use(express.json());

// CORS for production
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const httpServer = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server: httpServer });
const room = new GameRoom();

wss.on('connection', (ws: WebSocket) => {
  const session = room.addPlayer(ws);
  console.log(`Player ${session.id} connected (${wss.clients.size} online)`);

  ws.on('message', (data) => {
    room.handleMessage(session.id, data.toString());
  });

  ws.on('close', () => {
    room.removePlayer(session.id);
    console.log(`Player ${session.id} disconnected (${wss.clients.size} online)`);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🎰 Kash Rundown server on port ${PORT}`);
});
