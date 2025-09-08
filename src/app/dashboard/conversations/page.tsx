"use client";

import { useState } from "react";
import ConversationsList from "@/components/realtime/ConversationsList";
import ConversationView from "@/components/realtime/ConversationView";
import { MessageSquare } from "lucide-react";

export default function ConversationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [conversationListRef, setConversationListRef] = useState<any>(null);
  
  // Handler for real-time updates from ConversationView
  const handleConversationUpdate = (data: {
    conversationId: string;
    type: "new_message" | "message_sent" | "bot_status_changed" | "typing_start" | "typing_stop";
    message?: { text: string; role: "USER" | "AGENT" | "BOT"; createdAt: string };
    lastMessageAt?: string;
    autoBot?: boolean;
    timestamp: string;
  }) => {
    console.log("📡 ConversationsPage: Received update from ConversationView:", data);
    // Forward the update to ConversationsList if we have a reference
    if (conversationListRef && conversationListRef.handleViewUpdate) {
      conversationListRef.handleViewUpdate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="lg:col-span-1">
          <ConversationsList
            ref={setConversationListRef}
            onSelectConversation={setSelectedConversationId}
            selectedConversationId={selectedConversationId || undefined}
          />
        </div>

        {/* Conversation View */}
        <div className="lg:col-span-2">
          {selectedConversationId ? (
            <ConversationView 
              conversationId={selectedConversationId} 
              onConversationUpdate={handleConversationUpdate}
            />
          ) : (
            <div className="h-[600px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
