import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { RAGChatbot } from "@/lib/rag-chatbot";
import { z } from "zod";

const chatSchema = z.object({
  message: z.string().min(1, "Message is required"),
  conversationId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  companyId: z.string().optional(), // For internal calls
  internal: z.boolean().optional(), // For internal calls
  settings: z
    .object({
      temperature: z.number().min(0).max(2).optional().default(0.7),
      maxTokens: z.number().min(100).max(4000).optional().default(1000),
      searchLimit: z.number().min(1).max(20).optional().default(5),
      similarityThreshold: z.number().min(0).max(1).optional().default(0.7),
      systemPrompt: z.string().optional(),
    })
    .optional()
    .default({}),
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body first to check for internal calls
    const body = await request.json();

    let user: any;
    let companyId: string;
    let providerConfig: any = null;

    // Check if this is an internal call from the queue worker
    if (body.companyId && body.internal === true) {
      // Internal call - get company directly
      const company = await db.company.findUnique({
        where: { id: body.companyId },
        include: { providerConfig: true },
      });

      if (!company) {
        return NextResponse.json(
          { error: "Company not found" },
          { status: 400 }
        );
      }

      companyId = body.companyId;
      providerConfig = company.providerConfig;
    } else {
      // Regular authenticated call
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Get user and company
      user = await db.user.findUnique({
        where: { id: session.user.id },
        include: { company: { include: { providerConfig: true } } },
      });

      if (!user?.companyId) {
        return NextResponse.json(
          { error: "User must be associated with a company" },
          { status: 400 }
        );
      }

      companyId = user.companyId;
      providerConfig = user.company?.providerConfig;
    }

    // Validate request body (already parsed above)
    const validation = chatSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { message, conversationId, documentIds, settings } = validation.data;

    // Generate RAG response with conversation memory
    const isFromFacebook = body.internal === true;

    console.log(
      `${
        isFromFacebook ? "📱 Facebook" : "🎮 Playground"
      } RAG chat: "${message}"`
    );
    console.log("🧠 API: conversationId received:", conversationId);
    console.log("🧠 API: companyId:", companyId);

    // Use systemPrompt from settings (passed from queue.ts) or from providerConfig
    const systemPrompt = settings.systemPrompt || providerConfig?.systemPrompt;

    const promptSource = settings.systemPrompt
      ? "CUSTOM"
      : providerConfig?.systemPrompt
      ? "PROVIDER_CONFIG"
      : "DEFAULT";
    console.log(`🎯 API: Using ${promptSource} system prompt`);

    const ragResponse = await RAGChatbot.generateResponse(
      message,
      companyId,
      conversationId,
      {
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        searchLimit: settings.searchLimit,
        similarityThreshold: settings.similarityThreshold,
        documentIds,
        systemPrompt,
        providerConfig, // Pass the full provider config
      }
    );

    const response = ragResponse.response;
    const contextInfo = {
      sourceDocuments: ragResponse.context.sourceDocuments,
      relevantChunks: ragResponse.context.relevantChunks.length,
      query: ragResponse.context.query,
      conversationContext: ragResponse.context.conversationContext,
    };
    const usage = ragResponse.usage;

    console.log("🧠 API: RAG response received:", {
      responseLength: response.length,
      memorySize: ragResponse.memory.messages.length,
      hasSummary: !!ragResponse.memory.summary,
      conversationContextLength: contextInfo.conversationContext.length,
    });

    // Only store messages for non-internal calls (playground usage)
    // Internal calls from Facebook queue worker already handle message storage
    if (
      conversationId &&
      !conversationId.startsWith("playground-") &&
      !isFromFacebook
    ) {
      console.log(
        "🧠 API: Storing messages for external conversationId:",
        conversationId
      );
      try {
        // Verify the conversation exists before storing messages
        const conversation = await db.conversation.findUnique({
          where: { id: conversationId },
        });

        if (!conversation) {
          console.warn(
            "🧠 API: Conversation not found, skipping message storage"
          );
          return NextResponse.json({
            success: true,
            message: response,
            context: contextInfo,
            usage,
            metadata: {
              hasMemory: !!ragResponse.memory.messages.length,
              memorySize: ragResponse.memory.messages.length,
              hasSummary: !!ragResponse.memory.summary,
              searchSettings: settings,
              responseGeneratedAt: new Date().toISOString(),
              warning: "Conversation not found, messages not stored",
            },
          });
        }

        // Store the user message
        console.log("🧠 API: Storing user message...");
        await db.message.create({
          data: {
            conversationId,
            role: "USER",
            text: message,
          },
        });
        console.log("🧠 API: User message stored successfully");

        // Store the AI response
        console.log("🧠 API: Storing bot response...");
        await db.message.create({
          data: {
            conversationId,
            role: "BOT",
            text: response,
            providerUsed: "GEMINI",
            meta: {
              ragContext: {
                sourceDocuments: contextInfo.sourceDocuments,
                relevantChunks: contextInfo.relevantChunks,
                searchSettings: settings,
                hasConversationContext: !!contextInfo.conversationContext,
              },
            },
          },
        });
        console.log("🧠 API: Bot response stored successfully");
      } catch (error) {
        console.error("Error storing conversation messages:", error);
        // Don't fail the request if message storage fails
      }
    } else if (conversationId?.startsWith("playground-")) {
      console.log(
        "🧠 API: Skipping database storage for playground conversation:",
        conversationId
      );
    } else if (isFromFacebook) {
      console.log(
        "🧠 API: Skipping database storage for Facebook internal call - queue worker handles this:",
        conversationId
      );
    }

    return NextResponse.json({
      success: true,
      message: response,
      context: contextInfo,
      usage,
      metadata: {
        hasMemory: !!ragResponse.memory.messages.length,
        memorySize: ragResponse.memory.messages.length,
        hasSummary: !!ragResponse.memory.summary,
        searchSettings: settings,
        responseGeneratedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("RAG chat error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate response",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user and company
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user?.companyId) {
      return NextResponse.json(
        { error: "User must be associated with a company" },
        { status: 400 }
      );
    }

    // Get recent RAG conversations (simplified for memory-based chatbot)
    const recentRagMessages = await db.message.findMany({
      where: {
        role: "BOT",
        providerUsed: "GEMINI",
      },
      include: {
        conversation: {
          select: {
            id: true,
            psid: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      statistics: {
        totalChunks: 0, // Will be updated when we implement stats
        averageTokens: 0,
        documentsProcessed: 0,
      },
      recentRagMessages: recentRagMessages.map((msg) => ({
        id: msg.id,
        text: msg.text.substring(0, 100) + (msg.text.length > 100 ? "..." : ""),
        conversationId: msg.conversationId,
        ragContext: msg.meta,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching RAG chat data:", error);
    return NextResponse.json(
      { error: "Failed to fetch RAG data" },
      { status: 500 }
    );
  }
}
