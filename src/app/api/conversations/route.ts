import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause based on user's company access
    let whereClause: any = {};

    if (session.user.companyId && session.user.role !== "OWNER") {
      whereClause.page = {
        company: {
          id: session.user.companyId,
        },
      };
    }

    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    // Fetch conversations with message counts and last messages
    const conversations = await db.conversation.findMany({
      where: whereClause,
      include: {
        page: {
          include: {
            company: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get last message
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Transform data for frontend
    const conversationSummaries = conversations.map((conv) => {
      const lastMessage = conv.messages[0];

      // Calculate unread count (simplified - in real app, track read status per user)
      const unreadCount =
        conv.assigneeId === session.user.id ? 0 : conv._count.messages;

      // Get customer profile from metadata if available
      const customerProfile = (conv.meta as any)?.customerProfile;
      const customerName =
        customerProfile?.fullName ||
        (conv.psid ? `Customer ${conv.psid.slice(-4)}` : "Unknown Customer");

      return {
        id: conv.id,
        psid: conv.psid,
        status: conv.status,
        autoBot: conv.autoBot,
        customerName,
        customerProfile: customerProfile || null,
        lastMessageAt: conv.lastMessageAt.toISOString(),
        messageCount: conv._count.messages,
        unreadCount: Math.min(unreadCount, 5), // Cap at 5 for display
        lastMessage: lastMessage
          ? {
              text: lastMessage.text,
              role: lastMessage.role,
            }
          : undefined,
      };
    });

    return NextResponse.json({
      conversations: conversationSummaries,
      total: conversationSummaries.length,
      hasMore: conversationSummaries.length === limit,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
