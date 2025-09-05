import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createFreshdeskAPI } from "@/lib/freshdesk";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    // Get user and company
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        company: {
          include: {
            freshdeskIntegration: true,
          },
        },
      },
    });

    if (!user?.companyId) {
      return NextResponse.json(
        { error: "User must be associated with a company" },
        { status: 400 }
      );
    }

    const freshdeskConfig = user.company?.freshdeskIntegration;
    if (!freshdeskConfig || !freshdeskConfig.enabled) {
      return NextResponse.json(
        { error: "Freshdesk integration not configured or disabled" },
        { status: 400 }
      );
    }

    // Get conversation to verify access
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

    // Verify conversation belongs to user's company
    if (conversation.page.company.id !== user.companyId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Create Freshdesk API instance
    const freshdeskAPI = await createFreshdeskAPI({
      domain: freshdeskConfig.domain,
      apiKeyEnc: freshdeskConfig.apiKeyEnc,
    });

    // For now, return empty array since we don't have a way to track tickets per conversation
    // In a future enhancement, we could store ticket IDs in conversation metadata
    // and fetch them from Freshdesk API
    const tickets: any[] = [];

    return NextResponse.json({
      success: true,
      tickets,
      conversation: {
        id: conversation.id,
        psid: conversation.psid,
        customerEmail: conversation.customerEmail,
        customerPhone: conversation.customerPhone,
      },
    });
  } catch (error) {
    console.error("Freshdesk conversation tickets fetch error:", error);

    // Handle specific Freshdesk API errors
    if (
      error instanceof Error &&
      error.message.includes("Freshdesk API error")
    ) {
      return NextResponse.json(
        {
          error: "Failed to fetch tickets from Freshdesk",
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch conversation tickets",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
