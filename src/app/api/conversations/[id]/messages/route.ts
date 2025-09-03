import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessCompany } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const messagesQuerySchema = z.object({
  limit: z
    .string()
    .transform((val) => parseInt(val))
    .default("50"),
  cursor: z.string().optional(),
});

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
    const searchParams = request.nextUrl.searchParams;
    const query = messagesQuerySchema.parse(Object.fromEntries(searchParams));

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
      !canAccessCompany(
        session.user.role,
        session.user.companyId,
        conversation.page.company.id
      )
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Build where clause
    const where: any = {
      conversationId,
    };

    // Add cursor-based pagination
    if (query.cursor) {
      where.id = {
        lt: query.cursor,
      };
    }

    const messages = await db.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit + 1, // Take one extra to check if there are more
      select: {
        id: true,
        role: true,
        text: true,
        providerUsed: true,
        meta: true,
        createdAt: true,
      },
    });

    const hasMore = messages.length > query.limit;
    const results = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? results[results.length - 1]?.id : null;

    return NextResponse.json({
      messages: results.reverse(), // Reverse to get chronological order
      pagination: {
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
