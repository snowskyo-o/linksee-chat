import { io } from "socket.io-client";
import { chatApi } from "../../shared/api-client.js";

export function useChatRealtime(auth, selectedIdRef, conversationsRef, socketOnlineRef, onRealtimeEvent) {
  let socket = null;
  const lastEventIdByRoom = new Map();

  function currentRoomKey() {
    const conversation = (conversationsRef.value || []).find((item) => item.id === selectedIdRef.value);
    return conversation?.id || "";
  }

  async function replayRoom(room) {
    if (!room) return;
    const afterEventId = lastEventIdByRoom.get(room) || "";
    const payload = await chatApi.getJson(`/api/v1/realtime/replay?room=${encodeURIComponent(room)}${afterEventId ? `&afterEventId=${encodeURIComponent(afterEventId)}` : ""}`);
    const events = Array.isArray(payload.data) ? payload.data : [];
    for (const event of events) {
      if (event?.id) {
        lastEventIdByRoom.set(room, event.id);
      }
      await onRealtimeEvent(event);
      if (event?.id) {
        await chatApi.postJson("/api/v1/realtime/acks", {
          roomKey: room,
          eventId: event.id,
          messageId: event.payload?.messageId || "",
        }).catch(() => {});
      }
    }
  }

  function connect() {
    if (!auth.token) return;
    socket = io(chatApi.getApiBaseUrl(), {
      transports: ["websocket", "polling"],
      auth: { token: auth.token },
    });

    socket.on("connect", () => {
      socketOnlineRef.value = true;
      if (selectedIdRef.value) {
        socket.emit("conversation.join", selectedIdRef.value);
        replayRoom(currentRoomKey()).catch(() => {});
      }
    });

    socket.on("disconnect", () => {
      socketOnlineRef.value = false;
    });

    socket.on("realtime:event", (event) => {
      const room = String(event?.payload?.conversationId || "");
      if (event?.id && room) {
        lastEventIdByRoom.set(room, event.id);
      }
      Promise.resolve(onRealtimeEvent(event)).catch(() => {});
      if (event?.id && room) {
        chatApi.postJson("/api/v1/realtime/acks", {
          roomKey: room,
          eventId: event.id,
          messageId: event.payload?.messageId || "",
        }).catch(() => {});
      }
    });
  }

  function joinSelectedConversation() {
    if (socket && socket.connected && selectedIdRef.value) {
      socket.emit("conversation.join", selectedIdRef.value);
      replayRoom(currentRoomKey()).catch(() => {});
    }
  }

  return {
    connect,
    joinSelectedConversation,
  };
}
