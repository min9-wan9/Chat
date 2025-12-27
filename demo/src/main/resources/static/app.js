// ================= AUTH CHECK =================
const loggedUser = localStorage.getItem("currentUser");
if (!loggedUser) {
    window.location.href = "/login.html";
}

// ✅ GÁN NGAY
let currentUser = loggedUser;

document.getElementById("currentUserName").textContent = currentUser;


// ================= WEBSOCKET CONNECTION =================
const serverHost = window.location.hostname || "localhost";
const ws = new WebSocket(`ws://${serverHost}:8081/chat`);

// ================= DOM ELEMENTS =================
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

// ================= STATE =================

let currentRoom = "";
let privateTarget = "";
let typingTimeout = null;

// Notification state
let isWindowFocused = true;
let unreadCount = 0;
const originalTitle = document.title;

// Private chat history: { username: [{sender, message, timestamp, isCurrentUser}] }
const privateChatHistory = {};
// Unread private messages count: { username: count }
const unreadPrivateMessages = {};

// ================= NOTIFICATION SUPPORT =================
// Check if browser supports notifications
function checkNotificationSupport() {
    return "Notification" in window;
}

// Request notification permission
function requestNotificationPermission() {
    if (checkNotificationSupport() && Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("✅ Notification permission granted");
            } else {
                console.log("❌ Notification permission denied");
            }
        });
    }
}

// Show desktop notification with optional action
function showNotificationWithAction(title, body, icon = "💬", action = null) {
    if (!checkNotificationSupport() || Notification.permission !== "granted") {
        return;
    }

    // Only show notification if window is not focused
    if (isWindowFocused) {
        return;
    }

    const notification = new Notification(title, {
        body: body,
        icon: icon,
        badge: icon,
        tag: "chat-notification",
        requireInteraction: false
    });

    // Focus window and execute action when notification is clicked
    notification.onclick = function () {
        window.focus();
        if (action) action();
        notification.close();
    };

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
}

// Track window focus state
window.addEventListener("focus", () => {
    isWindowFocused = true;
    unreadCount = 0;
    document.title = originalTitle;
});

window.addEventListener("blur", () => {
    isWindowFocused = false;
});

// Update unread counter
function incrementUnreadCount() {
    if (!isWindowFocused) {
        unreadCount++;
        document.title = `(${unreadCount}) ${originalTitle}`;
    }
}

// ================= JOIN =================
function join() {
    const room = document.getElementById("room").value.trim();

    if (!room) {
        alert("Vui lòng nhập tên phòng!");
        return;
    }

    currentRoom = room;

    ws.send(`JOIN|${room}|${currentUser}|${getInitials(currentUser)}`);

    joinSection.classList.add("hidden");
    chatArea.style.display = "flex";
    inputArea.style.display = "flex";
    userSidebar.style.display = "flex";
    currentRoomName.textContent = `🏠 ${room}`;
    messageInput.focus();

    requestNotificationPermission();
}



// ================= SEND MESSAGE =================
function send() {
    const message = messageInput.value.trim();
    if (message) {
        ws.send(`MSG|${message}`);
        messageInput.value = "";
    }
}

function logout() {
    localStorage.removeItem("currentUser");
    window.location.href = "login.html";
}


// ================= ADD MESSAGE (ROOM) =================
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

    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.textContent = message;
    messageDiv.appendChild(textDiv);

    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;

    // Show notification for messages from others
    if (!isCurrentUser && sender !== currentUser) {
        showNotificationWithAction(
            `💬 Tin nhắn từ ${sender}`,
            message,
            "💬"
        );
        incrementUnreadCount();
    }
}

// ================= SYSTEM MESSAGE =================
function addSystemMessage(message) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message system";
    messageDiv.textContent = message;
    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// ================= PRIVATE CHAT =================
function openPrivateChat(username) {
    privateTarget = username;
    document.getElementById("privateChatTitle").textContent = `💬 Chat với ${username}`;
    document.getElementById("privateChatOverlay").classList.add("active");

    // Clear current display
    privateChatArea.innerHTML = "";

    // Load history for this user
    const history = privateChatHistory[username] || [];
    history.forEach(msg => {
        if (msg.isFile) {
            // Render file message
            renderPrivateFileMessage(msg.sender, msg.fileUrl, msg.fileType, msg.fileName, msg.fileSize, msg.isCurrentUser, msg.timestamp);
        } else {
            // Render text message
            renderPrivateMessage(msg.sender, msg.message, msg.isCurrentUser, msg.timestamp);
        }
    });

    // Reset unread count for this user
    unreadPrivateMessages[username] = 0;
    updateUserListBadges();

    // Focus input
    document.getElementById("privateMessage").focus();
}

function closePrivateChat() {
    document.getElementById("privateChatOverlay").classList.remove("active");
    privateTarget = "";
}

function handlePrivateEnter(event) {
    if (event.key === "Enter") {
        sendPrivate();
    }
}

function sendPrivate() {
    const input = document.getElementById("privateMessage");
    const message = input.value.trim();

    if (message && privateTarget) {
        ws.send(`PRIVATE|${privateTarget}|${message}`);
        input.value = "";
    }
}

// ================= PRIVATE FILE HANDLING =================
async function handlePrivateFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert("❌ File quá lớn! Tối đa 10MB");
        event.target.value = "";
        return;
    }

    if (!privateTarget) {
        alert("❌ Vui lòng chọn người nhận");
        event.target.value = "";
        return;
    }

    // Show uploading indicator
    const uploadingMsg = document.createElement("div");
    uploadingMsg.className = "message system";
    uploadingMsg.textContent = "📤 Đang tải file...";
    privateChatArea.appendChild(uploadingMsg);
    privateChatArea.scrollTop = privateChatArea.scrollHeight;

    try {
        // Upload file to server
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/files/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("Upload failed");
        }

        const result = await response.json();

        // Remove uploading indicator
        privateChatArea.removeChild(uploadingMsg);

        // Send file info via WebSocket
        ws.send(`PRIVATE_FILE|${privateTarget}|${result.url}|${result.type}|${file.name}|${result.size}`);

        // Clear file input
        event.target.value = "";

    } catch (error) {
        console.error("Private file upload error:", error);
        uploadingMsg.textContent = "❌ Lỗi khi tải file";
        uploadingMsg.style.background = "#fee";
        uploadingMsg.style.color = "#c00";
    }
}

function addPrivateFileMessage(sender, fileUrl, fileType, fileName, fileSize, isCurrentUser, timestamp) {
    // Determine the conversation partner
    // When isCurrentUser=true, sender param is actually the target user (from PRIVATE_FILE_SENT)
    // When isCurrentUser=false, sender param is the actual sender (from PRIVATE_FILE)
    const partner = sender;

    // Save to history
    if (!privateChatHistory[partner]) {
        privateChatHistory[partner] = [];
    }
    privateChatHistory[partner].push({
        sender: isCurrentUser ? currentUser : sender,
        fileUrl: fileUrl,
        fileType: fileType,
        fileName: fileName,
        fileSize: fileSize,
        isFile: true,
        isCurrentUser: isCurrentUser,
        timestamp: timestamp
    });

    // If private chat with this user is currently open, display the file
    if (privateTarget === partner) {
        renderPrivateFileMessage(sender, fileUrl, fileType, fileName, fileSize, isCurrentUser, timestamp);
    } else if (!isCurrentUser) {
        // If not open and file is from someone else, increase unread count
        unreadPrivateMessages[partner] = (unreadPrivateMessages[partner] || 0) + 1;
        updateUserListBadges();

        // Show notification with action to open private chat
        showNotificationWithAction(
            `📎 File riêng từ ${sender}`,
            `${fileName} (${formatFileSize(fileSize)})`,
            "📎",
            () => openPrivateChat(sender)
        );
        incrementUnreadCount();
    }
}

function renderPrivateFileMessage(sender, fileUrl, fileType, fileName, fileSize, isCurrentUser, timestamp) {
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

    // File content based on type
    const fileDiv = document.createElement("div");
    fileDiv.className = "message-file";

    if (fileType === "image") {
        const img = document.createElement("img");
        img.src = fileUrl;
        img.alt = fileName;
        img.style.maxWidth = "300px";
        img.style.maxHeight = "300px";
        img.style.borderRadius = "8px";
        img.style.cursor = "pointer";
        img.onclick = () => window.open(fileUrl, "_blank");
        fileDiv.appendChild(img);
    } else if (fileType === "video") {
        const video = document.createElement("video");
        video.src = fileUrl;
        video.controls = true;
        video.style.maxWidth = "400px";
        video.style.maxHeight = "300px";
        video.style.borderRadius = "8px";
        fileDiv.appendChild(video);
    } else {
        // For other files (document, audio, file)
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = fileName;
        link.textContent = `📎 ${fileName} (${formatFileSize(fileSize)})`;
        link.style.color = isCurrentUser ? "#fff" : "#667eea";
        link.style.textDecoration = "underline";
        link.style.fontWeight = "500";
        fileDiv.appendChild(link);
    }

    messageDiv.appendChild(fileDiv);
    privateChatArea.appendChild(messageDiv);
    privateChatArea.scrollTop = privateChatArea.scrollHeight;
}


// Render a single private message in the UI
function renderPrivateMessage(sender, message, isCurrentUser, timestamp) {
    const messageDiv = document.createElement("div");
    messageDiv.className = isCurrentUser
        ? "message user private"
        : "message other private";

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
    privateChatArea.scrollTop = privateChatArea.scrollHeight;
}

function addPrivateMessage(sender, message, isCurrentUser, timestamp) {
    // Determine the conversation partner (the other user)
    const partner = isCurrentUser ? sender : sender; // sender is actually the other user's username

    // Save to history
    if (!privateChatHistory[partner]) {
        privateChatHistory[partner] = [];
    }
    privateChatHistory[partner].push({
        sender: isCurrentUser ? currentUser : sender,
        message: message,
        isCurrentUser: isCurrentUser,
        timestamp: timestamp
    });

    // If private chat with this user is currently open, display the message
    if (privateTarget === partner) {
        renderPrivateMessage(sender, message, isCurrentUser, timestamp);
    } else if (!isCurrentUser) {
        // If not open and message is from someone else, increase unread count
        unreadPrivateMessages[partner] = (unreadPrivateMessages[partner] || 0) + 1;
        updateUserListBadges();

        // Show notification with action to open private chat
        showNotificationWithAction(
            `🔒 Tin nhắn riêng từ ${sender}`,
            message,
            "🔒",
            () => openPrivateChat(sender)
        );
        incrementUnreadCount();
    }
}

// ================= ROOM HANDLING =================
// 🔥 CÁCH 2: KHÔNG XÓA chatArea → để HISTORY hiển thị
function switchRoom(roomName) {
    if (roomName === currentRoom) return;

    currentRoom = roomName;
    currentRoomName.textContent = `🏠 ${roomName}`;

    ws.send(`JOIN|${roomName}|${currentUser}|${getInitials(currentUser)}`);
}

function createNewRoom() {
    const roomName = prompt("Nhập tên phòng mới:");
    if (roomName && roomName.trim()) {
        switchRoom(roomName.trim());
    }
}

// ================= USER & ROOM LIST =================
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

            // Add unread badge if any
            const unreadCount = unreadPrivateMessages[user.username] || 0;
            if (unreadCount > 0) {
                const badge = document.createElement("span");
                badge.className = "unread-badge";
                badge.textContent = unreadCount;
                badge.style.cssText = "background: #ef4444; color: white; border-radius: 10px; padding: 2px 8px; font-size: 11px; font-weight: bold; margin-left: 8px;";
                name.appendChild(badge);
            }

            const status = document.createElement("div");
            status.className = "user-status";
            status.textContent = "● Online";

            // Thêm thông tin IP và ID
            const details = document.createElement("div");
            details.className = "user-details";
            details.innerHTML = `
                <small style="color: #6c757d; font-size: 11px;">
                    ID: ${user.uniqueId || 'N/A'} | IP: ${user.ip || 'Unknown'}
                </small>
            `;

            info.appendChild(name);
            info.appendChild(status);
            info.appendChild(details);
            userDiv.appendChild(avatar);
            userDiv.appendChild(info);
            userList.appendChild(userDiv);
        }
    });
}

// Update badges in user list without re-rendering everything
function updateUserListBadges() {
    const userItems = document.querySelectorAll(".user-item");
    userItems.forEach(item => {
        const username = item.querySelector(".user-name").textContent.trim();
        const unreadCount = unreadPrivateMessages[username] || 0;

        // Remove existing badge
        const existingBadge = item.querySelector(".unread-badge");
        if (existingBadge) {
            existingBadge.remove();
        }

        // Add new badge if count > 0
        if (unreadCount > 0) {
            const badge = document.createElement("span");
            badge.className = "unread-badge";
            badge.textContent = unreadCount;
            badge.style.cssText = "background: #ef4444; color: white; border-radius: 10px; padding: 2px 8px; font-size: 11px; font-weight: bold; margin-left: 8px;";
            item.querySelector(".user-name").appendChild(badge);
        }
    });
}

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

// ================= TYPING =================
function handleEnter(event) {
    if (event.key === "Enter") {
        send();
    }
}

function handleTyping() {
    clearTimeout(typingTimeout);
    ws.send("TYPING|");
    typingTimeout = setTimeout(() => { }, 1000);
}

function showTyping(username) {
    typingIndicator.textContent = `${username} đang gõ...`;
    setTimeout(() => {
        typingIndicator.textContent = "";
    }, 2000);
}

// ================= SIDEBAR =================
function toggleUserSidebar() {
    userSidebar.style.display =
        userSidebar.style.display === "none" ? "flex" : "none";
}

// ================= WEBSOCKET EVENTS =================
ws.onopen = () => {
    statusText.textContent = "Đã kết nối";
    ws.send("GET_ROOMS|");
};

ws.onmessage = (event) => {
    const data = event.data;
    const firstPipe = data.indexOf("|");
    const type = data.substring(0, firstPipe);

    // HISTORY|MSG|user|text|time
    if (type === "HISTORY") {
        // Lấy phần sau "HISTORY|"
        const msgData = data.substring(firstPipe + 1);
        const parts = msgData.split("|", 4);
        // parts[0] = "MSG", parts[1] = user, parts[2] = text, parts[3] = time
        const user = parts[1];
        const text = parts[2];
        const timestamp = parts[3];
        addMessage(user, text, user === currentUser, timestamp);
        return;
    }

    const parts = data.split("|");

    if (type === "SYS") addSystemMessage(parts[1]);
    else if (type === "MSG") addMessage(parts[1], parts[2], parts[1] === currentUser, parts[3]);
    else if (type === "USERS") updateUserList(JSON.parse(parts[1]));
    else if (type === "ROOMS") updateRoomList(JSON.parse(parts[1]));
    else if (type === "PRIVATE") addPrivateMessage(parts[1], parts[2], false, parts[3]);
    else if (type === "PRIVATE_SENT") addPrivateMessage(parts[1], parts[2], true, parts[3]);
    else if (type === "TYPING") showTyping(parts[1]);
    else if (type === "FILE") {
        // FILE|sender|fileUrl|fileType|fileName|fileSize|timestamp
        addFileMessage(parts[1], parts[2], parts[3], parts[4], parts[5], parts[1] === currentUser, parts[6]);
    }
    else if (type === "PRIVATE_FILE") {
        // PRIVATE_FILE|sender|fileUrl|fileType|fileName|fileSize|timestamp
        addPrivateFileMessage(parts[1], parts[2], parts[3], parts[4], parts[5], false, parts[6]);
    }
    else if (type === "PRIVATE_FILE_SENT") {
        // PRIVATE_FILE_SENT|targetUser|fileUrl|fileType|fileName|fileSize|timestamp
        addPrivateFileMessage(parts[1], parts[2], parts[3], parts[4], parts[5], true, parts[6]);
    }
};

ws.onclose = () => {
    statusText.textContent = "Mất kết nối";
    addSystemMessage("❌ Mất kết nối với server");
};

// ================= UTILS =================
function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(parseInt(timestamp));
    return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getInitials(name) {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

function getColorFromName(name) {
    const colors = [
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        "linear-gradient(135deg, #30cfd0 0%, #330867 100%)"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
}

// ================= FILE HANDLING =================
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert("❌ File quá lớn! Tối đa 10MB");
        event.target.value = "";
        return;
    }

    // Show uploading indicator
    const uploadingMsg = document.createElement("div");
    uploadingMsg.className = "message system";
    uploadingMsg.textContent = "📤 Đang tải file...";
    chatArea.appendChild(uploadingMsg);
    chatArea.scrollTop = chatArea.scrollHeight;

    try {
        // Upload file to server
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/files/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("Upload failed");
        }

        const result = await response.json();

        // Remove uploading indicator
        chatArea.removeChild(uploadingMsg);

        // Send file info via WebSocket
        ws.send(`FILE|${result.url}|${result.type}|${file.name}|${result.size}`);

        // Clear file input
        event.target.value = "";

    } catch (error) {
        console.error("File upload error:", error);
        uploadingMsg.textContent = "❌ Lỗi khi tải file";
        uploadingMsg.style.background = "#fee";
        uploadingMsg.style.color = "#c00";
    }
}

function addFileMessage(sender, fileUrl, fileType, fileName, fileSize, isCurrentUser, timestamp) {
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

    // File content based on type
    const fileDiv = document.createElement("div");
    fileDiv.className = "message-file";

    if (fileType === "image") {
        const img = document.createElement("img");
        img.src = fileUrl;
        img.alt = fileName;
        img.style.maxWidth = "300px";
        img.style.maxHeight = "300px";
        img.style.borderRadius = "8px";
        img.style.cursor = "pointer";
        img.onclick = () => window.open(fileUrl, "_blank");
        fileDiv.appendChild(img);
    } else if (fileType === "video") {
        const video = document.createElement("video");
        video.src = fileUrl;
        video.controls = true;
        video.style.maxWidth = "400px";
        video.style.maxHeight = "300px";
        video.style.borderRadius = "8px";
        fileDiv.appendChild(video);
    } else {
        // For other files (document, audio, file)
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = fileName;
        link.textContent = `📎 ${fileName} (${formatFileSize(fileSize)})`;
        link.style.color = isCurrentUser ? "#fff" : "#667eea";
        link.style.textDecoration = "underline";
        link.style.fontWeight = "500";
        fileDiv.appendChild(link);
    }

    messageDiv.appendChild(fileDiv);
    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;

    // Show notification for messages from others
    if (!isCurrentUser && sender !== currentUser) {
        showNotificationWithAction(
            `📎 File từ ${sender}`,
            `${fileName} (${formatFileSize(fileSize)})`,
            "📎"
        );
        incrementUnreadCount();
    }
}

function formatFileSize(bytes) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

