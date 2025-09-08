"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FacebookIcon } from "@/components/ui/facebook-icon";
import { MessageSquare, Search, User, Bot, Circle } from "lucide-react";

interface ConversationSummary {
  id: string;
  psid: string;
  status: "OPEN" | "SNOOZED" | "CLOSED";
  autoBot: boolean;
  customerName?: string;
  customerProfile?: {
    firstName: string;
    lastName: string;
    fullName: string;
    profilePicture?: string;
  } | null;
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  lastMessage?: {
    text: string;
    role: "USER" | "AGENT" | "BOT";
  };
}

interface ConversationsListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId?: string;
}

export default function ConversationsList({
  onSelectConversation,
  selectedConversationId,
}: ConversationsListProps) {
  const { socket, isConnected } = useSocket();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "UNREAD">("ALL");

  // Fetch conversations
  useEffect(() => {
    fetchConversations();
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    console.log("🔌 Setting up socket event listeners for conversations");

    // Listen for new conversations
    socket.on(
      "conversation:new",
      (data: { conversation: ConversationSummary }) => {
        console.log("📥 Received conversation:new event:", data);
        setConversations((prev) => {
          // Check if conversation already exists
          const exists = prev.find((conv) => conv.id === data.conversation.id);
          if (exists) {
            return prev;
          }
          // Add new conversation to the top of the list
          return [data.conversation, ...prev];
        });
      }
    );

    // Listen for conversation updates
    socket.on(
      "conversation:updated",
      (data: {
        conversationId: string;
        lastMessageAt: string;
        messageCount: number;
      }) => {
        console.log("📥 Received conversation:updated event:", data);
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === data.conversationId
              ? {
                  ...conv,
                  lastMessageAt: data.lastMessageAt,
                  messageCount: data.messageCount,
                  unreadCount: conv.unreadCount + 1,
                }
              : conv
          )
        );
      }
    );

    // Listen for new messages to update last message preview
    socket.on(
      "message:new",
      (data: {
        message: {
          text: string;
          role: "USER" | "AGENT" | "BOT";
          conversationId?: string;
        };
        conversation: { id: string };
      }) => {
        console.log("📥 ConversationsList: Received message:new event:", data);
        console.log(
          "📥 ConversationsList: Current conversations count:",
          conversations.length
        );
        setConversations((prev) => {
          const updated = prev.map((conv) =>
            conv.id === data.conversation.id
              ? {
                  ...conv,
                  lastMessage: {
                    text: data.message.text,
                    role: data.message.role,
                  },
                  lastMessageAt: new Date().toISOString(),
                  unreadCount:
                    selectedConversationId === conv.id
                      ? conv.unreadCount
                      : conv.unreadCount + 1,
                }
              : conv
          );

          const foundConversation = updated.find(
            (conv) => conv.id === data.conversation.id
          );
          if (foundConversation) {
            console.log(
              `✅ ConversationsList: Updated conversation ${data.conversation.id} with new message`
            );
          } else {
            console.log(
              `⚠️ ConversationsList: Conversation ${data.conversation.id} not found in list`
            );
          }

          return updated;
        });
      }
    );

    // Listen for conversation read events from other clients
    socket.on(
      "conversation:read",
      (data: { conversationId: string; timestamp: string }) => {
        console.log("📥 Received conversation:read event:", data);
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === data.conversationId ? { ...conv, unreadCount: 0 } : conv
          )
        );
      }
    );

    return () => {
      console.log("🔌 Cleaning up socket event listeners");
      socket.off("conversation:new");
      socket.off("conversation:updated");
      socket.off("message:new");
      socket.off("conversation:read");
    };
  }, [socket, selectedConversationId]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/conversations");

      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.psid.includes(searchTerm);

    let matchesFilter = true;
    if (filter === "OPEN") {
      matchesFilter = conv.status === "OPEN";
    } else if (filter === "UNREAD") {
      matchesFilter = conv.unreadCount > 0;
    }

    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-green-100 text-green-800";
      case "SNOOZED":
        return "bg-yellow-100 text-yellow-800";
      case "CLOSED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else {
      return `${diffDays}d`;
    }
  };

  const handleConversationClick = async (conversationId: string) => {
    onSelectConversation(conversationId);

    // Mark as read in local state immediately for better UX
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      )
    );

    // Mark as read on server and emit socket event
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "mark_read",
        }),
      });

      if (response.ok) {
        console.log(`✅ Conversation ${conversationId} marked as read`);

        // Emit socket event to notify other clients
        if (socket) {
          socket.emit("conversation:read", {
            conversationId,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        console.error(
          `❌ Failed to mark conversation ${conversationId} as read`
        );
        // Revert local state if server update failed
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId ? { ...conv, unreadCount: 1 } : conv
          )
        );
      }
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      // Revert local state if request failed
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, unreadCount: 1 } : conv
        )
      );
    }
  };

  if (loading) {
    return (
      <Card className="h-[600px]">
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading conversations...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Conversations</span>
          </CardTitle>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Live" : "Offline"}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex space-x-2">
          {["ALL", "OPEN", "UNREAD"].map((filterOption) => (
            <Button
              key={filterOption}
              variant={filter === filterOption ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterOption as any)}
            >
              {filterOption}
              {filterOption === "UNREAD" &&
                conversations.filter((c) => c.unreadCount > 0).length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">
                    {conversations.filter((c) => c.unreadCount > 0).length}
                  </span>
                )}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 max-h-[500px] overflow-y-auto p-0">
        <div className="divide-y">
          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => handleConversationClick(conversation.id)}
              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedConversationId === conversation.id
                  ? "bg-blue-50 border-r-2 border-blue-500"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8">
                    {conversation.customerProfile?.profilePicture ? (
                      <img
                        src={conversation.customerProfile.profilePicture}
                        alt={conversation.customerProfile.fullName}
                        className="w-8 h-8 rounded-full border-2 border-blue-500 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center border-2 border-blue-500">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">
                      {conversation.customerName ||
                        `Customer ${conversation.psid.slice(-4)}`}
                    </h4>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{conversation.messageCount} messages</span>
                      <span>•</span>
                      <span>{getTimeAgo(conversation.lastMessageAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <FacebookIcon size={16} className="text-blue-500" />

                  {conversation.unreadCount > 0 && (
                    <div className="flex items-center space-x-1">
                      <Circle className="h-2 w-2 text-blue-600 fill-current" />
                      <span className="text-xs text-blue-600 font-medium">
                        {conversation.unreadCount}
                      </span>
                    </div>
                  )}

                  {conversation.autoBot && (
                    <Bot className="h-3 w-3 text-purple-600" />
                  )}

                  <Badge
                    className={`text-xs ${getStatusColor(conversation.status)}`}
                  >
                    {conversation.status}
                  </Badge>
                </div>
              </div>

              {conversation.lastMessage && (
                <div className="flex items-center space-x-2 text-sm">
                  {conversation.lastMessage.role === "USER" ? (
                    <User className="h-3 w-3 text-blue-600" />
                  ) : conversation.lastMessage.role === "BOT" ? (
                    <Bot className="h-3 w-3 text-purple-600" />
                  ) : (
                    <MessageSquare className="h-3 w-3 text-green-600" />
                  )}
                  <span className="text-gray-600 truncate">
                    {conversation.lastMessage.text}
                  </span>
                </div>
              )}
            </div>
          ))}

          {filteredConversations.length === 0 && (
            <div className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No conversations found
              </h3>
              <p className="text-gray-600">
                {searchTerm || filter !== "ALL"
                  ? "Try adjusting your search or filters."
                  : "Conversations will appear here when customers message your bot."}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
