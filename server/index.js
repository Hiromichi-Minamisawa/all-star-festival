const express = require('express');
const http = require('http');
const socketIo = require('socket.io'); // v2.5.1用
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3000;

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// クイズの問題を管理（例としてシンプルな配列）
const questions = [
  { id: 1, text: '1+1は？', correctAnswer: '2' },
  { id: 2, text: '2+2は？', correctAnswer: '4' },
  // 必要に応じて追加してください
];

// 解答データ格納用（メモリ上）
let answers = [];

// Socket.IO接続イベント
io.on('connection', (socket) => {
  console.log('ユーザー接続:', socket.id);

  // 名前登録受信
  socket.on('registerName', ({ name }) => {
    socket.name = name;
    console.log(`ユーザー登録: ${name}`);
  });

  // 管理者からの問題送信（admin.html等から）
  socket.on('sendQuestion', (data) => {
    const question = questions.find(q => q.id === data.id);
    if (!question) {
      console.warn('不正な問題ID:', data.id);
      return;
    }
    io.emit('question', { text: question.text });
    console.log('問題送信:', question.text);

    // 解答情報クリア
    answers = [];
  });

  // 出題開始合図
  socket.on('go', () => {
    io.emit('go');
    console.log('出題スタート');
  });

  // 解答受信
  socket.on('answer', (data) => {
    // data: { choice, name, elapsed }
    if (!data.name) return; // 名前なしは無視
    answers = answers.filter(a => a.name !== data.name); // 重複防止
    answers.push(data);

    // モニター画面に即時送信
    io.emit('answer', data);
  });

  // 結果発表（管理者操作などで発動）
  socket.on('showResult', (data) => {
    // data: { correctAnswer: '1'など }
    if (!data.correctAnswer) return;
    io.emit('result', { correctAnswer: data.correctAnswer });

    // 結果をまとめてログ用や最終集計用に保持したい場合はここに実装可能
  });

  // 合計データ取得用API代わり（必要なら）
  app.get('/total', (req, res) => {
    res.json(answers);
  });

  socket.on('disconnect', () => {
    console.log('ユーザー切断:', socket.id);
  });
});

// サーバー起動
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
