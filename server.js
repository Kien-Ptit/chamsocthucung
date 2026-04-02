const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- BỘ NHỚ LƯU TRỮ CỦA MÁY CHỦ ---
let schedules = []; // Lưu lịch trình
let activityLogs = []; // Lưu nhật ký (tối đa 15 dòng)
let hourlyData = new Array(24).fill(0); // Lưu biểu đồ thống kê 24 giờ

// Lưu trạng thái hiện tại để gửi ngay cho Web lúc vừa mở lên
let currentStatus = {
  weight: 0,
  totalFoodToday: 0,
  limit: 50,
  dailyLimit: 150,
  waterBowl: false,
  waterTank: true
};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Hàm phát dữ liệu cho TẤT CẢ thiết bị đang kết nối
function broadcast(data, isBinary = false) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });
}

wss.on('connection', (ws) => {
  console.log('Có thiết bị mới kết nối!');

  // 1. Gửi khởi tạo (Lịch trình & Nhật ký)
  ws.send(JSON.stringify({ 
    type: 'init', 
    schedules: schedules, 
    activityLogs: activityLogs 
  }));

  // 2. Gửi dữ liệu biểu đồ 24h
  ws.send(JSON.stringify({ 
    type: 'hourly_update', 
    hourlyData: hourlyData 
  }));

  // 3. Gửi trạng thái thông số hiện tại
  ws.send(JSON.stringify(currentStatus));

  ws.on('message', (message, isBinary) => {
    if (!isBinary) {
      let msgStr = message.toString();
      
      // Nếu là dữ liệu dạng JSON (Thông số, cài đặt, log)
      if (msgStr.startsWith('{')) {
        try {
          let data = JSON.parse(msgStr);

          // Xử lý các loại tin nhắn đặc biệt
          if (data.type === 'set_schedule') {
            schedules = data.data;
          } 
          else if (data.type === 'log') {
            activityLogs.unshift(data.text);
            if (activityLogs.length > 15) activityLogs.pop(); 
          }
          else if (data.type === 'update_hour') {
            // Nhận cập nhật lượng ăn từng giờ từ ESP32
            hourlyData[data.hour] = data.amount;
            broadcast(JSON.stringify({ type: 'hourly_update', hourlyData }));
          }
          else if (data.type === 'reset_day') {
            // Nhận lệnh reset qua ngày mới từ ESP32
            hourlyData.fill(0);
            currentStatus.totalFoodToday = 0;
            broadcast(JSON.stringify({ type: 'hourly_update', hourlyData }));
          }
          else if (data.type === 'settings') {
            currentStatus.dailyLimit = data.dailyLimit;
            currentStatus.limit = data.feedLimit;
          }
          else {
            // Lưu lại các thông số cảm biến để nhỡ có người mở web trễ vẫn thấy
            if (data.weight !== undefined) currentStatus.weight = data.weight;
            if (data.totalFoodToday !== undefined) currentStatus.totalFoodToday = data.totalFoodToday;
            if (data.waterBowl !== undefined) currentStatus.waterBowl = data.waterBowl;
            if (data.waterTank !== undefined) currentStatus.waterTank = data.waterTank;
          }
        } catch (e) {
          console.log("Lỗi đọc JSON:", e);
        }
      }
    }

    // Chuyển tiếp (Broadcast) mọi tin nhắn (Video, Lệnh feed/pump) cho thiết bị còn lại
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message, { binary: isBinary });
      }
    });
  });

  ws.on('close', () => console.log('Thiết bị ngắt kết nối.'));
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Trạm trung chuyển Camera IoT đã hoạt động!');
});
