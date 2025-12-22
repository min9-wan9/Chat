// WebSocket Connection
const serverHost = window.location.hostname || "localhost";
const ws = new WebSocket(`ws://${serverHost}:8081/chat`);

// DOM Elements
const chatArea = document.getElementById("chatArea");
const privateChatArea = document.getElementById("privateChatArea");
const statusText = document.getElementById("statusText");
const joinSection = document.getElementById("joinSection");
const inputArea = document.getElementById("inputArea");
const messageInput = document.getElementById("message");
const userList = document.getElementById("userList");
const roomList = document.getElementById("roomList");
const typingIndicator = document.getElementById("typingIndicator");
const userSidebar = document.getElementById("userSidebar");
const currentRoomName = document.getElementById("currentRoomName");

// State Variables
let currentUser = "";
let currentRoom = "";
let privateTarget = "";
let typingTimeout = null;

// Join Room Function
function join() {
    const username = document.getElementById("username").value.trim();
    const room = document.getElementById("room").value.trim();
    
    if (username && room) {
        currentUser = username;
        currentRoom = room;
        ws.send(`JOIN|${room}|${username}|${getInitials(username)}`);
        
        joinSection.classList.add("hidden");
        chatArea.style.display = "flex";
        inputArea.style.display = "flex";
        userSidebar.style.display = "flex";
        currentRoomName.textContent = `🏠 ${room}`;
        messageInput.focus();
    } else {
        alert("Vui lòng nhập đầy đủ tên và phòng!");
    }
}

// Send Message Function
function send() {
    const message = messageInput.value.trim();
    if (message) {
        ws.send(`MSG|${message}`);
        messageInput.value = "";
    }
}

// Send Private Message Function
function sendPrivate() {
    const message = document.getElementById("privateMessage").value.trim();
    if (message && privateTarget) {
        ws.send(`PRIVATE|${privateTarget}|${message}`);
        document.getElementById("privateMessage").value = "";
    }
}

// File Upload Handler
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append("file", file);
        
        fetch("/api/files/upload", {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                ws.send(`MSG|[FILE:${data.type}:${data.url}:${file.name}]`);
            }
        })
        .catch(error => {
            alert("Lỗi upload file: " + error);
        });
        
        event.target.value = "";
    }
}

// Add Message to Chat Area
function addMessage(sender, message, isCurrentUser, timestamp) {
    const messageDiv = document.createElement("div");
    messageDiv.className = isCurrentUser ? "message user" : "message other";
    
    const header = document.createElement("div");
    header.className = "message-header";
    
    if (!isCurrentUser) {
        const senderSpan = document.createElement("span");
        senderSpan.className = "message-sender";
        senderSpan.textContent = sender;
        header.appendChild(senderSpan);
    }
    
    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.textContent = formatTime(timestamp);
    header.appendChild(timeSpan);
    
    messageDiv.appendChild(header);
    
    // Check if message is a file
    if (message.startsWith("[FILE:")) {
        const fileMatch = message.match(/\[FILE:(\w+):([^:]+):([^\]]+)\]/);
        if (fileMatch) {
            const [, type, url, name] = fileMatch;
            const fileDiv = document.createElement("div");
            fileDiv.className = "message-file";
            
            if (type === "image") {
                const img = document.createElement("img");
                img.src = url;
                img.alt = name;
                img.onclick = () => window.open(url, "_blank");
                fileDiv.appendChild(img);
            } else if (type === "video") {
                const video = document.createElement("video");
                video.src = url;
                video.controls = true;
                fileDiv.appendChild(video);
            } else {
                const link = document.createElement("a");
                link.href = url;
                link.textContent = `📄 ${name}`;
                link.target = "_blank";
                fileDiv.appendChild(link);
            }
            
            messageDiv.appendChild(fileDiv);
        }
    } else {
        const textDiv = document.createElement("div");
        textDiv.className = "message-text";
        textDiv.textContent = message;
        messageDiv.appendChild(textDiv);
    }
    
    chatArea.appendChild(messageDiv);
    scrollToBottom(chatArea);
}

// Add Private Message
function addPrivateMessage(sender, message, isCurrentUser, timestamp) {
    const messageDiv = document.createElement("div");
    messageDiv.className = isCurrentUser ? "message user private" : "message other private";
    
    const header = document.createElement("div");
    header.className = "message-header";
    
    const senderSpan = document.createElement("span");
    senderSpan.className = "message-sender";
    senderSpan.textContent = isCurrentUser ? "Bạn" : sender;
    header.appendChild(senderSpan);
    
    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.textContent = formatTime(timestamp);
    header.appendChild(timeSpan);
    
    messageDiv.appendChild(header);
    
    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.textContent = message;
    messageDiv.appendChild(textDiv);
    
    privateChatArea.appendChild(messageDiv);
    scrollToBottom(privateChatArea);
}

// Add System Message
function addSystemMessage(message) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message system";
    messageDiv.textContent = message;
    chatArea.appendChild(messageDiv);
    scrollToBottom(chatArea);
}

// Update User List
function updateUserList(users) {
    userList.innerHTML = "";
    document.getElementById("userCount").textContent = `${users.length} người online`;
    
    users.forEach(user => {
        if (user.username !== currentUser) {
            const userDiv = document.createElement("div");
            userDiv.className = "user-item";
            userDiv.onclick = () => openPrivateChat(user.username);
            
            const avatar = document.createElement("div");
            avatar.className = "user-avatar";
            avatar.textContent = user.avatar;
            avatar.style.background = getColorFromName(user.username);
            
            const info = document.createElement("div");
            info.className = "user-info";
            
            const name = document.createElement("div");
            name.className = "user-name";
            name.textContent = user.username;
            
            const status = document.createElement("div");
            status.className = "user-status";
            status.textContent = "● Online";
            
            info.appendChild(name);
            info.appendChild(status);
            userDiv.appendChild(avatar);
            userDiv.appendChild(info);
            userList.appendChild(userDiv);
        }
    });
}

// Update Room List
function updateRoomList(rooms) {
    const newRoomBtn = roomList.querySelector(".new-room-btn");
    roomList.innerHTML = "";
    if (newRoomBtn) roomList.appendChild(newRoomBtn);
    
    rooms.forEach(room => {
        const roomDiv = document.createElement("div");
        roomDiv.className = "room-item";
        if (room.name === currentRoom) {
            roomDiv.classList.add("active");
        }
        roomDiv.onclick = () => switchRoom(room.name);
        
        const icon = document.createElement("div");
        icon.className = "room-icon";
        icon.textContent = room.name.substring(0, 2).toUpperCase();
        
        const info = document.createElement("div");
        info.className = "room-info";
        
        const name = document.createElement("div");
        name.className = "room-name";
        name.textContent = room.name;
        
        const count = document.createElement("div");
        count.className = "room-count";
        count.textContent = `${room.count} người`;
        
        info.appendChild(name);
        info.appendChild(count);
        roomDiv.appendChild(icon);
        roomDiv.appendChild(info);
        roomList.appendChild(roomDiv);
    });
}

// Open Private Chat
function openPrivateChat(username) {
    privateTarget = username;
    document.getElementById("privateChatTitle").textContent = `💬 Chat với ${username}`;
    document.getElementById("privateChatOverlay").classList.add("active");
    privateChatArea.innerHTML = "";
}

// Close Private Chat
function closePrivateChat() {
    document.getElementById("privateChatOverlay").classList.remove("active");
    privateTarget = "";
}

// Switch Room
function switchRoom(roomName) {
    if (roomName !== currentRoom) {
        chatArea.innerHTML = "";
        currentRoom = roomName;
        currentRoomName.textContent = `🏠 ${roomName}`;
        ws.send(`JOIN|${roomName}|${currentUser}|${getInitials(currentUser)}`);
    }
}

// Create New Room
function createNewRoom() {
    const roomName = prompt("Nhập tên phòng mới:");
    if (roomName && roomName.trim()) {
        switchRoom(roomName.trim());
    }
}

// Handle Typing Indicator
function handleTyping() {
    clearTimeout(typingTimeout);
    ws.send("TYPING|");
    typingTimeout = setTimeout(() => {}, 1000);
}

// Show Typing Indicator
function showTyping(username) {
    typingIndicator.textContent = `${username} đang gõ...`;
    setTimeout(() => {
        typingIndicator.textContent = "";
    }, 3000);
}

// Toggle Sidebar
function toggleSidebar() {
    document.getElementById("roomSidebar").classList.toggle("visible");
}

// Toggle User Sidebar
function toggleUserSidebar() {
    const isVisible = userSidebar.style.display !== "none";
    userSidebar.style.display = isVisible ? "none" : "flex";
}

// Handle Enter Key
function handleEnter(event) {
    if (event.key === "Enter") {
        send();
    }
}

// Handle Private Enter Key
function handlePrivateEnter(event) {
    if (event.key === "Enter") {
        sendPrivate();
    }
}

// Scroll to Bottom
function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
}

// Format Time
function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(parseInt(timestamp));
    return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Get Initials from Name
function getInitials(name) {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Get Color from Name
function getColorFromName(name) {
    const colors = [
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "linear-gradient(135deg, #30cfd0 0%, #330867 100%)"
    ];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

// Show Notification
function showNotification(message) {
    if (Notification.permission === "granted") {
        new Notification("Chat App", { body: message });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification("Chat App", { body: message });
            }
        });
    }
}

// WebSocket Event Handlers
ws.onopen = () => {
    statusText.textContent = "Đã kết nối";
    ws.send("GET_ROOMS|");
};

ws.onmessage = (event) => {
    const parts = event.data.split("|");
    const type = parts[0];
    
    if (type === "SYS") {
        addSystemMessage(parts[1]);
    } else if (type === "MSG") {
        addMessage(parts[1], parts[2], parts[1] === currentUser, parts[3]);
    } else if (type === "USERS") {
        updateUserList(JSON.parse(parts[1]));
    } else if (type === "ROOMS") {
        updateRoomList(JSON.parse(parts[1]));
    } else if (type === "PRIVATE") {
        addPrivateMessage(parts[1], parts[2], false, parts[3]);
        showNotification(`Tin nhắn từ ${parts[1]}`);
    } else if (type === "PRIVATE_SENT") {
        addPrivateMessage(parts[1], parts[2], true, parts[3]);
    } else if (type === "TYPING") {
        showTyping(parts[1]);
    }
};

ws.onclose = () => {
    statusText.textContent = "Mất kết nối";
    addSystemMessage("❌ Mất kết nối với server");
};

// Focus username input on load
document.getElementById("username").focus();
