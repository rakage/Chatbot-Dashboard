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

    // Get current date and calculate date ranges
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch all stats in parallel
    const [
      totalConversations,
      lastMonthConversations,
      activeConversations,
      totalMessages,
      lastWeekMessages,
      botMessages,
      avgResponseTimeData,
      providerStats
    ] = await Promise.all([
      // Total conversations
      db.conversation.count({
        where: {
          page: { companyId }
        }
      }),
      
      // Last month conversations for growth calculation
      db.conversation.count({
        where: {
          page: { companyId },
          createdAt: { gte: lastMonth }
        }
      }),
      
      // Active conversations (not closed)
      db.conversation.count({
        where: {
          page: { companyId },
          status: { not: "CLOSED" }
        }
      }),
      
      // Total messages
      db.message.count({
        where: {
          conversation: {
            page: { companyId }
          }
        }
      }),
      
      // Last week messages for growth calculation
      db.message.count({
        where: {
          conversation: {
            page: { companyId }
          },
          createdAt: { gte: lastWeek }
        }
      }),
      
      // Bot messages
      db.message.count({
        where: {
          conversation: {
            page: { companyId }
          },
          role: "BOT"
        }
      }),
      
      // Average response time (simplified - time between user message and bot response)
      db.message.findMany({
        where: {
          conversation: {
            page: { companyId }
          },
          role: "BOT"
        },
        select: {
          createdAt: true,
          conversation: {
            select: {
              messages: {
                where: { role: "USER" },
                select: { createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 1
              }
            }
          }
        },
        take: 100, // Sample recent responses for performance
        orderBy: { createdAt: "desc" }
      }),
      
      // Provider usage stats
      db.message.groupBy({
        by: ["providerUsed"],
        where: {
          conversation: {
            page: { companyId }
          },
          role: "BOT",
          providerUsed: { not: null }
        },
        _count: true
      })
    ]);

    // Calculate average response time
    let avgResponseTimeMs = 0;
    let validResponseTimes = 0;
    
    avgResponseTimeData.forEach(botMessage => {
      const lastUserMessage = botMessage.conversation.messages[0];
      if (lastUserMessage) {
        const responseTime = botMessage.createdAt.getTime() - lastUserMessage.createdAt.getTime();
        if (responseTime > 0 && responseTime < 300000) { // Ignore responses > 5 minutes
          avgResponseTimeMs += responseTime;
          validResponseTimes++;
        }
      }
    });

    const avgResponseTime = validResponseTimes > 0 
      ? Math.round(avgResponseTimeMs / validResponseTimes / 1000) 
      : 0;

    // Calculate growth rates
    const conversationGrowth = totalConversations > 0 
      ? Math.round(((lastMonthConversations / totalConversations) * 100))
      : 0;
      
    const messageGrowth = totalMessages > 0
      ? Math.round(((lastWeekMessages / totalMessages) * 100))
      : 0;

    // Calculate automation rate
    const automationRate = totalMessages > 0 
      ? Math.round((botMessages / totalMessages) * 100)
      : 0;

    // Mock satisfaction rate (you can implement actual feedback collection later)
    const satisfactionRate = 4.2;

    const stats = {
      totalConversations,
      conversationGrowth,
      activeConversations,
      totalMessages,
      messageGrowth,
      botMessages,
      automationRate,
      avgResponseTime: `${avgResponseTime}s`,
      satisfactionRate,
      providerStats: providerStats.map(stat => ({
        provider: stat.providerUsed,
        count: stat._count
      }))
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
