"use client";

import { useState, use, useCallback, useRef } from "react";
import ConversationsList from "@/components/realtime/ConversationsList";
import ConversationView from "@/components/realtime/ConversationView";

interface ConversationPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const { id } = use(params);
  const [selectedConversationId, setSelectedConversationId] = useState(id);
  const conversationListRef = useRef<{ handleViewUpdate: (data: any) => void } | null>(null);
  
  // Handler for real-time updates from ConversationView
  const handleConversationUpdate = useCallback((data: {
    conversationId: string;
    type: "new_message" | "message_sent" | "bot_status_changed" | "typing_start" | "typing_stop";
    message?: { text: string; role: "USER" | "AGENT" | "BOT"; createdAt: string };
    lastMessageAt?: string;
    autoBot?: boolean;
    timestamp: string;
  }) => {
    console.log("📡 ConversationPage: Received update from ConversationView:", data);
    // Forward the update to ConversationsList if we have a reference
    if (conversationListRef.current && conversationListRef.current.handleViewUpdate) {
      conversationListRef.current.handleViewUpdate(data);
    }
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Live Conversations</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <ConversationsList
            ref={conversationListRef}
            onSelectConversation={setSelectedConversationId}
            selectedConversationId={selectedConversationId}
          />
        </div>

        {/* Conversation View */}
        <div className="lg:col-span-2 relative">
          {selectedConversationId ? (
            <ConversationView 
              conversationId={selectedConversationId} 
              onConversationUpdate={handleConversationUpdate}
            />
          ) : (
            <div className="h-[600px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Select a conversation
                </h3>
                <p className="text-gray-600">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
