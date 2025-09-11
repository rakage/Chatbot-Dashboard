import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { socketService } from "@/lib/socket";
import { LastSeenService } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;

    // Fetch conversation with messages
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        page: {
          include: {
            company: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 100, // Limit to recent messages
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Check access permissions
    if (
      session.user.companyId !== conversation.page.company.id &&
      session.user.role !== "OWNER"
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Transform conversation data
    const transformedConversation = {
      id: conversation.id,
      psid: conversation.psid,
      status: conversation.status,
      autoBot: conversation.autoBot,
      customerName: conversation.psid
        ? `Customer ${conversation.psid.slice(-4)}`
        : "Unknown Customer",
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      notes: conversation.notes,
      tags: conversation.tags,
      customerEmail: conversation.customerEmail,
      customerPhone: conversation.customerPhone,
      customerAddress: conversation.customerAddress,
      freshdeskTickets: (conversation as any).freshdeskTickets,
    };

    // Transform messages (reverse to get chronological order since we fetched desc)
    const reversedMessages = [...conversation.messages].reverse();
    const transformedMessages = reversedMessages.map((message) => ({
      id: message.id,
      text: message.text,
      role: message.role,
      createdAt: message.createdAt.toISOString(),
      meta: message.meta,
    }));

    return NextResponse.json({
      conversation: transformedConversation,
      messages: transformedMessages,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await request.json();

    // Handle different actions
    if (body.action === "mark_read") {
      // Get conversation with related data to check permissions
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

      // Check access permissions
      if (
        session.user.companyId !== conversation.page.company.id &&
        session.user.role !== "OWNER"
      ) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Update conversation to mark as read by this user
      const currentTimestamp = new Date().toISOString();
      const updatedConversation = await db.conversation.update({
        where: { id: conversationId },
        data: {
          assigneeId: session.user.id, // Assign to current user to mark as read
          meta: {
            ...((conversation.meta as any) || {}),
            lastReadBy: session.user.id,
            lastReadAt: currentTimestamp,
          },
        },
      });

      // Also update Supabase last seen for consistency
      try {
        await LastSeenService.updateLastSeen(session.user.id, conversationId, new Date());
        console.log(`✅ Updated Supabase last seen for conversation ${conversationId}`);
      } catch (supabaseError) {
        console.warn(`⚠️ Failed to update Supabase last seen for conversation ${conversationId}:`, supabaseError);
        // Don't fail the request if Supabase update fails
      }

      console.log(
        `✅ Conversation ${conversationId} marked as read by user ${session.user.id}`
      );

      // Emit socket event to notify other clients
      try {
        socketService.emitToCompany(
          conversation.page.company.id,
          "conversation:read",
          {
            conversationId,
            userId: session.user.id,
            timestamp: new Date().toISOString(),
          }
        );

        // Also emit to development company room
        if (process.env.NODE_ENV === "development") {
          socketService.emitToCompany("dev-company", "conversation:read", {
            conversationId,
            userId: session.user.id,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (emitError) {
        console.error("❌ Failed to emit conversation:read event:", emitError);
      }

      return NextResponse.json({
        success: true,
        conversation: {
          id: updatedConversation.id,
          assigneeId: updatedConversation.assigneeId,
          lastReadAt: (updatedConversation.meta as any)?.lastReadAt,
        },
      });
    }

    // Validate input for regular updates
    const { notes, tags, customerEmail, customerPhone, customerAddress } = body;

    if (notes !== undefined && typeof notes !== "string") {
      return NextResponse.json(
        { error: "Notes must be a string" },
        { status: 400 }
      );
    }

    if (
      tags !== undefined &&
      (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string"))
    ) {
      return NextResponse.json(
        { error: "Tags must be an array of strings" },
        { status: 400 }
      );
    }

    if (customerEmail !== undefined && typeof customerEmail !== "string") {
      return NextResponse.json(
        { error: "Customer email must be a string" },
        { status: 400 }
      );
    }

    if (customerPhone !== undefined && typeof customerPhone !== "string") {
      return NextResponse.json(
        { error: "Customer phone must be a string" },
        { status: 400 }
      );
    }

    if (customerAddress !== undefined && typeof customerAddress !== "string") {
      return NextResponse.json(
        { error: "Customer address must be a string" },
        { status: 400 }
      );
    }

    // Basic email validation if provided
    if (
      customerEmail &&
      customerEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
    ) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Fetch conversation to check permissions
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

    // Check access permissions
    if (
      session.user.companyId !== conversation.page.company.id &&
      session.user.role !== "OWNER"
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Update conversation
    const updateData: any = {};
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (tags !== undefined) {
      updateData.tags = tags;
    }
    if (customerEmail !== undefined) {
      updateData.customerEmail = customerEmail.trim() || null;
    }
    if (customerPhone !== undefined) {
      updateData.customerPhone = customerPhone.trim() || null;
    }
    if (customerAddress !== undefined) {
      updateData.customerAddress = customerAddress.trim() || null;
    }

    const updatedConversation = await db.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      conversation: {
        id: updatedConversation.id,
        notes: updatedConversation.notes,
        tags: updatedConversation.tags,
        customerEmail: updatedConversation.customerEmail,
        customerPhone: updatedConversation.customerPhone,
        customerAddress: updatedConversation.customerAddress,
      },
    });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}
