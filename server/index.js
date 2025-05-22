const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io'); // socket.io@2.5.1 用

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // for v2.5.1

const PORT = process.env.PORT || 3000;

// static public directory
app.use(express.static(path.join(__dirname, '../public')));

// ルート
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/client.html'));
});

let currentQuestion = null;

// WebSocket通信
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('question', (data) => {
    currentQuestion = data;
    io.emit('question', data);
  });

  socket.on('answer', (data) => {
    io.emit('answer', data);
  });

  socket.on('go', () => {
    io.emit('go');
  });

  socket.on('result', (data) => {
    io.emit('result', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
