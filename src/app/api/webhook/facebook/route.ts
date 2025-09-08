import { NextRequest, NextResponse } from "next/server";
import { facebookAPI } from "@/lib/facebook";
import { db } from "@/lib/db";
import {
  getIncomingMessageQueue,
  processIncomingMessageDirect,
} from "@/lib/queue";
import { decrypt } from "@/lib/encryption";

// Webhook verification (GET)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("Webhook verification attempt:", {
    mode,
    token: token ? "***" : null,
    challenge,
  });

  if (!mode || !token || !challenge) {
    console.error("Missing required parameters:", {
      mode,
      token: !!token,
      challenge: !!challenge,
    });
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  if (mode === "subscribe") {
    try {
      // Check if token matches any page's verify token in database
      const pageConnections = await db.pageConnection.findMany({
        select: {
          pageId: true,
          pageName: true,
          verifyTokenEnc: true,
        },
      });

      let isValidToken = false;
      let matchedPage = null;

      for (const page of pageConnections) {
        try {
          const decryptedVerifyToken = await decrypt(page.verifyTokenEnc);
          if (token === decryptedVerifyToken) {
            isValidToken = true;
            matchedPage = page;
            break;
          }
        } catch (decryptError) {
          console.error(
            `Error decrypting verify token for page ${page.pageId}:`,
            decryptError
          );
          continue;
        }
      }

      // Also check environment variable as fallback
      const envVerifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
      console.log("🔍 Checking environment verify token:", {
        hasEnvToken: !!envVerifyToken,
        tokenMatches: envVerifyToken === token,
      });

      if (!isValidToken && envVerifyToken && token === envVerifyToken) {
        isValidToken = true;
        matchedPage = { pageName: "Environment Token" };
        console.log("✅ Environment token verified successfully");
      }

      if (isValidToken) {
        console.log(
          "Webhook verified successfully for:",
          matchedPage?.pageName || "Unknown"
        );
        return new NextResponse(challenge, {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
          },
        });
      } else {
        console.error("❌ Invalid verify token received:", token);
        console.error(
          "📝 Available tokens in database:",
          pageConnections.length
        );
        console.error(
          "🔧 Environment token available:",
          !!process.env.WEBHOOK_VERIFY_TOKEN
        );
        return NextResponse.json(
          { error: "Invalid verify token" },
          { status: 403 }
        );
      }
    } catch (error) {
      console.error("Error during webhook verification:", error);
      return NextResponse.json(
        { error: "Server error during verification" },
        { status: 500 }
      );
    }
  }

  console.error("Invalid webhook mode:", mode);
  return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
}

// Webhook events (POST)
export async function POST(request: NextRequest) {
  try {
    const signature =
      request.headers.get("x-hub-signature-256") ||
      request.headers.get("x-hub-signature") ||
      "";
    const body = await request.text();

    console.log("📨 Webhook POST received:");
    console.log("📨 Signature header:", signature ? "present" : "missing");
    console.log("📨 Body length:", body.length);

    // For development, we'll temporarily skip signature verification
    // TODO: Implement proper signature verification with App Secret
    const skipSignatureVerification =
      process.env.NODE_ENV === "development" ||
      process.env.SKIP_WEBHOOK_SIGNATURE === "true";

    if (!skipSignatureVerification) {
      // Verify signature (when App Secret is available)
      if (!signature) {
        console.error("❌ Missing webhook signature");
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 403 }
        );
      }

      // TODO: Implement signature verification with FACEBOOK_APP_SECRET
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      if (!appSecret) {
        console.warn(
          "⚠️ FACEBOOK_APP_SECRET not set, skipping signature verification"
        );
      } else {
        console.log("🔐 Verifying webhook signature...");
        try {
          const crypto = require("crypto");
          const expectedSignature =
            "sha256=" +
            crypto.createHmac("sha256", appSecret).update(body).digest("hex");

          if (signature !== expectedSignature) {
            console.error("❌ Invalid webhook signature");
            console.error("❌ Expected:", expectedSignature);
            console.error("❌ Received:", signature);
            return NextResponse.json(
              { error: "Invalid signature" },
              { status: 403 }
            );
          }
          console.log("✅ Webhook signature verified");
        } catch (sigError) {
          console.error("❌ Signature verification error:", sigError);
          return NextResponse.json(
            { error: "Signature verification failed" },
            { status: 403 }
          );
        }
      }
    } else {
      console.log("⚠️ Skipping signature verification (development mode)");
    }

    const payload = JSON.parse(body);
    console.log("Received webhook payload:", JSON.stringify(payload, null, 2));

    // Parse webhook entries
    const entries = facebookAPI.parseWebhookPayload(payload);

    for (const entry of entries) {
      const pageId = entry.id;

      // Check if page is connected
      const pageConnection = await db.pageConnection.findUnique({
        where: { pageId },
        include: {
          company: true,
        },
      });

      if (!pageConnection) {
        console.log(`Page ${pageId} not connected, ignoring webhook`);
        continue;
      }

      // Process messaging events
      for (const messagingEvent of entry.messaging) {
        try {
          if (facebookAPI.isMessageEvent(messagingEvent)) {
            // Handle incoming message
            const senderId = messagingEvent.sender.id;
            const messageText = messagingEvent.message?.text || "";
            const timestamp = messagingEvent.timestamp;

            console.log(`Incoming message from ${senderId}: ${messageText}`);

            // Queue message for processing (only if Redis is available)
            try {
              const messageQueue = await getIncomingMessageQueue();
              await messageQueue.add("process-message", {
                pageId,
                senderId,
                messageText,
                timestamp,
              });
              console.log(`✅ Message queued for processing via Redis`);
            } catch (queueError) {
              console.error(
                "Failed to queue message (Redis unavailable):",
                queueError
              );
              // Fallback: Process message directly without Redis
              console.log("🔄 Processing message directly (Redis fallback)");
              try {
                await processIncomingMessageDirect({
                  pageId,
                  senderId,
                  messageText,
                  timestamp,
                });
                console.log(`✅ Message processed directly without Redis`);
              } catch (directProcessError) {
                console.error(
                  "❌ Direct message processing failed:",
                  directProcessError
                );
                throw directProcessError;
              }
            }
          } else if (facebookAPI.isDeliveryEvent(messagingEvent)) {
            // Handle delivery confirmation
            console.log("Message delivered:", messagingEvent.delivery);

            // Update message delivery status in database
            if (messagingEvent.delivery?.mids) {
              for (const mid of messagingEvent.delivery.mids) {
                await db.message.updateMany({
                  where: {
                    meta: {
                      path: ["facebookMessageId"],
                      equals: mid,
                    },
                  },
                  data: {
                    meta: {
                      ...((messagingEvent as any)?.meta || {}),
                      deliveredAt: new Date(
                        messagingEvent.delivery.watermark
                      ).toISOString(),
                    },
                  },
                });
              }
            }
          } else if (facebookAPI.isReadEvent(messagingEvent)) {
            // Handle read confirmation
            console.log("Message read:", messagingEvent.read);

            // Update conversation read status
            const conversation = await db.conversation.findUnique({
              where: {
                pageId_psid: {
                  pageId,
                  psid: messagingEvent.sender.id,
                },
              },
            });

            if (conversation) {
              await db.conversation.update({
                where: { id: conversation.id },
                data: {
                  meta: {
                    ...(conversation.meta as any),
                    lastReadAt: new Date(
                      messagingEvent.read!.watermark
                    ).toISOString(),
                  },
                },
              });
            }
          } else if (facebookAPI.isPostbackEvent(messagingEvent)) {
            // Handle postback
            console.log("Postback received:", messagingEvent.postback);

            // You can handle postbacks here (e.g., quick replies, persistent menu)
            // For now, we'll treat them as regular messages
            const senderId = messagingEvent.sender.id;
            const postbackTitle = messagingEvent.postback?.title || "Postback";
            const timestamp = messagingEvent.timestamp;

            try {
              const messageQueue = await getIncomingMessageQueue();
              await messageQueue.add("process-message", {
                pageId,
                senderId,
                messageText: postbackTitle,
                timestamp,
              });
            } catch (queueError) {
              console.error(
                "Failed to queue postback (Redis unavailable):",
                queueError
              );
              // Continue processing without queue for development
            }
          }
        } catch (eventError) {
          console.error("Error processing messaging event:", eventError);
          // Continue processing other events even if one fails
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Disable body size limit for webhook
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};
