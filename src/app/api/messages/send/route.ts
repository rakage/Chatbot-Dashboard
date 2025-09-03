import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { socketService } from "@/lib/socket";
import { getOutgoingMessageQueue } from "@/lib/queue";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, text } = await request.json();

    if (!conversationId || !text?.trim()) {
      return NextResponse.json(
        { error: "Conversation ID and message text are required" },
        { status: 400 }
      );
    }

    // Get conversation and verify access
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        page: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this conversation's company
    if (
      session.user.companyId !== conversation.page.company.id &&
      session.user.role !== "OWNER"
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Create agent message
    const message = await db.message.create({
      data: {
        conversationId,
        role: "AGENT",
        text: text.trim(),
        meta: {
          agentId: session.user.id,
          agentName: session.user.name,
          sentAt: new Date().toISOString(),
        },
      },
    });

    // Update conversation last message time
    await db.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        assigneeId: session.user.id, // Assign conversation to the agent who sent the message
      },
    });

    // Emit real-time event to other users (not the sender)
    try {
      // Only emit to company room for dashboard updates, not the individual conversation
      // The sender already has the message optimistically
      socketService.emitToCompany(
        conversation.page.company.id,
        "conversation:updated",
        {
          conversationId: conversation.id,
          lastMessageAt: new Date(),
          messageCount: await db.message.count({
            where: { conversationId: conversation.id },
          }),
        }
      );

      console.log(
        `📢 Emitted conversation:updated to company ${conversation.page.company.id} for agent message`
      );
    } catch (socketError) {
      console.error("Failed to emit real-time events:", socketError);
      // Don't fail the request if real-time fails
    }

    // Queue outgoing message to Facebook
    try {
      const outgoingQueue = await getOutgoingMessageQueue();
      await outgoingQueue.add("send-message", {
        pageId: conversation.page.pageId, // Use the Facebook page ID, not the database ID
        recipientId: conversation.psid,
        messageText: text.trim(),
        messageId: message.id,
      });
      console.log(
        `📤 Queued outgoing message to Facebook page ${conversation.page.pageId}`
      );
    } catch (queueError) {
      console.error("Failed to queue outgoing message:", queueError);
      // For development without Redis, we could implement direct Facebook API call here
    }

    return NextResponse.json({
      message: {
        id: message.id,
        text: message.text,
        role: message.role,
        createdAt: message.createdAt,
        meta: message.meta,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
