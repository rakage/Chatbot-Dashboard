import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { LastSeenService } from "@/lib/supabase";

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

    // Get user's last seen timestamps from Supabase for accurate unread calculation
    let lastSeenMap: Map<string, Date> = new Map();
    try {
      lastSeenMap = await LastSeenService.getUserLastSeen(session.user.id);
    } catch (error) {
      console.warn("Could not fetch last seen data from Supabase:", error);
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

      // Calculate unread count using Supabase last seen data (prioritized) or fallback to metadata
      let unreadCount = 0;
      const lastMessageTime = conv.lastMessageAt;
      
      // First, check Supabase last seen data
      const supabaseLastSeen = lastSeenMap.get(conv.id);
      
      if (supabaseLastSeen) {
        // User has seen this conversation in Supabase - check if there are new messages
        if (lastMessageTime > supabaseLastSeen) {
          unreadCount = 1; // Show 1 if there are unread messages since last seen
        }
      } else if (conv.meta && (conv.meta as any).lastReadAt && (conv.meta as any).lastReadBy === session.user.id) {
        // Fallback to conversation metadata
        const metadataLastRead = new Date((conv.meta as any).lastReadAt);
        if (lastMessageTime > metadataLastRead) {
          unreadCount = 1;
        }
      } else {
        // User has never read this conversation - show as unread but cap the display number
        unreadCount = Math.min(conv._count.messages, 5);
      }

      // Get customer profile from metadata if available
      const customerProfile = (conv.meta as any)?.customerProfile;
      const customerName =
        customerProfile?.fullName ||
        (conv.psid ? `Customer ${conv.psid.slice(-4)}` : "Unknown Customer");

      // If no customer profile exists, we could fetch it here in the background
      // For now, we'll just use the existing data or fallback name

      return {
        id: conv.id,
        psid: conv.psid,
        status: conv.status,
        autoBot: conv.autoBot,
        customerName,
        customerProfile: customerProfile || null,
        lastMessageAt: conv.lastMessageAt.toISOString(),
        messageCount: conv._count.messages,
        unreadCount: unreadCount,
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
