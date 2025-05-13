const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

// データ管理
let answerResult = [];        // [{ data: { id, name, choice, time, elapse }, questionNumber }]
let questionNumber = 0;
let members = {};             // { socket.id: { name, score, totalTime } }
let goTimestamp = null;

// ミドルウェア
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 静的ファイル
app.use(express.static(path.join(__dirname, '../public')));
app.get('/client.html', (req, res) => res.sendFile(path.join(__dirname, '../client.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, '../admin.html')));
app.get('/monitor.html', (req, res) => res.sendFile(path.join(__dirname, '../monitor.html')));
app.get('/results.html', (req, res) => res.sendFile(path.join(__dirname, '../results.html')));

// API
app.get('/reset', (req, res) => {
  answerResult = [];
  questionNumber = 0;
  members = {};
  goTimestamp = null;
  res.send('リセットしました');
});

app.get('/total', (req, res) => {
  res.json(answerResult);
});

app.get('/members', (req, res) => {
  res.json(members);
});

// Socket.IO 処理
io.on('connection', socket => {
  console.log('🔌 Connected:', socket.id);

  // ユーザー名登録
  socket.on('registerName', name => {
    members[socket.id] = {
      name,
      score: 0,
      totalTime: 0
    };
    console.log(`✅ 登録: ${socket.id} as ${name}`);
  });

  // 問題スタート
  socket.on('go', () => {
    goTimestamp = Date.now();
    io.emit('go');
    console.log('🟢 GO 信号送信');
  });

  // 解答送信
  socket.on('answer', data => {
    const answeredTimestamp = Date.now();
    data.id = socket.id;

    const dt = new Date();
    const h = ('00' + dt.getHours()).slice(-2);
    const m = ('00' + dt.getMinutes()).slice(-2);
    const s = ('00' + dt.getSeconds()).slice(-2);
    const ms = dt.getMilliseconds();
    data.time = `${h}:${m}:${s} ${ms}`;
    data.elapse = answeredTimestamp - goTimestamp;

    // 名前を付加
    if (members[socket.id]) {
      data.name = members[socket.id].name;
    } else {
      data.name = '名無し';
    }

    // ログとして保存
    answerResult.push({ data, questionNumber });

    io.emit('answer', { data });
    console.log(`📩 解答: ${data.name} - ${data.choice} (${data.elapse}ms)`);
  });

  // 正解発表
  socket.on('result', ({ correctAnswer }) => {
    // 各メンバーの正誤と加点処理
    answerResult.forEach(entry => {
      if (entry.questionNumber === questionNumber) {
        const { id, choice, elapse } = entry.data;
        if (members[id]) {
          if (choice === correctAnswer) {
            members[id].score += 1;
            members[id].totalTime += elapse;
          }
        }
      }
    });

    io.emit('result', { correctAnswer });
    console.log(`🎯 正解発表: ${correctAnswer}`);
  });

  // 総合ランキング送信
  socket.on('showTotalRanking', () => {
    const ranking = Object.entries(members)
      .map(([id, info]) => ({
        id,
        name: info.name,
        score: info.score,
        totalTime: info.totalTime
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.totalTime - b.totalTime;
      });

    io.emit('showTotalRanking', ranking);
    console.log('📊 総合ランキング送信');
  });

  // 問題番号セット
  socket.on('setQuestionNumber', num => {
    questionNumber = num;
  });

  // リセット処理
  socket.on('resetMembers', () => {
    members = {};
  });

  socket.on('resetAnswerResult', () => {
    answerResult = [];
    questionNumber = 0;
  });

  // 切断
  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
  });
});

// サーバー起動
server.listen(port, host, () => {
  console.log(`🚀 Server running at http://${host}:${port}`);
});
