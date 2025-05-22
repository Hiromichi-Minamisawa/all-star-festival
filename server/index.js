const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);  // socket.io v2 の正しい書き方

io.origins('*:*'); // ★CORS対策（開発時用）

app.use(express.static('public'));
app.use(express.json());

const PORT = process.env.PORT || 3000;

let currentQuestion = null;
let currentCorrectAnswer = null;
const answers = [];

const clients = {
  admins: new Set(),
  participants: new Set(),
  monitors: new Set(),
};

io.on('connection', socket => {
  console.log(`クライアント接続: ${socket.id}`);

  socket.on('registerAdmin', () => {
    clients.admins.add(socket.id);
    console.log(`管理者登録: ${socket.id}`);
  });

  socket.on('registerName', data => {
    if (!data || !data.name) return;
    socket.data.name = data.name;
    clients.participants.add(socket.id);
    console.log(`参加者登録: ${data.name} (${socket.id})`);
  });

  socket.on('registerMonitor', () => {
    clients.monitors.add(socket.id);
    console.log(`モニター登録: ${socket.id}`);
  });

  socket.on('question', data => {
    if (!data || !data.text || !data.choices || !data.correctAnswer) return;
    currentQuestion = data;
    currentCorrectAnswer = data.correctAnswer;

    answers.length = 0; // 以前の回答をクリア

    console.log(`問題送信: ${data.text}`);
    clients.participants.forEach(id => {
      io.to(id).emit('question', {
        text: data.text,
        choices: data.choices,
      });
    });
    clients.monitors.forEach(id => {
      io.to(id).emit('go');
    });
  });

  socket.on('go', () => {
    console.log('出題スタート');
    clients.participants.forEach(id => {
      io.to(id).emit('go');
    });
    clients.monitors.forEach(id => {
      io.to(id).emit('go');
    });
  });

  socket.on('answer', data => {
    const name = socket.data.name;
    if (!name) {
      console.log('名前未登録の参加者からの回答を無視');
      return;
    }
    if (!currentCorrectAnswer) {
      console.log('現在出題中の問題がないため回答無視');
      return;
    }
    const choice = data.choice;
    const elapsed = data.elapsed || 0;

    if (answers.find(a => a.name === name)) {
      console.log(`${name} はすでに回答済み`);
      return;
    }

    const isCorrect = choice !== null && choice.toString() === currentCorrectAnswer.toString();

    answers.push({ name, choice, elapsed, isCorrect });

    console.log(`回答受付: ${name} 選択: ${choice} 正誤: ${isCorrect} 経過: ${elapsed}`);

    clients.monitors.forEach(id => {
      io.to(id).emit('answer', { name, choice, elapsed, result: isCorrect ? '○' : '×' });
    });
  });

  socket.on('result', data => {
    if (!data || !data.correctAnswer) return;
    currentCorrectAnswer = data.correctAnswer;
    console.log(`結果発表: 正解は ${currentCorrectAnswer}`);

    clients.participants.forEach(id => {
      io.to(id).emit('result', { correctAnswer: currentCorrectAnswer });
    });
    clients.monitors.forEach(id => {
      io.to(id).emit('result', { correctAnswer: currentCorrectAnswer });
    });
  });

  socket.on('disconnect', () => {
    clients.admins.delete(socket.id);
    clients.participants.delete(socket.id);
    clients.monitors.delete(socket.id);
    console.log(`切断: ${socket.id}`);
  });
});

app.get('/total', (req, res) => {
  res.json(answers);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
