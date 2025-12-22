# 🌐 HƯỚNG DẪN KẾT NỐI NHIỀU MÁY VÀO SERVER

## 📋 YÊU CẦU
- Các máy phải cùng mạng LAN (WiFi hoặc dây mạng cùng router)
- Firewall cho phép port 8081

---

## 🚀 CÁCH SETUP

### **Bước 1: Tìm địa chỉ IP của máy chủ**

Trên máy đang chạy server, mở PowerShell và chạy:

```powershell
ipconfig
```

Tìm dòng **IPv4 Address** (thường dạng `192.168.x.x` hoặc `10.0.x.x`)

**Ví dụ:** `192.168.1.100`

---

### **Bước 2: Mở Firewall cho port 8081**

**Windows Firewall:**

1. Mở PowerShell **với quyền Administrator**
2. Chạy lệnh:

```powershell
New-NetFirewallRule -DisplayName "Chat App" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow
```

**Hoặc thủ công:**
1. Windows Defender Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port → TCP → 8081 → Allow

---

### **Bước 3: Chạy server**

```powershell
cd D:\NgonNguLapTrinh\java\Chat\demo
.\mvnw.cmd spring-boot:run
```

Đợi cho đến khi thấy:
```
Tomcat started on port 8081 (http) with context path '/'
```

---

### **Bước 4: Truy cập từ các máy khác**

**Trên máy chủ:**
- Mở trình duyệt: `http://localhost:8081`

**Trên các máy khác trong mạng:**
- Mở trình duyệt: `http://192.168.1.100:8081`
  *(Thay `192.168.1.100` bằng IP thật của máy chủ)*

---

## ✅ KIỂM TRA KẾT NỐI

### **Test ping từ máy khác:**

```powershell
ping 192.168.1.100
```

Nếu thấy `Reply from 192.168.1.100...` → OK!

### **Test port:**

```powershell
Test-NetConnection -ComputerName 192.168.1.100 -Port 8081
```

Nếu `TcpTestSucceeded : True` → OK!

---

## 💬 SỬ DỤNG

1. **Mỗi người** mở trình duyệt vào `http://192.168.1.100:8081`
2. Nhập **tên riêng** và **cùng tên phòng** (ví dụ: "General")
3. Click "Vào phòng chat"
4. Tất cả mọi người trong cùng phòng sẽ thấy nhau!

---

## 🔧 XỬ LÝ SỰ CỐ

### **Lỗi: Không kết nối được**

✅ Kiểm tra:
1. Server có đang chạy không? (xem log terminal)
2. IP đúng chưa? (chạy `ipconfig` lại)
3. Firewall đã mở port 8081 chưa?
4. Cùng mạng LAN chưa? (cùng WiFi/router)

### **Lỗi: WebSocket connection failed**

```javascript
// Trong trường hợp này, WebSocket tự động dùng IP hiện tại
// Không cần sửa gì cả!
```

Code đã được update để **tự động phát hiện** IP:
```javascript
const serverHost = window.location.hostname || "localhost";
const ws = new WebSocket(`ws://${serverHost}:8081/chat`);
```

**Nghĩa là:**
- Nếu truy cập qua `192.168.1.100:8081` → WebSocket dùng `ws://192.168.1.100:8081/chat`
- Nếu truy cập qua `localhost:8081` → WebSocket dùng `ws://localhost:8081/chat`

---

## 🌍 KẾT NỐI QUA INTERNET (Nâng cao)

Nếu muốn bạn bè ở xa kết nối:

### **Cách 1: Ngrok (Dễ nhất)**

```bash
# Download ngrok từ https://ngrok.com/
ngrok http 8081
```

Sẽ có URL: `https://abc123.ngrok.io`
→ Gửi cho bạn bè

### **Cách 2: Port Forwarding**

1. Vào router → Port Forwarding
2. Forward port `8081` → IP máy chủ (`192.168.1.100`)
3. Lấy IP public: https://whatismyipaddress.com/
4. Bạn bè truy cập: `http://YOUR_PUBLIC_IP:8081`

⚠️ **Lưu ý bảo mật khi mở port ra Internet!**

---

## 📱 DEMO

```
Máy chủ (192.168.1.100):
  ✅ Server đang chạy
  ✅ Truy cập: http://localhost:8081

Máy A (192.168.1.101):
  ✅ Truy cập: http://192.168.1.100:8081
  ✅ Vào phòng "Java" với tên "Alice"

Máy B (192.168.1.102):
  ✅ Truy cập: http://192.168.1.100:8081
  ✅ Vào phòng "Java" với tên "Bob"

→ Alice và Bob sẽ thấy nhau trong phòng "Java"!
→ Có thể chat, gửi file, DM cho nhau!
```

---

## 🎯 TÓM TẮT

| Bước | Hành động | Máy nào |
|------|-----------|---------|
| 1 | Chạy `ipconfig` tìm IP | Máy chủ |
| 2 | Mở Firewall port 8081 | Máy chủ |
| 3 | Chạy server | Máy chủ |
| 4 | Truy cập `http://IP:8081` | Tất cả máy |

**Xong!** Giờ có thể chat với nhau rồi! 🎉
