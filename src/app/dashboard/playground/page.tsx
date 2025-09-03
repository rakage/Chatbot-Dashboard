"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Send,
  Loader2,
  FileText,
  Search,
  Brain,
  MessageSquare,
  Clock,
  Zap,
  RotateCcw,
  RefreshCw,
} from "lucide-react";

interface PlaygroundMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: {
    sourceDocuments: string[];
    relevantChunks: number;
    query: string;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: {
    hasMemory: boolean;
    memorySize: number;
    hasSummary: boolean;
  };
}

interface RAGSettings {
  temperature: number;
  maxTokens: number;
  searchLimit: number;
  similarityThreshold: number;
}

export default function PlaygroundPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [conversationId] = useState(
    () => `playground-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const [stats, setStats] = useState<{
    totalChunks: number;
    averageTokens: number;
    documentsProcessed: number;
  } | null>(null);

  const [settings, setSettings] = useState<RAGSettings>({
    temperature: 0.3,
    maxTokens: 1000,
    searchLimit: 5,
    similarityThreshold: 0.1, // Lower threshold for testing
  });

  // Check permissions
  useEffect(() => {
    if (
      session?.user?.role &&
      !["OWNER", "ADMIN", "AGENT"].includes(session.user.role)
    ) {
      router.push("/dashboard");
    }
  }, [session, router]);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/rag/chat");
      if (response.ok) {
        const data = await response.json();
        setStats(data.statistics);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: PlaygroundMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      console.log(
        "🧠 Playground: Sending message with conversationId:",
        conversationId
      );
      console.log("🧠 Playground: Message content:", userMessage.content);

      const response = await fetch("/api/rag/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          settings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();

      console.log("🧠 Playground: Received response data:", data);
      console.log("🧠 Playground: Memory metadata:", data.metadata);

      const assistantMessage: PlaygroundMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        context: data.context,
        usage: data.usage,
        metadata: data.metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: PlaygroundMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${
          error instanceof Error ? error.message : "Failed to get response"
        }`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    // Note: We keep the same conversationId to maintain memory across UI clears
    // If you want to start a completely new conversation, use newConversation()
  };

  const newConversation = () => {
    setMessages([]);
    // Create a new conversation ID to start fresh
    window.location.reload();
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Brain className="h-6 w-6 text-purple-600 mr-2" />
              RAG Playground
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Test your AI with document-enhanced responses
            </p>
            <p className="text-gray-400 text-xs mt-1 font-mono">
              Session: {conversationId.split("-").pop()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {stats && (
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-1" />
                  {stats.documentsProcessed} docs
                </div>
                <div className="flex items-center">
                  <Search className="h-4 w-4 mr-1" />
                  {stats.totalChunks} chunks
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={clearChat}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Clear Chat
            </Button>
            <Button variant="outline" size="sm" onClick={newConversation}>
              <RefreshCw className="h-4 w-4 mr-1" />
              New Conversation
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Settings Panel */}
        {showSettings && (
          <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">RAG Settings</CardTitle>
                <CardDescription>
                  Configure retrieval and generation parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label
                    htmlFor="temperature-slider"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Temperature: {settings.temperature}
                  </label>
                  <input
                    id="temperature-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        temperature: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lower = more focused, Higher = more creative
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Tokens
                  </label>
                  <Input
                    type="number"
                    min="100"
                    max="4000"
                    value={settings.maxTokens}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        maxTokens: parseInt(e.target.value) || 1000,
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum response length
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Limit
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.searchLimit}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        searchLimit: parseInt(e.target.value) || 5,
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of document chunks to retrieve
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="threshold-slider"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Similarity Threshold: {settings.similarityThreshold}
                  </label>
                  <input
                    id="threshold-slider"
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={settings.similarityThreshold}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        similarityThreshold: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum similarity for relevant chunks
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Welcome to RAG Playground
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Ask questions about your uploaded documents. The AI will
                  search through your knowledge base and provide accurate,
                  contextual answers.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <MessageSquare className="h-6 w-6 text-blue-600 mb-2" />
                    <h4 className="font-medium mb-1">Ask Questions</h4>
                    <p className="text-sm text-gray-600">
                      "What are the main features mentioned in the product
                      documentation?"
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Search className="h-6 w-6 text-green-600 mb-2" />
                    <h4 className="font-medium mb-1">Get Context</h4>
                    <p className="text-sm text-gray-600">
                      Responses include source documents and relevant context
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-4xl rounded-lg px-4 py-3 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white border shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {message.role === "assistant" && (
                          <Brain className="h-4 w-4 text-purple-600" />
                        )}
                        <span className="text-sm font-medium">
                          {message.role === "user" ? "You" : "AI Assistant"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs opacity-70">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap">{message.content}</div>

                    {/* Memory Indicator */}
                    {message.role === "assistant" && message.metadata && (
                      <div className="mt-2 flex items-center space-x-2">
                        <Badge variant="default" className="text-xs">
                          <Brain className="h-3 w-3 mr-1" />
                          RAG Chat
                        </Badge>
                        {message.metadata.hasMemory && (
                          <Badge variant="secondary" className="text-xs">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Memory ({message.metadata.memorySize} msgs)
                          </Badge>
                        )}
                        {message.metadata.hasSummary && (
                          <Badge variant="outline" className="text-xs">
                            Summary Available
                          </Badge>
                        )}
                      </div>
                    )}

                    {message.context && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {message.context.sourceDocuments.map((doc) => (
                            <Badge
                              key={`${message.id}-${doc}`}
                              variant="secondary"
                              className="text-xs"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {doc}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center space-x-3">
                          <span className="flex items-center">
                            <Search className="h-3 w-3 mr-1" />
                            {message.context.relevantChunks} chunks
                          </span>
                          {message.usage && (
                            <span className="flex items-center">
                              <Zap className="h-3 w-3 mr-1" />
                              {message.usage.totalTokens} tokens
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border shadow-sm rounded-lg px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    <span className="text-sm text-gray-600">
                      AI is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-4">
            <div className="flex space-x-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question about your documents..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="px-6"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
