const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let schedules = []; // Lưu lịch trình ăn
let activityLogs = []; // Lưu 10 hoạt động gần nhất

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

wss.on('connection', (ws) => {
  console.log('Thiết bị kết nối mới');
  
  // Gửi lịch trình và nhật ký hiện tại ngay khi Web vừa mở
  ws.send(JSON.stringify({ type: 'init', schedules, activityLogs }));

  ws.on('message', (message, isBinary) => {
    let data = isBinary ? message : message.toString();
    
    // Xử lý nếu là lệnh lưu lịch trình từ Web
    try {
      let parsed = JSON.parse(data);
      if (parsed.type === 'set_schedule') {
        schedules = parsed.data;
        console.log("Cập nhật lịch trình mới");
      }
      if (parsed.type === 'log') {
        activityLogs.unshift(parsed.text); // Thêm vào đầu mảng
        if (activityLogs.length > 10) activityLogs.pop(); // Giữ tối đa 10 dòng
      }
    } catch (e) {}

    // Phát lại cho các thiết bị khác
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message, { binary: isBinary });
      }
    });
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server chuẩn 1-2-3 đã chạy!');
});
