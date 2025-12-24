package com.example.demo.ws;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class ChatHandler extends TextWebSocketHandler {

    // room -> sessions
    private final Map<String, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();
    private final Map<String, String> sessionRoom = new ConcurrentHashMap<>();
    private final Map<String, String> sessionUser = new ConcurrentHashMap<>();
    private final Map<String, String> sessionAvatar = new ConcurrentHashMap<>();
<<<<<<< HEAD
    private final Map<String, String> sessionIp = new ConcurrentHashMap<>();
    private final Map<String, String> sessionUniqueId = new ConcurrentHashMap<>();
    
    // username -> session for private messaging
=======

    // username -> session (private chat)
>>>>>>> b1a2c8915e2a872e0a850c1497d68b70c9cd7ccc
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();

    // 🔥 LƯU LỊCH SỬ CHAT IN-MEMORY (room -> messages)
    private final Map<String, List<String>> chatHistory = new ConcurrentHashMap<>();
    private static final int MAX_HISTORY = 50;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String[] parts = message.getPayload().split("\\|", 5);
        String type = parts[0];

        // ================= JOIN =================
        if ("JOIN".equals(type)) {
            String room = parts[1];
            String user = parts[2];
            String avatar = parts.length > 3 ? parts[3] : getInitials(user);

            leave(session);

            rooms.putIfAbsent(room, ConcurrentHashMap.newKeySet());
            rooms.get(room).add(session);

            sessionRoom.put(session.getId(), room);
            sessionUser.put(session.getId(), user);
            sessionAvatar.put(session.getId(), avatar);
            
            // Lấy IP address của client
            String clientIp = getClientIp(session);
            sessionIp.put(session.getId(), clientIp);
            
            // Tạo unique ID cho session
            String uniqueId = generateUniqueId(session.getId());
            sessionUniqueId.put(session.getId(), uniqueId);
            
            userSessions.put(user, session);

            broadcast(room, "SYS|" + user + " joined room");
            broadcastUserList(room);
            broadcastRoomList();

            // 🔥 GỬI LỊCH SỬ CHAT CHO USER MỚI
            List<String> history = chatHistory.get(room);
            if (history != null) {
                for (String oldMsg : history) {
                    session.sendMessage(new TextMessage("HISTORY|" + oldMsg));
                }
            }
        }

        // ================= MESSAGE =================
        if ("MSG".equals(type)) {
            String room = sessionRoom.get(session.getId());
            String user = sessionUser.get(session.getId());
            String text = parts[1];

            if (room != null) {
                String msg = "MSG|" + user + "|" + text + "|" + System.currentTimeMillis();

                // 🔥 LƯU LỊCH SỬ CHAT
                chatHistory.putIfAbsent(room, new ArrayList<>());
                List<String> history = chatHistory.get(room);
                history.add(msg);

                // Giới hạn số tin nhắn
                if (history.size() > MAX_HISTORY) {
                    history.remove(0);
                }

                broadcast(room, msg);
            }
        }

        // ================= PRIVATE =================
        if ("PRIVATE".equals(type)) {
            String targetUser = parts[1];
            String text = parts[2];
            String fromUser = sessionUser.get(session.getId());

            WebSocketSession targetSession = userSessions.get(targetUser);
            if (targetSession != null && targetSession.isOpen()) {
                targetSession.sendMessage(
                        new TextMessage("PRIVATE|" + fromUser + "|" + text + "|" + System.currentTimeMillis()));
                session.sendMessage(
                        new TextMessage("PRIVATE_SENT|" + targetUser + "|" + text + "|" + System.currentTimeMillis()));
            }
        }

        // ================= TYPING =================
        if ("TYPING".equals(type)) {
            String room = sessionRoom.get(session.getId());
            String user = sessionUser.get(session.getId());
            if (room != null) {
                broadcastExcept(room, session, "TYPING|" + user);
            }
        }

        // ================= GET ROOMS =================
        if ("GET_ROOMS".equals(type)) {
            sendRoomList(session);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        leave(session);
        super.afterConnectionClosed(session, status);
    }

    private void leave(WebSocketSession session) throws Exception {
        String room = sessionRoom.remove(session.getId());
        String user = sessionUser.remove(session.getId());
        sessionAvatar.remove(session.getId());
<<<<<<< HEAD
        sessionIp.remove(session.getId());
        sessionUniqueId.remove(session.getId());
        
=======

>>>>>>> b1a2c8915e2a872e0a850c1497d68b70c9cd7ccc
        if (user != null) {
            userSessions.remove(user);
        }

        if (room != null && rooms.containsKey(room)) {
            rooms.get(room).remove(session);

            if (user != null) {
                broadcast(room, "SYS|" + user + " left room");
                broadcastUserList(room);
            }

            // 🔥 XÓA PHÒNG + LỊCH SỬ NẾU RỖNG
            if (rooms.get(room).isEmpty()) {
                rooms.remove(room);
                chatHistory.remove(room);
            }

            broadcastRoomList();
        }
    }

    private void broadcast(String room, String msg) throws Exception {
        Set<WebSocketSession> roomSessions = rooms.get(room);
        if (roomSessions != null) {
            for (WebSocketSession s : roomSessions) {
                if (s.isOpen()) {
                    s.sendMessage(new TextMessage(msg));
                }
            }
        }
    }

    private void broadcastExcept(String room, WebSocketSession except, String msg) throws Exception {
        Set<WebSocketSession> roomSessions = rooms.get(room);
        if (roomSessions != null) {
            for (WebSocketSession s : roomSessions) {
                if (s.isOpen() && !s.getId().equals(except.getId())) {
                    s.sendMessage(new TextMessage(msg));
                }
            }
        }
    }

    private void broadcastUserList(String room) throws Exception {
        Set<WebSocketSession> roomSessions = rooms.get(room);
        if (roomSessions == null) return;

        List<Map<String, String>> users = roomSessions.stream()
<<<<<<< HEAD
            .filter(WebSocketSession::isOpen)
            .map(s -> {
                Map<String, String> user = new HashMap<>();
                user.put("username", sessionUser.get(s.getId()));
                user.put("avatar", sessionAvatar.get(s.getId()));
                user.put("ip", sessionIp.get(s.getId()));
                user.put("uniqueId", sessionUniqueId.get(s.getId()));
                return user;
            })
            .collect(Collectors.toList());
=======
                .filter(WebSocketSession::isOpen)
                .map(s -> {
                    Map<String, String> user = new HashMap<>();
                    user.put("username", sessionUser.get(s.getId()));
                    user.put("avatar", sessionAvatar.get(s.getId()));
                    return user;
                })
                .collect(Collectors.toList());
>>>>>>> b1a2c8915e2a872e0a850c1497d68b70c9cd7ccc

        String userListJson = objectMapper.writeValueAsString(users);
        broadcast(room, "USERS|" + userListJson);
    }

    private void broadcastRoomList() throws Exception {
        List<Map<String, Object>> roomList = rooms.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> roomInfo = new HashMap<>();
                    roomInfo.put("name", entry.getKey());
                    roomInfo.put("count", entry.getValue().size());
                    return roomInfo;
                })
                .collect(Collectors.toList());

        String roomListJson = objectMapper.writeValueAsString(roomList);

        for (WebSocketSession s : userSessions.values()) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage("ROOMS|" + roomListJson));
            }
        }
    }

    private void sendRoomList(WebSocketSession session) throws Exception {
        List<Map<String, Object>> roomList = rooms.entrySet().stream()
                .map(entry -> {
                    Map<String, Object> roomInfo = new HashMap<>();
                    roomInfo.put("name", entry.getKey());
                    roomInfo.put("count", entry.getValue().size());
                    return roomInfo;
                })
                .collect(Collectors.toList());

        String roomListJson = objectMapper.writeValueAsString(roomList);
        if (session.isOpen()) {
            session.sendMessage(new TextMessage("ROOMS|" + roomListJson));
        }
    }

    private String getInitials(String name) {
        if (name == null || name.isEmpty()) return "?";
        String[] parts = name.trim().split("\\s+");
        if (parts.length >= 2) {
            return (parts[0].charAt(0) + "" + parts[1].charAt(0)).toUpperCase();
        }
        return name.substring(0, Math.min(2, name.length())).toUpperCase();
    }
    
    private String getClientIp(WebSocketSession session) {
        try {
            // Lấy IP từ RemoteAddress
            if (session.getRemoteAddress() != null && session.getRemoteAddress().getAddress() != null) {
                return session.getRemoteAddress().getAddress().getHostAddress();
            }
        } catch (Exception e) {
            // Nếu không lấy được, trả về unknown
        }
        return "Unknown";
    }
    
    private String generateUniqueId(String sessionId) {
        // Tạo ID ngắn từ 6 ký tự cuối của session ID
        if (sessionId.length() >= 6) {
            return sessionId.substring(sessionId.length() - 6).toUpperCase();
        }
        return sessionId.substring(0, Math.min(6, sessionId.length())).toUpperCase();
    }
}
