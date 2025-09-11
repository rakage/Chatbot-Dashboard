"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSocket } from "@/hooks/useSocket";
import { LastSeenService } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FacebookIcon } from "@/components/ui/facebook-icon";
import { MessageSquare, Search, User, Bot, Circle, RefreshCw } from "lucide-react";

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
  isTyping?: boolean;
}

interface ConversationsListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId?: string;
  isConversationActive?: boolean; // When true, pauses polling to prevent interruptions
}

export default function ConversationsList({
  onSelectConversation,
  selectedConversationId,
  isConversationActive = false,
}: ConversationsListProps) {
  const { data: session } = useSession();
  const { socket, isConnected } = useSocket();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "UNREAD">("ALL");
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [newMessageNotification, setNewMessageNotification] = useState<string | null>(null);
  const [newlyUnreadConversations, setNewlyUnreadConversations] = useState<Set<string>>(new Set());
  const [hasNewUnreadMessages, setHasNewUnreadMessages] = useState(false);
  const [lastSeenMap, setLastSeenMap] = useState<Map<string, Date>>(new Map());
  const [pausePollingForActiveChat, setPausePollingForActiveChat] = useState(false);
  const initializedRef = useRef(false);

  // Load user's last seen timestamps - runs once when user session is available
  useEffect(() => {
    if (session?.user?.id) {
      loadLastSeenData();
    }
  }, [session?.user?.id]);


  const loadLastSeenData = async () => {
    try {
      if (!session?.user?.id) return;
      
      console.log("📊 Loading last seen timestamps for user:", session.user.id);
      const lastSeen = await LastSeenService.getUserLastSeen(session.user.id);
      setLastSeenMap(lastSeen);
      
      console.log("✅ Loaded last seen data:", {
        count: lastSeen.size,
        entries: Array.from(lastSeen.entries()).map(([id, date]) => ({
          conversationId: id,
          lastSeenAt: date.toISOString()
        }))
      });
    } catch (error) {
      console.error("❌ Failed to load last seen data:", error);
    }
  };

  // Manual refresh function 
  const manualRefresh = async () => {
    console.log("🔄 Manual refresh requested");
    
    // Refresh both conversations and last_seen data
    if (session?.user?.id) {
      await loadLastSeenData();
    }
    await fetchConversations(true);
    
    console.log("✅ Manual refresh completed");
  };

  // Polling mechanism for real-time updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    // Only start polling if we have session data loaded or no session (guest mode)
    // AND conversation is not actively being used (to prevent interruptions)
    const shouldPoll = isPolling && !isConversationActive;
    
    if (shouldPoll && !initializedRef.current) {
      // Initial fetch - only once
      fetchConversations();
      initializedRef.current = true;
      
      // Set up polling every 2 seconds
      interval = setInterval(() => {
        console.log("🔄 Polling for conversation updates...");
        fetchConversations(true); // Pass true for silent update
      }, 2000);
      
      console.log("✅ Started polling for real-time updates every 2 seconds");
    } else if (shouldPoll && initializedRef.current) {
      // Already initialized, just set up polling
      interval = setInterval(() => {
        console.log("🔄 Polling for conversation updates...");
        fetchConversations(true); // Pass true for silent update
      }, 2000);
      
      console.log("✅ Resumed polling for real-time updates");
    } else if (isConversationActive) {
      console.log("⏸️ Paused polling - conversation is active");
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
        console.log("🛭 Stopped polling for real-time updates");
      }
    };
  }, [isPolling, isConversationActive]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        console.log("🔔 Notification permission:", permission);
      });
    }
  }, []);
  
  // Update page title with unread count
  useEffect(() => {
    if (totalUnreadCount > 0) {
      document.title = `(${totalUnreadCount}) Facebook Bot Dashboard`;
    } else {
      document.title = "Facebook Bot Dashboard";
    }
    
    return () => {
      document.title = "Facebook Bot Dashboard";
    };
  }, [totalUnreadCount]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("🔌 ConversationsList: Setting up socket event listeners");

    // Listen for conversation read events from other clients or server
    const handleConversationRead = (data: {
      conversationId: string;
      userId: string;
      timestamp: string;
    }) => {
      console.log(`📖 Received conversation:read event for ${data.conversationId} by user ${data.userId}`);
      
      // Update local conversation state to mark as read
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === data.conversationId
            ? { ...conv, unreadCount: 0 }
            : conv
        )
      );

      // Update last seen map if it was the current user
      if (session?.user?.id === data.userId) {
        const readTime = new Date(data.timestamp);
        setLastSeenMap(prev => {
          const updated = new Map(prev);
          updated.set(data.conversationId, readTime);
          return updated;
        });

        // Remove from newly unread conversations
        setNewlyUnreadConversations(prev => {
          const updated = new Set(prev);
          updated.delete(data.conversationId);
          return updated;
        });

        // Update total unread count
        setConversations(currentConversations => {
          const newTotalUnread = currentConversations.reduce(
            (sum, conv) => sum + (conv.id === data.conversationId ? 0 : conv.unreadCount),
            0
          );
          setTotalUnreadCount(newTotalUnread);
          return currentConversations;
        });
      }
    };

    socket.on("conversation:read", handleConversationRead);

    return () => {
      console.log("🔌 ConversationsList: Cleaning up socket event listeners");
      socket.off("conversation:read", handleConversationRead);
    };
  }, [socket, isConnected, session?.user?.id]);

  // Socket connection status display
  useEffect(() => {
    console.log("🔌 ConversationsList: Socket connection status:", {
      isConnected,
      socketExists: !!socket,
      socketId: socket?.id,
    });
  }, [socket, isConnected]);


  const fetchConversations = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      
      const response = await fetch("/api/conversations");

      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }

      const data = await response.json();
      const newConversations = (data.conversations || []).sort(
        (a: ConversationSummary, b: ConversationSummary) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime()
      );
      
      // Check for changes if this is a polling update
      if (silent) {
        setConversations(prevConversations => {
          // Calculate previous and new unread counts
          const prevTotalUnread = prevConversations.reduce((sum: number, conv: ConversationSummary) => sum + conv.unreadCount, 0);
          const newTotalUnread = newConversations.reduce((sum: number, conv: ConversationSummary) => sum + conv.unreadCount, 0);
          
          // Simple comparison to detect changes
          const hasChanges = JSON.stringify(prevConversations) !== JSON.stringify(newConversations);
          
          if (hasChanges) {
            console.log("✨ Detected conversation changes, updating list");
            console.log("Previous conversations:", prevConversations.map(c => ({id: c.id, unread: c.unreadCount})));
            console.log("New conversations:", newConversations.map((c: ConversationSummary) => ({id: c.id, unread: c.unreadCount})));
            console.log("Previous total unread:", prevTotalUnread, "New total unread:", newTotalUnread);
            setLastUpdateTime(new Date());
            
            // Find conversations with new messages based on last_seen timestamps
            const newlyUnread = new Set<string>();
            let newMessagesCount = 0;
            
            newConversations.forEach((conv: ConversationSummary) => {
              const lastMessageTime = new Date(conv.lastMessageAt);
              const lastSeenTime = lastSeenMap.get(conv.id);
              
              // If we don't have a last_seen record or the last message is after last_seen
              if (!lastSeenTime || lastMessageTime > lastSeenTime) {
                newlyUnread.add(conv.id);
                const prevConv = prevConversations.find((p: ConversationSummary) => p.id === conv.id);
                
                // Only count as new if this is a polling update with actual changes
                if (prevConv && new Date(prevConv.lastMessageAt) < lastMessageTime) {
                  newMessagesCount++;
                  console.log(`🔴 New message detected for ${conv.id}: last seen ${lastSeenTime?.toISOString() || 'never'}, message at ${lastMessageTime.toISOString()}`);
                }
              }
            });
            
            setNewlyUnreadConversations(newlyUnread);
            setHasNewUnreadMessages(newlyUnread.size > 0);
            
            // Show notification for genuinely new messages
            if (newMessagesCount > 0) {
              const message = newMessagesCount === 1 ? "1 new message" : `${newMessagesCount} new messages`;
              setNewMessageNotification(message);
              
              // Clear notification after 5 seconds
              setTimeout(() => {
                setNewMessageNotification(null);
              }, 5000);
              
              // Browser notification if supported and permission granted
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Facebook Bot Dashboard", {
                  body: `You have ${message}`,
                  icon: "/favicon.ico",
                  tag: "new-message"
                });
              }
            }
            
            setTotalUnreadCount(newTotalUnread);
            return newConversations;
          } else {
            console.log("💬 No changes detected");
            return prevConversations;
          }
        });
      } else {
        // Initial load - determine newly unread conversations
        const initiallyUnread = new Set<string>();
        newConversations.forEach((conv: ConversationSummary) => {
          const lastMessageTime = new Date(conv.lastMessageAt);
          const lastSeenTime = lastSeenMap.get(conv.id);
          
          if (!lastSeenTime || lastMessageTime > lastSeenTime) {
            initiallyUnread.add(conv.id);
          }
        });
        
        setNewlyUnreadConversations(initiallyUnread);
        setHasNewUnreadMessages(initiallyUnread.size > 0);
        
        setConversations(newConversations);
        setLastUpdateTime(new Date());
        const newTotalUnread = newConversations.reduce((sum: number, conv: ConversationSummary) => sum + conv.unreadCount, 0);
        setTotalUnreadCount(newTotalUnread);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
      // Don't show loading error for silent updates
      if (!silent) {
        // Could show error message to user here
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Helper function to determine if a conversation is truly unread
  const isConversationUnread = (conversation: ConversationSummary) => {
    const lastMessageTime = new Date(conversation.lastMessageAt);
    const lastSeenTime = lastSeenMap.get(conversation.id);
    
    // Use getTime() for more reliable comparison
    const messageTimestamp = lastMessageTime.getTime();
    const seenTimestamp = lastSeenTime ? lastSeenTime.getTime() : 0;
    
    const noLastSeen = !lastSeenTime;
    const messageAfterSeen = messageTimestamp > seenTimestamp;
    const serverUnread = conversation.unreadCount > 0;
    
    const isUnread = noLastSeen || messageAfterSeen || serverUnread;
    
    // Debug logging for troubleshooting
    if (conversation.id && (isUnread || serverUnread)) {
      console.log(`🔍 Unread check for ${conversation.id}:`, {
        lastMessageAt: conversation.lastMessageAt,
        lastMessageTime: lastMessageTime.toISOString(),
        lastSeenTime: lastSeenTime?.toISOString() || 'never',
        messageTimestamp,
        seenTimestamp,
        noLastSeen,
        messageAfterSeen,
        serverUnread,
        timeDiffMs: messageTimestamp - seenTimestamp,
        finalResult: isUnread
      });
    }
    
    return isUnread;
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.psid.includes(searchTerm);

    let matchesFilter = true;
    if (filter === "OPEN") {
      matchesFilter = conv.status === "OPEN";
    } else if (filter === "UNREAD") {
      // Use our last_seen based logic to determine unread status
      matchesFilter = isConversationUnread(conv);
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

    // Immediately update UI state for better UX
    // Clear newly unread status for this conversation
    setNewlyUnreadConversations(prev => {
      const updated = new Set(prev);
      updated.delete(conversationId);
      console.log(`🟢 Removed ${conversationId} from newly unread conversations`);
      return updated;
    });
    
    // Update hasNewUnreadMessages based on remaining newly unread conversations
    setHasNewUnreadMessages(prev => {
      const remainingCount = Array.from(newlyUnreadConversations).filter(id => id !== conversationId).length;
      console.log(`🟢 Remaining newly unread conversations: ${remainingCount}`);
      return remainingCount > 0;
    });

    // Update local last_seen map immediately for instant UI feedback
    const currentTime = new Date();
    setLastSeenMap(prev => {
      const updated = new Map(prev);
      updated.set(conversationId, currentTime);
      console.log(`🟢 Updated local lastSeenMap for ${conversationId}:`, currentTime.toISOString());
      return updated;
    });

    // Force a state update to trigger re-evaluation of all unread statuses
    setLastUpdateTime(new Date());
    
    // Re-evaluate all conversations' unread status with the updated lastSeenMap
    setTimeout(() => {
      const updatedNewlyUnread = new Set<string>();
      conversations.forEach(conv => {
        const lastMessageTime = new Date(conv.lastMessageAt);
        // Use the updated currentTime for this conversation, or existing time for others
        const lastSeenTime = conv.id === conversationId ? currentTime : lastSeenMap.get(conv.id);
        
        if (!lastSeenTime || lastMessageTime > lastSeenTime) {
          updatedNewlyUnread.add(conv.id);
        }
      });
      
      setNewlyUnreadConversations(updatedNewlyUnread);
      setHasNewUnreadMessages(updatedNewlyUnread.size > 0);
      console.log(`🔄 Re-evaluated newly unread conversations:`, Array.from(updatedNewlyUnread));
    }, 50); // Small delay to ensure state updates are processed

    // Update last_seen timestamp in database
    if (session?.user?.id) {
      try {
        await LastSeenService.updateLastSeen(session.user.id, conversationId, currentTime);
        console.log(`✅ Updated database last_seen for conversation ${conversationId}`);
        
      } catch (error) {
        console.error(`❌ Failed to update last_seen for conversation ${conversationId}:`, error);
        // Revert local state if database update failed
        setLastSeenMap(prev => {
          const reverted = new Map(prev);
          const conversation = conversations.find(c => c.id === conversationId);
          if (conversation) {
            const lastMessageTime = new Date(conversation.lastMessageAt);
            // Only keep as unread if message is actually newer than what we tried to set
            if (lastMessageTime > currentTime) {
              reverted.delete(conversationId); // Remove it so it shows as unread again
            } else {
              reverted.set(conversationId, currentTime); // Keep the update
            }
          }
          return reverted;
        });
        
        // Revert newly unread status too
        setNewlyUnreadConversations(prev => {
          const reverted = new Set(prev);
          const conversation = conversations.find(c => c.id === conversationId);
          if (conversation) {
            const lastMessageTime = new Date(conversation.lastMessageAt);
            if (lastMessageTime > currentTime) {
              reverted.add(conversationId);
            }
          }
          return reverted;
        });
      }
    }

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

        // Refresh lastSeenMap to ensure consistency
        if (session?.user?.id) {
          try {
            const refreshedLastSeen = await LastSeenService.getUserLastSeen(session.user.id);
            setLastSeenMap(refreshedLastSeen);
            console.log(`🔄 Refreshed lastSeenMap after marking conversation ${conversationId} as read`);
          } catch (error) {
            console.warn("Failed to refresh lastSeenMap:", error);
          }
        }

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
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0 pb-3 sm:pb-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Conversations</span>
              <span className="sm:hidden">Chats</span>
              {totalUnreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 sm:px-2 py-1 min-w-[18px] sm:min-w-[20px] text-center">
                  {totalUnreadCount}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center space-x-2">
              {isConversationActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={manualRefresh}
                  className="text-xs px-2 py-1 h-6"
                  title="Refresh conversations"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
                {isConnected ? (isConversationActive ? "Paused" : "Live") : "Offline"}
              </Badge>
            </div>
          </div>
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
    <div className="relative">
      {/* New message notification - Responsive overlay */}
      {newMessageNotification && (
        <div 
          className="absolute top-0 left-0 right-0 bg-blue-500 text-white px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-center z-50 rounded-t-lg animate-in slide-in-from-top duration-300 cursor-pointer hover:bg-blue-600 transition-colors shadow-lg"
          onClick={() => setNewMessageNotification(null)}
          title="Click to dismiss"
        >
          <div className="flex items-center justify-center space-x-2">
            <span className="text-base sm:text-lg">🔔</span>
            <span className="truncate max-w-[200px] sm:max-w-none">{newMessageNotification}</span>
            <span className="text-xs opacity-75 ml-2">×</span>
          </div>
        </div>
      )}
      
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0 pb-3 sm:pb-6">
          <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Conversations</span>
            <span className="sm:hidden">Chats</span>
            {totalUnreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 sm:px-2 py-1 min-w-[18px] sm:min-w-[20px] text-center">
                {totalUnreadCount}
              </span>
            )}
          </CardTitle>
            <div className="flex items-center space-x-2">
              {isConversationActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={manualRefresh}
                  className="text-xs px-2 py-1 h-6"
                  title="Refresh conversations"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
                {isConnected ? (isConversationActive ? "Paused" : "Live") : "Offline"}
              </Badge>
            </div>
          </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto">
          {["ALL", "OPEN", "UNREAD"].map((filterOption) => (
            <Button
              key={filterOption}
              variant={filter === filterOption ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterOption as any)}
              className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3"
            >
              <span className="hidden sm:inline">{filterOption}</span>
              <span className="sm:hidden">
                {filterOption === "ALL" ? "All" : filterOption === "OPEN" ? "Open" : "New"}
              </span>
              {filterOption === "UNREAD" && (
                <>
                  {conversations.filter((c) => isConversationUnread(c)).length > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1">
                      {conversations.filter((c) => isConversationUnread(c)).length}
                    </span>
                  )}
                  {hasNewUnreadMessages && (
                    <span className="ml-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  )}
                </>
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
              className={`p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedConversationId === conversation.id
                  ? "bg-blue-50 border-r-2 border-blue-500"
                  : newlyUnreadConversations.has(conversation.id)
                  ? "bg-red-50 border-l-2 border-red-300"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="relative">
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
                    {newlyUnreadConversations.has(conversation.id) && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {conversation.customerName ||
                        `Customer ${conversation.psid.slice(-4)}`}
                    </h4>
                    <div className="flex items-center space-x-1 sm:space-x-2 text-xs text-gray-500">
                      <span className="hidden sm:inline">{conversation.messageCount} messages</span>
                      <span className="sm:inline hidden">•</span>
                      <span>{getTimeAgo(conversation.lastMessageAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <FacebookIcon size={16} className="text-blue-500" />

                  {conversation.unreadCount > 0 && (
                    <div className="flex items-center space-x-1">
                      {newlyUnreadConversations.has(conversation.id) && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      )}
                      <span className={`text-xs font-medium ${
                        newlyUnreadConversations.has(conversation.id) ? 'text-red-600' : 'text-blue-600'
                      }`}>
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

              {/* Typing indicator or last message */}
              {conversation.isTyping ? (
                <div className="flex items-center space-x-2 text-sm">
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-blue-600 text-xs italic">
                    Agent is typing...
                  </span>
                </div>
              ) : conversation.lastMessage ? (
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
              ) : null}
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
    </div>
  );
}
