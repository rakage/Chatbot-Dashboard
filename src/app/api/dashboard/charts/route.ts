import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = session.user.companyId;

    // Get the last 30 days for chart data (including today)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log("Date range setup:");
    console.log("Now:", now.toISOString());
    console.log("Thirty days ago:", thirtyDaysAgo.toISOString());
    console.log("Today's date string:", now.toISOString().split("T")[0]);

    // Fetch message data for all charts (since your data appears to be stored in GMT+7 already)
    const [allMessages, todayMessages] = await Promise.all([
      // Get all messages for the last 30 days
      db.message.findMany({
        where: {
          conversation: {
            page: { companyId },
          },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
          role: true,
          conversationId: true,
        },
        orderBy: { createdAt: "asc" },
      }),

      // Get today's messages for hourly breakdown
      db.message.findMany({
        where: {
          conversation: {
            page: { companyId },
          },
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        select: {
          createdAt: true,
          conversationId: true,
        },
      }),
    ]);

    // Helper function to get date string (assuming data is already in GMT+7)
    const getDateString = (date: Date): string => {
      return date.toISOString().split("T")[0];
    };

    // Process conversation trends (count unique conversations per day from messages)
    const conversationsByDate: Record<string, Set<string>> = {};
    allMessages.forEach((msg) => {
      const date = getDateString(msg.createdAt);
      if (!conversationsByDate[date]) {
        conversationsByDate[date] = new Set();
      }
      conversationsByDate[date].add(msg.conversationId);
    });

    // Process message trends (count messages by role per day)
    const messagesByDate: Record<
      string,
      { user_messages: number; bot_messages: number; agent_messages: number }
    > = {};
    allMessages.forEach((msg) => {
      const date = getDateString(msg.createdAt);
      if (!messagesByDate[date]) {
        messagesByDate[date] = {
          user_messages: 0,
          bot_messages: 0,
          agent_messages: 0,
        };
      }

      if (msg.role === "USER") messagesByDate[date].user_messages++;
      else if (msg.role === "BOT") messagesByDate[date].bot_messages++;
      else if (msg.role === "AGENT") messagesByDate[date].agent_messages++;
    });

    // Process hourly activity
    const hourlyData: Record<
      number,
      { messages: number; conversations: Set<string> }
    > = {};
    for (let hour = 0; hour < 24; hour++) {
      hourlyData[hour] = { messages: 0, conversations: new Set() };
    }

    todayMessages.forEach((msg) => {
      // Assuming data is already in GMT+7, use hours directly
      const hour = msg.createdAt.getHours();
      hourlyData[hour].messages++;
      hourlyData[hour].conversations.add(msg.conversationId);
    });

    const conversationTrends = Object.entries(conversationsByDate).map(
      ([date, conversationSet]) => ({ date, count: conversationSet.size })
    );
    const messageTrends = Object.entries(messagesByDate).map(
      ([date, counts]) => ({ date, ...counts })
    );
    const hourlyActivity = Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      messages: data.messages,
      conversations: data.conversations.size,
    }));

    console.log("Processed data:");
    console.log(
      "Conversations by date:",
      Object.fromEntries(
        Object.entries(conversationsByDate).map(([date, set]) => [
          date,
          set.size,
        ])
      )
    );

    // Fill in missing dates with zero counts for conversation trends (include today)
    const conversationData = [];
    for (let i = 0; i <= 30; i++) {
      // Changed to <= 30 to include today
      const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];

      const existingData = conversationTrends.find((d) => d.date === dateStr);
      const displayDate = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      console.log(
        `Date ${dateStr}: Found ${
          existingData?.count || 0
        } conversations, Display as: ${displayDate}`
      );

      conversationData.push({
        date: displayDate,
        conversations: existingData?.count || 0,
      });
    }

    // Fill in missing dates with zero counts for message trends (include today)
    const messageData = [];
    for (let i = 0; i <= 30; i++) {
      // Changed to <= 30 to include today
      const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];

      const existingData = messageTrends.find((d) => d.date === dateStr);
      const displayDate = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const userMessages = existingData?.user_messages || 0;
      const botMessages = existingData?.bot_messages || 0;
      const agentMessages = existingData?.agent_messages || 0;

      console.log(
        `Date ${dateStr}: User=${userMessages}, Bot=${botMessages}, Agent=${agentMessages}, Display as: ${displayDate}`
      );

      messageData.push({
        date: displayDate,
        userMessages,
        botMessages,
        agentMessages,
        total: userMessages + botMessages + agentMessages,
      });
    }

    // Fill in missing hours with zero counts for hourly activity
    const hourlyDataFormatted = [];
    for (let hour = 0; hour < 24; hour++) {
      const existingData = hourlyActivity.find((d) => d.hour === hour);
      hourlyDataFormatted.push({
        hour: `${hour.toString().padStart(2, "0")}:00`,
        messages: existingData?.messages || 0,
        conversations: existingData?.conversations || 0,
      });
    }

    console.log("Final chart data being returned:");
    console.log("Conversation trends sample:", conversationData.slice(-3));
    console.log("Message trends sample:", messageData.slice(-3));
    console.log("Hourly data sample:", hourlyDataFormatted.slice(13, 16)); // Around 1-3 PM

    return NextResponse.json({
      conversationTrends: conversationData,
      messageTrends: messageData,
      hourlyActivity: hourlyDataFormatted,
    });
  } catch (error) {
    console.error("Dashboard charts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}
