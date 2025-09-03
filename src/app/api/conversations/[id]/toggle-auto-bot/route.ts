import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessCompany } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const toggleAutoBotSchema = z.object({
  autoBot: z.boolean(),
});

export async function POST(
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
    const { autoBot } = toggleAutoBotSchema.parse(body);

    // Get conversation with related data
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

    // Update auto-bot setting
    const updatedConversation = await db.conversation.update({
      where: { id: conversationId },
      data: { autoBot },
    });

    return NextResponse.json({
      id: updatedConversation.id,
      autoBot: updatedConversation.autoBot,
    });
  } catch (error) {
    console.error("Toggle auto-bot error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
