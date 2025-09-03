"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";

interface UseSocketOptions {
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = { autoConnect: true }) {
  const { data: session, status } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user || !options.autoConnect) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection
    const newSocket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin,
      {
        transports: ["websocket", "polling"],
        forceNew: true,
      }
    );

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server");
      setIsConnected(true);
      setError(null);
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setError(error.message);
      setIsConnected(false);
    });

    newSocket.on("error", (error) => {
      console.error("Socket error:", error);
      setError(error.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [session, status, options.autoConnect]);

  const joinConversation = (conversationId: string) => {
    if (socket) {
      socket.emit("join:conversation", conversationId);
    }
  };

  const leaveConversation = (conversationId: string) => {
    if (socket) {
      socket.emit("leave:conversation", conversationId);
    }
  };

  const sendTyping = (conversationId: string, isTyping: boolean) => {
    if (socket) {
      socket.emit(isTyping ? "typing:start" : "typing:stop", {
        conversationId,
      });
    }
  };

  const updatePresence = (status: "online" | "away" | "offline") => {
    if (socket) {
      socket.emit("presence:update", status);
    }
  };

  return {
    socket,
    isConnected,
    error,
    joinConversation,
    leaveConversation,
    sendTyping,
    updatePresence,
  };
}
