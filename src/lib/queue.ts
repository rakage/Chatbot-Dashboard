import { Queue, Worker, Job } from "bullmq";
import { db } from "./db";
import { llmService } from "./llm/service";
import { decrypt } from "./encryption";
import { Provider } from "@prisma/client";
import { socketService } from "./socket";
import { facebookAPI } from "./facebook";
import { RAGChatbot } from "./rag-chatbot";

// Lazy initialization to avoid Redis connection on module load
let redis: any = null;
let incomingMessageQueueInstance: Queue | null = null;
let botReplyQueueInstance: Queue | null = null;
let outgoingMessageQueueInstance: Queue | null = null;
let workersInitialized = false;

// Helper function to initialize Redis connection
async function getRedis() {
  if (!redis) {
    try {
      const Redis = (await import("ioredis")).default;
      redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
        maxRetriesPerRequest: null, // Required for BullMQ
        lazyConnect: true,
        enableReadyCheck: false,
      });

      redis.on("error", (error: any) => {
        console.error("Redis connection error:", error);
      });

      redis.on("connect", () => {
        console.log("Connected to Redis");
      });

      // Test connection
      await redis.ping();
    } catch (error) {
      console.error("Failed to initialize Redis:", error);
      throw new Error("Redis connection failed");
    }
  }
  return redis;
}

// Lazy queue getters
export async function getIncomingMessageQueue(): Promise<Queue> {
  if (!incomingMessageQueueInstance) {
    const redisConnection = await getRedis();
    incomingMessageQueueInstance = new Queue("incoming-message", {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    // Auto-initialize workers when queue is first accessed
    if (!workersInitialized) {
      console.log("🔄 Auto-initializing queue workers...");
      await initializeWorkers();
      workersInitialized = true;
    }
  }
  return incomingMessageQueueInstance;
}

export async function getBotReplyQueue(): Promise<Queue> {
  if (!botReplyQueueInstance) {
    const redisConnection = await getRedis();
    botReplyQueueInstance = new Queue("bot-reply", {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return botReplyQueueInstance;
}

export async function getOutgoingMessageQueue(): Promise<Queue> {
  if (!outgoingMessageQueueInstance) {
    const redisConnection = await getRedis();
    outgoingMessageQueueInstance = new Queue("outgoing-message", {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });
  }
  return outgoingMessageQueueInstance;
}

// For backward compatibility - these will be null if Redis is not available
export const incomingMessageQueue = null;
export const botReplyQueue = null;
export const outgoingMessageQueue = null;

// Job data types
export interface IncomingMessageJobData {
  pageId: string;
  senderId: string;
  messageText: string;
  timestamp: number;
}

export interface BotReplyJobData {
  conversationId: string;
  triggerMessageId: string;
}

export interface OutgoingMessageJobData {
  pageId: string;
  recipientId: string;
  messageText: string;
  messageId: string;
}

// Worker initialization - also lazy
let incomingMessageWorkerInstance: Worker | null = null;
let botReplyWorkerInstance: Worker | null = null;
let outgoingMessageWorkerInstance: Worker | null = null;

export async function initializeWorkers() {
  if (workersInitialized) {
    console.log("✅ Workers already initialized, skipping...");
    return;
  }

  try {
    const redisConnection = await getRedis();

    // Test Redis connection first
    try {
      await redisConnection.ping();
      console.log("✅ Redis connection successful");
    } catch (error) {
      console.error("❌ Redis connection failed:", error);
      throw new Error(
        `Redis connection failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (!incomingMessageWorkerInstance) {
      incomingMessageWorkerInstance = new Worker(
        "incoming-message",
        async (job: Job<IncomingMessageJobData>) => {
          const { pageId, senderId, messageText, timestamp } = job.data;

          try {
            console.log(
              `🔍 Processing message for pageId: ${pageId}, senderId: ${senderId}`
            );

            // Find page connection by Facebook pageId
            const pageConnection = await db.pageConnection.findUnique({
              where: { pageId },
            });

            if (!pageConnection) {
              console.error(
                `❌ Page connection not found for Facebook pageId: ${pageId}`
              );
              throw new Error(
                `Page connection not found for Facebook pageId: ${pageId}`
              );
            }

            console.log(`✅ Page connection found:`, {
              dbId: pageConnection.id,
              facebookPageId: pageConnection.pageId,
              pageName: pageConnection.pageName,
            });

            // Find or create conversation using the database ID, not Facebook pageId
            let conversation = await db.conversation.findUnique({
              where: {
                pageId_psid: {
                  pageId: pageConnection.id, // Use database ID, not Facebook pageId
                  psid: senderId,
                },
              },
            });

            if (!conversation) {
              console.log(
                `📝 Creating new conversation for database pageId: ${pageConnection.id}, senderId: ${senderId}`
              );

              // Fetch customer profile from Facebook before creating conversation
              let customerProfile = null;
              try {
                console.log(`🔍 Fetching customer profile for ${senderId}...`);
                const pageAccessToken = await decrypt(
                  pageConnection.pageAccessTokenEnc
                );
                const profile = await facebookAPI.getUserProfile(
                  senderId,
                  pageAccessToken,
                  ["first_name", "last_name", "profile_pic", "locale"]
                );

                customerProfile = {
                  firstName: profile.first_name || "Unknown",
                  lastName: profile.last_name || "",
                  fullName: `${profile.first_name || "Unknown"} ${
                    profile.last_name || ""
                  }`.trim(),
                  profilePicture: profile.profile_pic || null,
                  locale: profile.locale || "en_US",
                  facebookUrl: `https://www.facebook.com/${senderId}`,
                  cached: true,
                  cachedAt: new Date().toISOString(),
                };
                console.log(`✅ Customer profile fetched:`, customerProfile);
              } catch (profileError) {
                console.error(
                  `❌ Failed to fetch customer profile for ${senderId}:`,
                  profileError
                );
                // Continue with conversation creation even if profile fetch fails
              }

              conversation = await db.conversation.create({
                data: {
                  pageId: pageConnection.id, // Use database ID, not Facebook pageId
                  psid: senderId,
                  status: "OPEN",
                  autoBot: true, // Default to auto bot for new conversations
                  lastMessageAt: new Date(),
                  tags: [],
                  meta: customerProfile ? { customerProfile } : undefined,
                },
              });
              console.log(
                `✅ Conversation created with ID: ${conversation.id}`
              );

              // Emit new conversation event to company room
              try {
                socketService.emitToCompany(
                  pageConnection.companyId,
                  "conversation:new",
                  {
                    conversation: {
                      id: conversation.id,
                      psid: conversation.psid,
                      status: conversation.status,
                      autoBot: conversation.autoBot,
                      customerName:
                        customerProfile?.fullName ||
                        `Customer ${senderId.slice(-4)}`,
                      customerProfile: customerProfile,
                      lastMessageAt: conversation.lastMessageAt,
                      messageCount: 0,
                      unreadCount: 1,
                    },
                  }
                );
                console.log(
                  `✅ Emitted conversation:new event for conversation ${conversation.id} to company ${pageConnection.companyId}`
                );

                // Also emit to development company room
                if (process.env.NODE_ENV === "development") {
                  socketService.emitToCompany(
                    "dev-company",
                    "conversation:new",
                    {
                      conversation: {
                        id: conversation.id,
                        psid: conversation.psid,
                        status: conversation.status,
                        autoBot: conversation.autoBot,
                        customerName:
                          customerProfile?.fullName ||
                          `Customer ${senderId.slice(-4)}`,
                        customerProfile: customerProfile,
                        lastMessageAt: conversation.lastMessageAt,
                        messageCount: 0,
                        unreadCount: 1,
                      },
                    }
                  );
                  console.log(
                    `✅ Emitted conversation:new event to dev-company room`
                  );
                }
              } catch (emitError) {
                console.error(
                  "❌ Failed to emit conversation:new event:",
                  emitError
                );
              }
            } else {
              console.log(
                `✅ Existing conversation found with ID: ${conversation.id}`
              );
            }

            // Check for duplicate messages (race condition protection)
            const existingMessage = await db.message.findFirst({
              where: {
                conversationId: conversation.id,
                role: "USER",
                text: messageText,
                meta: {
                  path: ["timestamp"],
                  equals: timestamp,
                },
              },
            });

            let message;
            if (existingMessage) {
              console.log(
                `⚠️ Duplicate user message detected, using existing message ID: ${existingMessage.id}`
              );
              message = existingMessage;
            } else {
              // Create message
              message = await db.message.create({
                data: {
                  conversationId: conversation.id,
                  role: "USER",
                  text: messageText,
                  meta: {
                    timestamp,
                    receivedAt: new Date().toISOString(),
                    source: "facebook-queue-worker",
                  },
                },
              });
            }

            // Update conversation last message time
            await db.conversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: new Date() },
            });

            // Emit real-time event for new message
            try {
              const fullMessage = await db.message.findUnique({
                where: { id: message.id },
                include: {
                  conversation: {
                    include: {
                      page: {
                        include: {
                          company: true,
                        },
                      },
                    },
                  },
                },
              });

              if (fullMessage) {
                // Emit to conversation room
                const messageEvent = {
                  message: {
                    id: fullMessage.id,
                    text: fullMessage.text,
                    role: fullMessage.role,
                    createdAt: fullMessage.createdAt.toISOString(),
                    meta: fullMessage.meta,
                  },
                  conversation: {
                    id: conversation.id,
                    psid: conversation.psid,
                    status: conversation.status,
                    autoBot: conversation.autoBot,
                  },
                };

                console.log(
                  `📡 Emitting message:new to conversation:${conversation.id}`,
                  messageEvent
                );
                socketService.emitToConversation(
                  conversation.id,
                  "message:new",
                  messageEvent
                );

                // Emit to company room for dashboard updates
                const messageCount = await db.message.count({
                  where: { conversationId: conversation.id },
                });

                // Emit conversation:updated for statistics
                socketService.emitToCompany(
                  fullMessage.conversation.page.company.id,
                  "conversation:updated",
                  {
                    conversationId: conversation.id,
                    lastMessageAt: new Date().toISOString(),
                    messageCount: messageCount,
                  }
                );

                // Emit message:new for conversation list updates with last message preview
                socketService.emitToCompany(
                  fullMessage.conversation.page.company.id,
                  "message:new",
                  messageEvent
                );

                // Also emit to development company room
                if (process.env.NODE_ENV === "development") {
                  socketService.emitToCompany(
                    "dev-company",
                    "conversation:updated",
                    {
                      conversationId: conversation.id,
                      lastMessageAt: new Date().toISOString(),
                      messageCount: messageCount,
                    }
                  );

                  // Emit message:new for conversation list updates in dev mode
                  socketService.emitToCompany(
                    "dev-company",
                    "message:new",
                    messageEvent
                  );
                }
              }
            } catch (socketError) {
              console.error("Failed to emit real-time events:", socketError);
              // Don't throw - continue processing even if real-time fails
            }

            // If auto bot is enabled, queue bot reply
            if (conversation.autoBot) {
              const botQueue = await getBotReplyQueue();
              await botQueue.add("generate-reply", {
                conversationId: conversation.id,
                triggerMessageId: message.id,
              });
            }

            return { messageId: message.id, conversationId: conversation.id };
          } catch (error) {
            console.error("Error processing incoming message:", error);
            throw error;
          }
        },
        { connection: redisConnection }
      );
    }

    // Initialize bot reply worker
    if (!botReplyWorkerInstance) {
      botReplyWorkerInstance = new Worker(
        "bot-reply",
        async (job: Job<BotReplyJobData>) => {
          console.log(
            `🚀 Bot-reply worker started for conversation: ${job.data.conversationId}`
          );
          const { conversationId } = job.data;

          try {
            // Get conversation with related data
            const conversation = await db.conversation.findUnique({
              where: { id: conversationId },
              include: {
                messages: {
                  orderBy: { createdAt: "desc" },
                  take: 10, // Last 10 messages for context
                },
                page: {
                  include: {
                    company: {
                      include: {
                        providerConfig: true,
                      },
                    },
                  },
                },
              },
            });

            if (!conversation || !conversation.page.company?.providerConfig) {
              throw new Error("Conversation or provider config not found");
            }

            const providerConfig = conversation.page.company.providerConfig;

            // Prepare message history for LLM
            const messageHistory = [...conversation.messages]
              .reverse()
              .map((msg) => ({
                role:
                  msg.role === "USER"
                    ? ("user" as const)
                    : ("assistant" as const),
                content: msg.text,
              }))
              .filter((msg) => msg.role === "user" || msg.role === "assistant");

            // Check if provider config is properly configured
            if (!providerConfig.apiKeyEnc) {
              throw new Error("LLM provider API key not configured");
            }

            // Decrypt API key
            const apiKey = await decrypt(providerConfig.apiKeyEnc);
            if (!apiKey) {
              throw new Error("Failed to decrypt API key");
            }

            console.log(
              `🤖 Generating bot response with provider: ${providerConfig.provider}, model: ${providerConfig.model}`
            );
            console.log(
              `🤖 Provider type:`,
              typeof providerConfig.provider,
              `Value:`,
              providerConfig.provider
            );

            // Use the Prisma Provider enum directly
            console.log(`🤖 Using provider from DB:`, providerConfig.provider);

            // Validate that it's a valid provider
            if (!Object.values(Provider).includes(providerConfig.provider)) {
              throw new Error(
                `Invalid provider: ${
                  providerConfig.provider
                }. Available: ${Object.values(Provider).join(", ")}`
              );
            }

            console.log(`🤖 Validated provider:`, providerConfig.provider);

            // Get the latest user message for RAG search
            const latestUserMessage = messageHistory
              .filter((msg) => msg.role === "user")
              .pop();

            console.log(
              `🔍 Debug: messageHistory length: ${messageHistory.length}`
            );
            console.log(
              `🔍 Debug: latestUserMessage found: ${!!latestUserMessage}`
            );
            if (latestUserMessage) {
              console.log(
                `🔍 Debug: latestUserMessage content: "${latestUserMessage.content}"`
              );
            }

            let response;

            if (latestUserMessage) {
              console.log(
                `🔍 Using Playground RAG API for Facebook bot response to: "${latestUserMessage.content}"`
              );

              try {
                // Use the same API endpoint as the Playground for consistency
                const ragApiResponse = await fetch(
                  `${
                    process.env.NEXTAUTH_URL || "http://localhost:3000"
                  }/api/rag/chat`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      message: latestUserMessage.content,
                      conversationId: conversation.id, // ✅ Add conversation ID for memory!
                      companyId: conversation.page.company.id,
                      internal: true, // Mark as internal call
                      settings: {
                        temperature: Math.min(providerConfig.temperature, 0.2), // Cap temperature for Facebook
                        maxTokens: providerConfig.maxTokens,
                        searchLimit: 3, // Fewer chunks for cleaner responses
                        similarityThreshold: 0.1, // Lower threshold for better recall
                        systemPrompt: providerConfig.systemPrompt, // Use custom system prompt from LLM Config
                      },
                    }),
                  }
                );

                if (ragApiResponse.ok) {
                  const ragData = await ragApiResponse.json();

                  // Use RAG response
                  response = {
                    text: ragData.message,
                    usage: ragData.usage,
                  };

                  console.log(
                    `✅ Facebook RAG API Response: Generated ${
                      ragData.message.length
                    } chars with ${
                      ragData.context?.relevantChunks || 0
                    } relevant chunks`
                  );

                  // Log source documents for Facebook
                  if (ragData.context?.sourceDocuments?.length > 0) {
                    console.log(
                      `📚 Facebook Sources: ${ragData.context.sourceDocuments.join(
                        ", "
                      )}`
                    );
                  }
                } else {
                  throw new Error(
                    `RAG API failed with status: ${ragApiResponse.status}`
                  );
                }
              } catch (ragError) {
                console.error(
                  "❌ RAG API failed, falling back to standard LLM:",
                  ragError
                );

                // Fallback to standard LLM response
                response = await llmService.generateResponse(
                  {
                    provider: providerConfig.provider as Provider,
                    apiKey: apiKey,
                    model: providerConfig.model,
                    temperature: providerConfig.temperature,
                    maxTokens: providerConfig.maxTokens,
                    systemPrompt: providerConfig.systemPrompt,
                  },
                  messageHistory
                );
              }
            } else {
              // No user message found, use standard response
              response = await llmService.generateResponse(
                {
                  provider: providerConfig.provider as Provider,
                  apiKey: apiKey,
                  model: providerConfig.model,
                  temperature: providerConfig.temperature,
                  maxTokens: providerConfig.maxTokens,
                  systemPrompt: providerConfig.systemPrompt,
                },
                messageHistory
              );
            }

            // Check for duplicate bot messages (race condition protection)
            const existingBotMessage = await db.message.findFirst({
              where: {
                conversationId: conversation.id,
                role: "BOT",
                text: response.text,
                providerUsed: providerConfig.provider,
              },
              orderBy: { createdAt: "desc" },
            });

            let botMessage;
            if (
              existingBotMessage &&
              Math.abs(
                new Date().getTime() - existingBotMessage.createdAt.getTime()
              ) < 5000
            ) {
              // Within 5 seconds
              console.log(
                `⚠️ Duplicate bot message detected, using existing message ID: ${existingBotMessage.id}`
              );
              botMessage = existingBotMessage;
            } else {
              // Create bot message
              botMessage = await db.message.create({
                data: {
                  conversationId: conversation.id,
                  role: "BOT",
                  text: response.text,
                  providerUsed: providerConfig.provider,
                  meta: {
                    usage: response.usage,
                    model: response.model,
                    generatedVia: "facebook-queue-worker",
                    ragEnabled: !!latestUserMessage, // Track if RAG was used
                  },
                },
              });
            }

            // Emit real-time event for bot message
            try {
              const botMessageEvent = {
                message: {
                  id: botMessage.id,
                  text: botMessage.text,
                  role: botMessage.role,
                  createdAt: botMessage.createdAt.toISOString(),
                  meta: botMessage.meta,
                },
                conversation: {
                  id: conversation.id,
                  psid: conversation.psid,
                  status: conversation.status,
                  autoBot: conversation.autoBot,
                },
              };

              console.log(
                `📡 Emitting bot message:new to conversation:${conversationId}`,
                botMessageEvent
              );

              // Emit to conversation room for active viewers
              socketService.emitToConversation(
                conversationId,
                "message:new",
                botMessageEvent
              );

              // Emit to company room for conversation list updates
              socketService.emitToCompany(
                conversation.page.company.id,
                "message:new",
                botMessageEvent
              );

              // Also emit to development company room
              if (process.env.NODE_ENV === "development") {
                socketService.emitToCompany(
                  "dev-company",
                  "message:new",
                  botMessageEvent
                );
              }
            } catch (socketError) {
              console.error(
                "Failed to emit bot message real-time event:",
                socketError
              );
            }

            // Queue outgoing message to Facebook
            const outgoingQueue = await getOutgoingMessageQueue();
            await outgoingQueue.add("send-message", {
              pageId: conversation.page.pageId, // Use Facebook page ID, not database ID
              recipientId: conversation.psid,
              messageText: response.text,
              messageId: botMessage.id,
            });

            console.log(
              `📤 Queued bot response to Facebook page ${conversation.page.pageId}, recipient ${conversation.psid}`
            );

            return { messageId: botMessage.id };
          } catch (error) {
            console.error("Error generating bot reply:", error);
            throw error;
          }
        },
        { connection: redisConnection }
      );
    }

    // Initialize outgoing message worker
    if (!outgoingMessageWorkerInstance) {
      outgoingMessageWorkerInstance = new Worker(
        "outgoing-message",
        async (job: Job<OutgoingMessageJobData>) => {
          const { pageId, recipientId, messageText, messageId } = job.data;

          try {
            // Get page access token
            console.log(
              `🔍 Looking up page connection for Facebook page ID: ${pageId}`
            );
            const page = await db.pageConnection.findUnique({
              where: { pageId },
            });

            console.log(`📄 Page connection found:`, !!page);

            if (!page) {
              throw new Error("Page connection not found");
            }

            const accessToken = await decrypt(page.pageAccessTokenEnc);

            // Send message via Facebook API
            const response = await fetch(
              `https://graph.facebook.com/v18.0/${pageId}/messages`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  recipient: { id: recipientId },
                  message: { text: messageText },
                  access_token: accessToken,
                }),
              }
            );

            if (!response.ok) {
              const error = await response.text();
              throw new Error(`Facebook API error: ${error}`);
            }

            const result = await response.json();

            // Update message with delivery status
            await db.message.update({
              where: { id: messageId },
              data: {
                meta: {
                  facebookMessageId: result.message_id,
                  sentAt: new Date().toISOString(),
                },
              },
            });

            // Emit delivery confirmation
            try {
              const message = await db.message.findUnique({
                where: { id: messageId },
                include: {
                  conversation: true,
                },
              });

              if (message) {
                socketService.emitToConversation(
                  message.conversationId,
                  "message:sent",
                  {
                    messageId: messageId,
                    facebookMessageId: result.message_id,
                    sentAt: new Date().toISOString(),
                  }
                );
              }
            } catch (socketError) {
              console.error(
                "Failed to emit delivery confirmation:",
                socketError
              );
            }

            return { facebookMessageId: result.message_id };
          } catch (error) {
            console.error("Error sending outgoing message:", error);
            throw error;
          }
        },
        { connection: redisConnection }
      );
    }

    workersInitialized = true;
    console.log("✅ Workers initialized successfully");
  } catch (error) {
    console.error("Failed to initialize workers:", error);
  }
}

// Direct message processing function (fallback when Redis is unavailable)
export async function processIncomingMessageDirect(
  data: IncomingMessageJobData
) {
  const { pageId, senderId, messageText, timestamp } = data;

  try {
    console.log(
      `🔍 Processing message directly for pageId: ${pageId}, senderId: ${senderId}`
    );

    // Find page connection by Facebook pageId
    const pageConnection = await db.pageConnection.findUnique({
      where: { pageId },
    });

    if (!pageConnection) {
      console.error(
        `❌ Page connection not found for Facebook pageId: ${pageId}`
      );
      throw new Error(
        `Page connection not found for Facebook pageId: ${pageId}`
      );
    }

    console.log(`✅ Page connection found:`, {
      dbId: pageConnection.id,
      facebookPageId: pageConnection.pageId,
      pageName: pageConnection.pageName,
    });

    // Find or create conversation using the database ID, not Facebook pageId
    let conversation = await db.conversation.findUnique({
      where: {
        pageId_psid: {
          pageId: pageConnection.id, // Use database ID, not Facebook pageId
          psid: senderId,
        },
      },
    });

    if (!conversation) {
      console.log(
        `📝 Creating new conversation for database pageId: ${pageConnection.id}, senderId: ${senderId}`
      );

      // Fetch customer profile from Facebook before creating conversation
      let customerProfile = null;
      try {
        console.log(`🔍 Fetching customer profile for ${senderId}...`);
        const pageAccessToken = await decrypt(
          pageConnection.pageAccessTokenEnc
        );
        const profile = await facebookAPI.getUserProfile(
          senderId,
          pageAccessToken,
          ["first_name", "last_name", "profile_pic", "locale"]
        );

        customerProfile = {
          firstName: profile.first_name || "Unknown",
          lastName: profile.last_name || "",
          fullName: `${profile.first_name || "Unknown"} ${
            profile.last_name || ""
          }`.trim(),
          profilePicture: profile.profile_pic || null,
          locale: profile.locale || "en_US",
          facebookUrl: `https://www.facebook.com/${senderId}`,
          cached: true,
          cachedAt: new Date().toISOString(),
        };
        console.log(`✅ Customer profile fetched:`, customerProfile);
      } catch (profileError) {
        console.error(
          `❌ Failed to fetch customer profile for ${senderId}:`,
          profileError
        );
        // Continue with conversation creation even if profile fetch fails
      }

      conversation = await db.conversation.create({
        data: {
          pageId: pageConnection.id, // Use database ID, not Facebook pageId
          psid: senderId,
          status: "OPEN",
          autoBot: true, // Default to auto bot for new conversations
          lastMessageAt: new Date(),
          tags: [],
          meta: customerProfile ? { customerProfile } : undefined,
        },
      });
      console.log(`✅ Conversation created with ID: ${conversation.id}`);

      // Emit new conversation event to company room
      try {
        socketService.emitToCompany(
          pageConnection.companyId,
          "conversation:new",
          {
            conversation: {
              id: conversation.id,
              psid: conversation.psid,
              status: conversation.status,
              autoBot: conversation.autoBot,
              customerName:
                customerProfile?.fullName || `Customer ${senderId.slice(-4)}`,
              customerProfile: customerProfile,
              lastMessageAt: conversation.lastMessageAt,
              messageCount: 0,
              unreadCount: 1,
            },
          }
        );
        console.log(
          `✅ Emitted conversation:new event for conversation ${conversation.id} to company ${pageConnection.companyId}`
        );

        // Also emit to development company room
        if (process.env.NODE_ENV === "development") {
          socketService.emitToCompany("dev-company", "conversation:new", {
            conversation: {
              id: conversation.id,
              psid: conversation.psid,
              status: conversation.status,
              autoBot: conversation.autoBot,
              customerName:
                customerProfile?.fullName || `Customer ${senderId.slice(-4)}`,
              customerProfile: customerProfile,
              lastMessageAt: conversation.lastMessageAt,
              messageCount: 0,
              unreadCount: 1,
            },
          });
          console.log(`✅ Emitted conversation:new event to dev-company room`);
        }
      } catch (emitError) {
        console.error("❌ Failed to emit conversation:new event:", emitError);
      }
    } else {
      console.log(`✅ Existing conversation found with ID: ${conversation.id}`);
    }

    // Create message record
    const message = await db.message.create({
      data: {
        conversationId: conversation.id,
        text: messageText,
        role: "USER",
        meta: {
          facebookMessageId: `fb_${timestamp}`,
          timestamp: timestamp,
          source: "facebook_webhook",
        },
      },
    });

    console.log(`✅ Message saved with ID: ${message.id}`);

    // Update conversation lastMessageAt
    await db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // Emit real-time event for new message
    try {
      const fullMessage = await db.message.findUnique({
        where: { id: message.id },
        include: {
          conversation: {
            include: {
              page: {
                include: {
                  company: true,
                },
              },
            },
          },
        },
      });

      if (fullMessage) {
        // Emit to conversation room
        const messageEvent = {
          message: {
            id: fullMessage.id,
            text: fullMessage.text,
            role: fullMessage.role,
            createdAt: fullMessage.createdAt.toISOString(),
            meta: fullMessage.meta,
          },
          conversation: {
            id: conversation.id,
            psid: conversation.psid,
            status: conversation.status,
            autoBot: conversation.autoBot,
          },
        };

        console.log(
          `📡 Emitting message:new to conversation:${conversation.id}`,
          messageEvent
        );
        socketService.emitToConversation(
          conversation.id,
          "message:new",
          messageEvent
        );

        // Emit to company room for dashboard updates
        const messageCount = await db.message.count({
          where: { conversationId: conversation.id },
        });

        // Emit conversation:updated for statistics
        socketService.emitToCompany(
          fullMessage.conversation.page.company.id,
          "conversation:updated",
          {
            conversationId: conversation.id,
            lastMessageAt: new Date().toISOString(),
            messageCount: messageCount,
          }
        );

        // Emit message:new for conversation list updates with last message preview
        socketService.emitToCompany(
          fullMessage.conversation.page.company.id,
          "message:new",
          messageEvent
        );

        // Also emit to development company room
        if (process.env.NODE_ENV === "development") {
          socketService.emitToCompany("dev-company", "conversation:updated", {
            conversationId: conversation.id,
            lastMessageAt: new Date().toISOString(),
            messageCount: messageCount,
          });

          socketService.emitToCompany(
            "dev-company",
            "message:new",
            messageEvent
          );
        }
      }
    } catch (emitError) {
      console.error("❌ Failed to emit real-time events:", emitError);
    }

    // Handle auto-bot response if enabled
    if (conversation.autoBot) {
      console.log(`🤖 Auto-bot enabled for conversation ${conversation.id}`);
      try {
        // Generate bot response using RAG
        const botResponse = await RAGChatbot.generateResponse(
          messageText,
          pageConnection.companyId,
          conversation.id
        );

        if (botResponse.response) {
          // Save bot response to database
          const botMessage = await db.message.create({
            data: {
              conversationId: conversation.id,
              text: botResponse.response,
              role: "BOT",
              meta: {
                ragContext: JSON.parse(JSON.stringify(botResponse.context)),
                ragUsage: botResponse.usage,
                ragMemory: JSON.parse(JSON.stringify(botResponse.memory)),
                timestamp: Date.now(),
                source: "auto_bot",
              },
            },
          });

          console.log(`✅ Bot message saved with ID: ${botMessage.id}`);

          // Send bot response via Facebook API
          const pageAccessToken = await decrypt(
            pageConnection.pageAccessTokenEnc
          );
          await facebookAPI.sendMessage(pageAccessToken, {
            recipient: { id: senderId },
            message: { text: botResponse.response },
          });

          // Emit bot message to conversation room
          const botMessageEvent = {
            message: {
              id: botMessage.id,
              text: botMessage.text,
              role: botMessage.role,
              createdAt: botMessage.createdAt.toISOString(),
              meta: botMessage.meta,
            },
            conversation: {
              id: conversation.id,
              psid: conversation.psid,
              status: conversation.status,
              autoBot: conversation.autoBot,
            },
          };

          socketService.emitToConversation(
            conversation.id,
            "message:new",
            botMessageEvent
          );

          // Emit to company room
          socketService.emitToCompany(
            pageConnection.companyId,
            "message:new",
            botMessageEvent
          );

          // Also emit to development company room
          if (process.env.NODE_ENV === "development") {
            socketService.emitToCompany(
              "dev-company",
              "message:new",
              botMessageEvent
            );
          }

          console.log(`✅ Bot response sent and emitted`);
        }
      } catch (botError) {
        console.error("❌ Auto-bot response failed:", botError);
      }
    }

    console.log(`✅ Message processing completed for ${senderId}`);
  } catch (error) {
    console.error("❌ Message processing failed:", error);
    throw error;
  }
}

// Note: Workers will be initialized when needed via initializeWorkers()
// This prevents Redis connection errors during module loading
