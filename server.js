const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Ném file giao diện Web ra ngoài Internet
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Khi có thiết bị kết nối (ESP32 hoặc Điện thoại)
wss.on('connection', (ws) => {
  console.log('Có thiết bị mới kết nối!');

  ws.on('message', (message, isBinary) => {
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message, { binary: isBinary });
      }
    });
  });

  ws.on('close', () => console.log('Thiết bị đã ngắt kết nối.'));
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Trạm trung chuyển Camera IoT đã hoạt động!');
});
