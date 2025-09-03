import { GoogleGenerativeAI } from "@google/generative-ai";
import EmbeddingService from "./embeddings";
import VectorService, { VectorMatch } from "./supabase";
import { db } from "./db";
import { llmService } from "./llm/service";
import { decrypt } from "./encryption";
import type { ProviderConfig } from "./llm/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ConversationMemory {
  messages: ChatMessage[];
  summary?: string;
  lastUpdated: Date;
}

export interface RAGChatResponse {
  response: string;
  context: {
    relevantChunks: VectorMatch[];
    sourceDocuments: string[];
    conversationContext: string;
    query: string;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  memory: ConversationMemory;
}

export class RAGChatbot {
  private static readonly GEMINI_MODEL = "gemini-1.5-flash";
  private static readonly MAX_CONTEXT_LENGTH = 8000;
  private static readonly MAX_MEMORY_MESSAGES = 10; // Keep last 10 messages in memory
  private static readonly MEMORY_SUMMARY_THRESHOLD = 8; // Summarize when more than 8 messages

  /**
   * Generate a RAG response with conversation memory
   */
  static async generateResponse(
    query: string,
    companyId: string,
    conversationId?: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      searchLimit?: number;
      similarityThreshold?: number;
      documentIds?: string[];
      systemPrompt?: string;
      providerConfig?: any; // Full provider config from database
    } = {}
  ): Promise<RAGChatResponse> {
    try {
      console.log("🧠 RAGChatbot: Starting generateResponse");
      console.log("🧠 RAGChatbot: conversationId:", conversationId);
      console.log("🧠 RAGChatbot: companyId:", companyId);
      console.log("🧠 RAGChatbot: query:", query);

      const searchLimit = options.searchLimit || 5;
      const threshold = options.similarityThreshold || 0.7;
      const temperature = options.temperature || 0.7;
      const maxTokens = options.maxTokens || 1000;

      // 1. Load conversation memory
      console.log("🧠 RAGChatbot: Loading conversation memory...");
      const memory = await this.loadConversationMemory(conversationId);
      console.log("🧠 RAGChatbot: Loaded memory:", {
        messageCount: memory.messages.length,
        hasSummary: !!memory.summary,
        summary: memory.summary,
        messages: memory.messages.map((m) => ({
          role: m.role,
          content: m.content.substring(0, 50) + "...",
        })),
      });

      // 2. Add current user message to memory
      const userMessage: ChatMessage = {
        role: "user",
        content: query,
        timestamp: new Date(),
      };
      memory.messages.push(userMessage);

      // 3. Generate embedding for the query
      const queryEmbedding = await EmbeddingService.generateEmbedding(query);

      // 4. Search for relevant documents
      console.log(
        `🔍 RAG: Searching for "${query}" with ${searchLimit} results, threshold ${threshold}`
      );

      let relevantChunks: VectorMatch[] = [];
      try {
        relevantChunks = await VectorService.searchSimilar(
          queryEmbedding.embedding,
          companyId,
          searchLimit,
          threshold
        );
        console.log(`✅ RAG: Found ${relevantChunks.length} relevant chunks`);
      } catch (error) {
        console.error("❌ RAG: Vector search failed:", error);
        // Continue without document context
      }

      // 5. Build conversation context from memory
      console.log("🧠 RAGChatbot: Building conversation context...");
      const conversationContext = this.buildConversationContext(memory);

      // 6. Build document context
      console.log("🧠 RAGChatbot: Building document context...");
      const documentContext = this.buildDocumentContext(relevantChunks);

      console.log("🧠 RAGChatbot: Context summary:", {
        conversationContextLength: conversationContext.length,
        documentContextLength: documentContext.length,
        totalContextLength: conversationContext.length + documentContext.length,
      });

      // 7. Generate response with configured LLM provider
      console.log(
        "🧠 RAGChatbot: Generating response with configured LLM provider..."
      );
      const response = await this.generateWithLLM(
        query,
        conversationContext,
        documentContext,
        temperature,
        maxTokens,
        options.systemPrompt,
        options.providerConfig
      );

      // 8. Add assistant response to memory
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      memory.messages.push(assistantMessage);

      // 9. Manage memory (summarize if needed, keep recent messages)
      const updatedMemory = await this.manageMemory(memory, conversationId);

      // 10. Save memory if conversationId provided
      if (conversationId) {
        await this.saveConversationMemory(conversationId, updatedMemory);
      }

      const finalResponse = {
        response,
        context: {
          relevantChunks,
          sourceDocuments: Array.from(
            new Set(
              relevantChunks.map(
                (chunk) =>
                  (chunk.metadata as any)?.documentName || "Unknown Document"
              )
            )
          ),
          conversationContext,
          query,
        },
        usage: {
          promptTokens: this.estimateTokens(
            conversationContext + documentContext + query
          ),
          completionTokens: this.estimateTokens(response),
          totalTokens: this.estimateTokens(
            conversationContext + documentContext + query + response
          ),
        },
        memory: updatedMemory,
      };

      console.log("🧠 RAGChatbot: Final response:", {
        responseLength: response.length,
        memorySize: updatedMemory.messages.length,
        hasSummary: !!updatedMemory.summary,
        contextLength: finalResponse.context.conversationContext.length,
      });

      return finalResponse;
    } catch (error) {
      console.error("RAG Chatbot error:", error);
      throw new Error(
        `Failed to generate RAG response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Load conversation memory from database or create new
   */
  private static async loadConversationMemory(
    conversationId?: string
  ): Promise<ConversationMemory> {
    console.log(
      "🧠 loadConversationMemory: Starting with conversationId:",
      conversationId
    );

    if (!conversationId) {
      console.log(
        "🧠 loadConversationMemory: No conversationId, returning empty memory"
      );
      return {
        messages: [],
        lastUpdated: new Date(),
      };
    }

    try {
      console.log(
        "🧠 loadConversationMemory: Querying database for messages..."
      );
      // Get recent messages from conversation
      const messages = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: this.MAX_MEMORY_MESSAGES,
      });

      console.log("🧠 loadConversationMemory: Found messages from DB:", {
        count: messages.length,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text.substring(0, 50) + "...",
          createdAt: m.createdAt,
        })),
      });

      const chatMessages: ChatMessage[] = messages
        .reverse() // Oldest first
        .map((msg) => ({
          role: msg.role === "USER" ? "user" : "assistant",
          content: msg.text,
          timestamp: msg.createdAt,
        }));

      // Try to get conversation summary from metadata
      const conversation = await db.conversation.findUnique({
        where: { id: conversationId },
      });

      const summary = conversation?.notes || undefined;

      return {
        messages: chatMessages,
        summary,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("Error loading conversation memory:", error);
      return {
        messages: [],
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Save conversation memory to database
   */
  private static async saveConversationMemory(
    conversationId: string,
    memory: ConversationMemory
  ): Promise<void> {
    try {
      // Update conversation with summary if available
      if (memory.summary) {
        await db.conversation.update({
          where: { id: conversationId },
          data: {
            notes: memory.summary,
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error("Error saving conversation memory:", error);
      // Don't throw - memory saving is not critical
    }
  }

  /**
   * Build conversation context from memory
   */
  private static buildConversationContext(memory: ConversationMemory): string {
    console.log("🧠 buildConversationContext: Building context from memory:", {
      messageCount: memory.messages.length,
      hasSummary: !!memory.summary,
      summary: memory.summary,
    });

    let context = "";

    // Add conversation summary if available
    if (memory.summary) {
      context += `Previous conversation summary: ${memory.summary}\n\n`;
      console.log("🧠 buildConversationContext: Added summary to context");
    }

    // Add recent messages
    if (memory.messages.length > 0) {
      context += "Recent conversation:\n";
      const recentMessages = memory.messages.slice(-6); // Last 6 messages for context
      console.log(
        "🧠 buildConversationContext: Adding recent messages to context:",
        recentMessages.length
      );

      for (const message of recentMessages) {
        const role = message.role === "user" ? "User" : "Assistant";
        context += `${role}: ${message.content}\n`;
      }
      context += "\n";
    }

    console.log(
      "🧠 buildConversationContext: Final context length:",
      context.length
    );
    console.log(
      "🧠 buildConversationContext: Context preview:",
      context.substring(0, 200) + "..."
    );

    return context;
  }

  /**
   * Build document context from relevant chunks
   */
  private static buildDocumentContext(relevantChunks: VectorMatch[]): string {
    if (relevantChunks.length === 0) {
      return "";
    }

    let context = "Relevant information from documents:\n\n";

    for (const chunk of relevantChunks) {
      context += `${chunk.content}\n\n`;
    }

    return context;
  }

  /**
   * Generate response using configured LLM provider with conversation and document context
   */
  private static async generateWithLLM(
    query: string,
    conversationContext: string,
    documentContext: string,
    temperature: number,
    maxTokens: number,
    customSystemPrompt?: string,
    providerConfig?: any
  ): Promise<string> {
    // If we have providerConfig, use LLMService with the configured provider
    if (providerConfig?.apiKeyEnc) {
      try {
        console.log(
          `🎯 RAGChatbot: Using configured provider: ${providerConfig.provider}`
        );

        // Decrypt the API key
        const apiKey = await decrypt(providerConfig.apiKeyEnc);

        // Build the complete provider config for LLMService
        const config: ProviderConfig = {
          provider: providerConfig.provider,
          apiKey,
          model: providerConfig.model,
          temperature,
          maxTokens,
          systemPrompt: customSystemPrompt || providerConfig.systemPrompt,
        };

        // Build conversation context with system prompt and document context
        const fullContext = [conversationContext, documentContext]
          .filter(Boolean)
          .join("\n");

        const systemPrompt = customSystemPrompt || providerConfig.systemPrompt;

        const promptWithContext = fullContext
          ? `${systemPrompt}

${fullContext}

Current user message: ${query}

Please provide a helpful response based on the conversation history and available information.`
          : `${systemPrompt}

Current user message: ${query}

Please provide a helpful response.`;

        // Use LLMService to generate response
        const response = await llmService.generateResponse(config, [
          { role: "user", content: promptWithContext },
        ]);

        console.log(
          `✅ RAGChatbot: Generated response using ${providerConfig.provider}`
        );
        return response.text;
      } catch (error) {
        console.error(
          `❌ RAGChatbot: Failed to use configured provider ${providerConfig.provider}, falling back to Gemini:`,
          error
        );
        // Fall back to Gemini if the configured provider fails
      }
    }

    // Fallback to Gemini (original implementation)
    return this.generateWithGemini(
      query,
      conversationContext,
      documentContext,
      temperature,
      maxTokens,
      customSystemPrompt
    );
  }

  /**
   * Generate response using Gemini with conversation and document context (fallback)
   */
  private static async generateWithGemini(
    query: string,
    conversationContext: string,
    documentContext: string,
    temperature: number,
    maxTokens: number,
    customSystemPrompt?: string
  ): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: this.GEMINI_MODEL });

    // Build system prompt for RAG chatbot
    const defaultSystemPrompt = `You are a helpful AI assistant with access to documents and conversation history. 

Your capabilities:
1. Answer questions using information from the provided documents
2. Remember and reference previous parts of the conversation
3. Provide helpful, accurate, and contextual responses
4. Admit when you don't have enough information

Guidelines:
- Use document information when relevant to answer questions
- Reference conversation history when it provides helpful context
- Be conversational and natural in your responses
- If introducing yourself, be friendly but don't make up personal details
- For greetings, respond naturally and offer to help
- Stay focused on being helpful and informative`;

    // Use custom system prompt if provided, otherwise use default
    const systemPrompt = customSystemPrompt || defaultSystemPrompt;

    console.log(
      `🎯 RAGChatbot: Using ${
        customSystemPrompt ? "CUSTOM" : "DEFAULT"
      } system prompt:`,
      systemPrompt.substring(0, 100) + "..."
    );

    // Combine all context
    const fullContext = [conversationContext, documentContext]
      .filter(Boolean)
      .join("\n");

    const prompt = fullContext
      ? `${systemPrompt}

${fullContext}

Current user message: ${query}

Please provide a helpful response based on the conversation history and available information.`
      : `${systemPrompt}

Current user message: ${query}

Please provide a helpful response.`;

    console.log(
      `🤖 RAG: Generating response with context length: ${fullContext.length} chars`
    );

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: Math.min(temperature, 0.8),
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 20,
      },
    });

    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    return text.trim();
  }

  /**
   * Manage memory by summarizing old messages and keeping recent ones
   */
  private static async manageMemory(
    memory: ConversationMemory,
    conversationId?: string
  ): Promise<ConversationMemory> {
    // If we have too many messages, create a summary
    if (memory.messages.length > this.MEMORY_SUMMARY_THRESHOLD) {
      try {
        // Take older messages for summarization (keep recent ones as-is)
        const messagesToSummarize = memory.messages.slice(0, -4); // All but last 4 messages
        const recentMessages = memory.messages.slice(-4); // Keep last 4 messages

        if (messagesToSummarize.length > 0) {
          const summary = await this.summarizeConversation(
            messagesToSummarize,
            memory.summary
          );

          return {
            messages: recentMessages,
            summary,
            lastUpdated: new Date(),
          };
        }
      } catch (error) {
        console.error("Error managing memory:", error);
        // Fallback: just keep recent messages
        return {
          messages: memory.messages.slice(-this.MAX_MEMORY_MESSAGES),
          summary: memory.summary,
          lastUpdated: new Date(),
        };
      }
    }

    // Just update timestamp
    return {
      ...memory,
      lastUpdated: new Date(),
    };
  }

  /**
   * Summarize conversation messages using Gemini
   */
  private static async summarizeConversation(
    messages: ChatMessage[],
    existingSummary?: string
  ): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      return existingSummary || "Previous conversation occurred.";
    }

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: this.GEMINI_MODEL });

      const conversationText = messages
        .map(
          (msg) =>
            `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
        )
        .join("\n");

      const prompt = existingSummary
        ? `Previous summary: ${existingSummary}

New conversation to add to summary:
${conversationText}

Please create a concise summary that combines the previous summary with the new conversation, focusing on key topics discussed, user preferences, and important context that would be helpful for future conversations. Keep it under 200 words.`
        : `Please create a concise summary of this conversation, focusing on key topics discussed, user preferences, and important context that would be helpful for future conversations. Keep it under 200 words.

Conversation:
${conversationText}`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300,
        },
      });

      return (
        result.response.text()?.trim() ||
        existingSummary ||
        "Previous conversation occurred."
      );
    } catch (error) {
      console.error("Error summarizing conversation:", error);
      return existingSummary || "Previous conversation occurred.";
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
