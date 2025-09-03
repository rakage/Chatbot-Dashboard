import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const botSettingsSchema = z.object({
  autoBot: z.boolean(),
});

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
    const { autoBot } = botSettingsSchema.parse(body);

    // Find the conversation and verify access
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

    // Update conversation bot settings
    const updatedConversation = await db.conversation.update({
      where: { id: conversationId },
      data: { autoBot },
    });

    console.log(
      `🤖 Auto bot ${
        autoBot ? "enabled" : "disabled"
      } for conversation ${conversationId}`
    );

    return NextResponse.json({
      success: true,
      conversation: {
        id: updatedConversation.id,
        autoBot: updatedConversation.autoBot,
      },
    });
  } catch (error) {
    console.error("Error updating bot settings:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update bot settings" },
      { status: 500 }
    );
  }
}
