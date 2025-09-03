"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FacebookIcon } from "@/components/ui/facebook-icon";
import {
  User,
  Bot,
  Send,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Info,
} from "lucide-react";
import CustomerInfoSidebar from "./CustomerInfoSidebar";

interface Message {
  id: string;
  text: string;
  role: "USER" | "AGENT" | "BOT";
  createdAt: string;
  meta?: any;
}

interface CustomerProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  profilePicture?: string;
  locale: string;
  facebookUrl: string;
  cached?: boolean;
  error?: string;
}

interface Conversation {
  id: string;
  psid: string;
  status: "OPEN" | "SNOOZED" | "CLOSED";
  autoBot: boolean;
  customerName?: string;
  customerProfile?: CustomerProfile;
  messages: Message[];
  notes?: string;
  tags?: string[];
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
}

interface ConversationViewProps {
  readonly conversationId: string;
  readonly initialConversation?: Conversation;
}

export default function ConversationView({
  conversationId,
  initialConversation,
}: ConversationViewProps) {
  const {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
    sendTyping,
  } = useSocket();
  const [conversation, setConversation] = useState<Conversation | null>(
    initialConversation || null
  );
  const [messages, setMessages] = useState<Message[]>(
    initialConversation?.messages || []
  );
  const [customerProfile, setCustomerProfile] =
    useState<CustomerProfile | null>(
      initialConversation?.customerProfile || null
    );
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState<string[]>([]);
  const [loading, setLoading] = useState(!initialConversation);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch conversation data if not provided
  useEffect(() => {
    if (!initialConversation && conversationId) {
      fetchConversation();
    }
  }, [conversationId, initialConversation]);

  // Fetch customer profile
  useEffect(() => {
    if (conversationId && !customerProfile && !profileLoading) {
      fetchCustomerProfile();
    }
  }, [conversationId, customerProfile, profileLoading]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !conversationId) return;

    console.log(
      `🔌 ConversationView: Setting up socket for conversation ${conversationId}`
    );

    // Join conversation room
    joinConversation(conversationId);

    // Listen for new messages
    socket.on(
      "message:new",
      (data: { message: Message; conversation: any }) => {
        console.log(
          `📥 ConversationView: Received message:new for conversation ${conversationId}`,
          data
        );

        // Only add message if it belongs to this conversation
        if (data.conversation?.id === conversationId) {
          setMessages((prev) => {
            // Check if message already exists (either by ID or as optimistic message)
            const exists = prev.find(
              (msg) =>
                msg.id === data.message.id ||
                (msg.id.startsWith("temp-") &&
                  msg.text === data.message.text &&
                  msg.role === data.message.role)
            );
            if (exists) {
              console.log(
                `⚠️ Message ${data.message.id} already exists or is optimistic, updating instead of adding`
              );
              // Update the existing message instead of adding duplicate
              return prev.map((msg) =>
                msg.id === exists.id ? { ...data.message } : msg
              );
            }
            console.log(
              `✅ Adding new message ${data.message.id} to conversation`
            );
            return [...prev, data.message];
          });

          // Update conversation if provided
          if (data.conversation) {
            setConversation((prev) =>
              prev ? { ...prev, ...data.conversation } : null
            );
          }
        } else {
          console.log(
            `⚠️ Message not for this conversation (expected ${conversationId}, got ${data.conversation?.id})`
          );
        }
      }
    );

    // Listen for message delivery confirmations
    socket.on(
      "message:sent",
      (data: {
        messageId: string;
        facebookMessageId: string;
        sentAt: string;
      }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId
              ? {
                  ...msg,
                  meta: { ...msg.meta, sent: true, sentAt: data.sentAt },
                }
              : msg
          )
        );
      }
    );

    // Listen for typing indicators
    socket.on(
      "typing:start",
      (data: { userId: string; conversationId: string }) => {
        setOtherTyping((prev) => [
          ...prev.filter((id) => id !== data.userId),
          data.userId,
        ]);
      }
    );

    socket.on(
      "typing:stop",
      (data: { userId: string; conversationId: string }) => {
        setOtherTyping((prev) => prev.filter((id) => id !== data.userId));
      }
    );

    // Listen for errors
    socket.on("error", (data: { message: string }) => {
      setError(data.message);
    });

    return () => {
      console.log(
        `🔌 ConversationView: Cleaning up socket for conversation ${conversationId}`
      );
      leaveConversation(conversationId);
      socket.off("message:new");
      socket.off("message:sent");
      socket.off("typing:start");
      socket.off("typing:stop");
      socket.off("error");
    };
  }, [socket, conversationId, joinConversation, leaveConversation]);

  const fetchConversation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/conversations/${conversationId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch conversation");
      }

      const data = await response.json();
      setConversation(data.conversation);
      setMessages(data.messages || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversation"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerProfile = async () => {
    try {
      setProfileLoading(true);
      const response = await fetch(
        `/api/conversations/${conversationId}/customer-profile`
      );

      if (!response.ok) {
        console.warn("Failed to fetch customer profile, using fallback");
        return;
      }

      const data = await response.json();
      setCustomerProfile(data.profile);
    } catch (err) {
      console.error("Error fetching customer profile:", err);
      // Use fallback profile
      if (conversation?.psid) {
        setCustomerProfile({
          id: conversation.psid,
          firstName: "Customer",
          lastName: `#${conversation.psid.slice(-4)}`,
          fullName: `Customer #${conversation.psid.slice(-4)}`,
          locale: "en_US",
          facebookUrl: `https://www.facebook.com/${conversation.psid}`,
          error: "Profile fetch failed",
        });
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleToggleBot = async () => {
    if (!conversation?.id) return;

    const newAutoBotStatus = !conversation.autoBot;

    // Optimistically update UI
    setConversation((prev) =>
      prev ? { ...prev, autoBot: newAutoBotStatus } : null
    );

    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/bot-settings`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            autoBot: newAutoBotStatus,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update bot settings");
      }

      console.log(
        `🤖 Auto bot ${
          newAutoBotStatus ? "enabled" : "disabled"
        } for conversation ${conversation.id}`
      );
    } catch (error) {
      console.error("Failed to update bot settings:", error);
      // Revert optimistic update
      setConversation((prev) =>
        prev ? { ...prev, autoBot: !newAutoBotStatus } : null
      );
      setError("Failed to update bot settings. Please try again.");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    // Add message optimistically to UI
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      text: messageText,
      role: "AGENT",
      createdAt: new Date().toISOString(),
      meta: { sending: true },
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          text: messageText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send message");
      }

      const data = await response.json();

      // Update the optimistic message with real data
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticMessage.id
            ? {
                ...data.message,
                meta: { ...data.message.meta, sent: true },
              }
            : msg
        )
      );

      console.log(
        `✅ Updated optimistic message ${optimisticMessage.id} with real message ${data.message.id}`
      );

      // Stop typing indicator
      if (isTyping) {
        setIsTyping(false);
        sendTyping(conversationId, false);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove the failed message and show error
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== optimisticMessage.id)
      );
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing if not already
    if (!isTyping && value.trim()) {
      setIsTyping(true);
      sendTyping(conversationId, true);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        sendTyping(conversationId, false);
      }
    }, 3000);
  };

  const handleNotesUpdate = (notes: string) => {
    setConversation((prev) => (prev ? { ...prev, notes } : null));
  };

  const handleTagsUpdate = (tags: string[]) => {
    setConversation((prev) => (prev ? { ...prev, tags } : null));
  };

  const handleContactUpdate = (
    field: "email" | "phone" | "address",
    value: string
  ) => {
    setConversation((prev) => {
      if (!prev) return null;
      const updateField =
        field === "email"
          ? "customerEmail"
          : field === "phone"
          ? "customerPhone"
          : "customerAddress";
      return { ...prev, [updateField]: value };
    });
  };

  const getMessageBgColor = (role: string) => {
    switch (role) {
      case "USER":
        return "bg-blue-100 text-blue-900";
      case "BOT":
        return "bg-purple-100 text-purple-900";
      default:
        return "bg-green-100 text-green-900";
    }
  };

  const getMessageIcon = (role: string, meta?: any) => {
    switch (role) {
      case "USER":
        return <User className="h-4 w-4 text-blue-600" />;
      case "BOT":
        return <Bot className="h-4 w-4 text-purple-600" />;
      case "AGENT":
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading conversation...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchConversation}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative">
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Customer Profile Section */}
              <div className="flex items-center space-x-2">
                {customerProfile?.profilePicture ? (
                  <img
                    src={customerProfile.profilePicture}
                    alt={customerProfile.fullName}
                    className="w-8 h-8 rounded-full border-2 border-blue-500"
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center border-2 border-blue-500">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                )}
                <div className="flex flex-col">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    {customerProfile ? (
                      <a
                        href={customerProfile.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 transition-colors flex items-center space-x-1"
                      >
                        <span>{customerProfile.fullName}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : profileLoading ? (
                      <span className="text-sm text-gray-500">
                        Loading profile...
                      </span>
                    ) : (
                      <span>
                        {conversation?.customerName ||
                          `Customer ${conversation?.psid?.slice(-4)}`}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <FacebookIcon size={12} className="text-blue-500" />
                    <span>Facebook</span>
                    {customerProfile?.error && (
                      <span className="text-red-500">
                        • Profile unavailable
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Auto Bot:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={conversation?.autoBot || false}
                    onChange={handleToggleBot}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              <Badge
                variant={
                  conversation?.status === "OPEN" ? "default" : "secondary"
                }
              >
                {conversation?.status}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-2"
              >
                <Info className="h-4 w-4" />
                Customer Info
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <ScrollArea className="flex-1 max-h-[400px] p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-start space-x-3 justify-start"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getMessageIcon(message.role, message.meta)}
                  </div>
                  <div className="flex-1 max-w-xs lg:max-w-md">
                    <div
                      className={`p-3 rounded-lg ${getMessageBgColor(
                        message.role
                      )}`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {formatTime(message.createdAt)}
                      </span>
                      {message.meta?.sent && (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      )}
                      {message.role === "BOT" && message.meta?.model && (
                        <span className="text-xs text-gray-400">
                          {message.meta.model}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicators */}
              {otherTyping.length > 0 && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-xs">Someone is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message input */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={!isConnected}
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || !isConnected}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {!isConnected && (
              <p className="text-xs text-red-600 mt-1">
                Disconnected from real-time updates
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customer Info Sidebar */}
      <CustomerInfoSidebar
        conversationId={conversationId}
        customerProfile={customerProfile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        notes={conversation?.notes || ""}
        tags={conversation?.tags || []}
        customerEmail={conversation?.customerEmail}
        customerPhone={conversation?.customerPhone}
        customerAddress={conversation?.customerAddress}
        onNotesUpdate={handleNotesUpdate}
        onTagsUpdate={handleTagsUpdate}
        onContactUpdate={handleContactUpdate}
      />
    </div>
  );
}
