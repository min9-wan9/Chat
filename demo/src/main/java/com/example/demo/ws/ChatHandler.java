package com.example.demo.ws;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatHandler extends TextWebSocketHandler {

    // room -> sessions
    private final Map<String, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();
    private final Map<String, String> sessionRoom = new ConcurrentHashMap<>();
    private final Map<String, String> sessionUser = new ConcurrentHashMap<>();

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String[] parts = message.getPayload().split("\\|", 3);
        String type = parts[0];

        if ("JOIN".equals(type)) {
            String room = parts[1];
            String user = parts[2];

            leave(session);

            rooms.putIfAbsent(room, ConcurrentHashMap.newKeySet());
            rooms.get(room).add(session);
            sessionRoom.put(session.getId(), room);
            sessionUser.put(session.getId(), user);

            broadcast(room, "SYS|" + user + " joined room");
        }

        if ("MSG".equals(type)) {
            String room = sessionRoom.get(session.getId());
            String user = sessionUser.get(session.getId());
            if (room != null) {
                broadcast(room, "MSG|" + user + "|" + parts[1]);
            }
        }
    }

    private void leave(WebSocketSession session) throws Exception {
        String room = sessionRoom.remove(session.getId());
        String user = sessionUser.remove(session.getId());
        if (room != null) {
            rooms.get(room).remove(session);
            broadcast(room, "SYS|" + user + " left room");
        }
    }

    private void broadcast(String room, String msg) throws Exception {
        for (WebSocketSession s : rooms.get(room)) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(msg));
            }
        }
    }
}
