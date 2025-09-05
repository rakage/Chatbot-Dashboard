import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createFreshdeskAPI,
  formatConversationForTicket,
  FRESHDESK_SOURCES,
  FRESHDESK_TICKET_TYPES,
} from "@/lib/freshdesk";
import { z } from "zod";

const createTicketSchema = z.object({
  conversationId: z.string(),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(4).default(2),
  status: z.number().int().min(2).max(5).default(2),
  type: z.string().optional(),
  includeConversationHistory: z.boolean().default(true),
  customFields: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Parse and validate request body
    const body = await request.json();
    const validation = createTicketSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      conversationId,
      subject,
      description,
      priority,
      status,
      type,
      includeConversationHistory,
      customFields,
      tags,
    } = validation.data;

    // Get conversation with messages and customer profile
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 10, // 10 newest messages
        },
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

    // Check if ticket already exists
    const existingTickets = (conversation.freshdeskTickets as any[]) || [];
    if (existingTickets.length > 0) {
      const latestTicket = existingTickets[existingTickets.length - 1];
      return NextResponse.json(
        {
          error: "Ticket already exists for this conversation",
          ticketId: latestTicket.id,
          ticketUrl: latestTicket.url,
          existingTickets: existingTickets,
        },
        { status: 400 }
      );
    }

    // Get customer profile from conversation meta or fetch it
    let customerProfile: any = null;
    try {
      if (conversation.meta && typeof conversation.meta === "object") {
        customerProfile = (conversation.meta as any).customerProfile;
      }
    } catch (error) {
      console.warn(
        "Could not parse customer profile from conversation meta:",
        error
      );
    }

    // Create Freshdesk API instance
    const freshdeskAPI = await createFreshdeskAPI({
      domain: freshdeskConfig.domain,
      apiKeyEnc: freshdeskConfig.apiKeyEnc,
    });

    // Prepare ticket description with metadata
    let ticketDescription = description || "";

    if (includeConversationHistory && conversation.messages.length > 0) {
      // Messages are already ordered by createdAt DESC (newest first)
      // Keep them in descending order for the ticket (newest at top)
      const formattedHistory = formatConversationForTicket(
        conversation.messages.map((msg) => ({
          role: msg.role,
          text: msg.text,
          createdAt: msg.createdAt.toISOString(),
        })),
        customerProfile
      );

      // Add conversation metadata to description since custom fields may not be available
      const metadata = `--- Conversation Metadata ---
Conversation ID: ${conversation.id}
Facebook PSID: ${conversation.psid}
Page ID: ${conversation.pageId}
${
  conversation.customerEmail
    ? `Customer Email: ${conversation.customerEmail}\n`
    : ""
}${
        conversation.customerPhone
          ? `Customer Phone: ${conversation.customerPhone}\n`
          : ""
      }
`;

      ticketDescription = description
        ? `${description}\n\n${metadata}\n${formattedHistory}`
        : `${metadata}\n${formattedHistory}`;
    }

    // Prepare ticket data
    const ticketData: any = {
      subject,
      description: ticketDescription,
      priority,
      status,
      source: FRESHDESK_SOURCES.CHAT, // Use Chat (7) as it's valid for Facebook messages
      type: type || FRESHDESK_TICKET_TYPES.GENERAL_INQUIRY, // Default to General Inquiry
      tags: [
        ...(tags || []),
        "chat-escalation",
        "facebook-messenger",
        `psid-${conversation.psid}`,
      ],
    };

    // Add requester information - email is required by Freshdesk
    const customerEmail = conversation.customerEmail || customerProfile?.email;
    if (customerEmail) {
      ticketData.email = customerEmail;
    } else {
      // If no email, we need to provide a fallback email or use phone
      const customerPhone =
        conversation.customerPhone || customerProfile?.phone;
      if (customerPhone) {
        ticketData.phone = customerPhone;
        // When using phone without email, name is mandatory
        ticketData.name = customerProfile
          ? `${customerProfile.firstName || ""} ${
              customerProfile.lastName || ""
            }`.trim()
          : `Facebook User ${conversation.psid.slice(-4)}`;
      } else {
        // Fallback: create a placeholder email based on PSID
        ticketData.email = `facebook-user-${conversation.psid}@placeholder.local`;
        ticketData.name = customerProfile
          ? `${customerProfile.firstName || ""} ${
              customerProfile.lastName || ""
            }`.trim()
          : `Facebook User ${conversation.psid.slice(-4)}`;
      }
    }

    // Add name if available and email is used
    if (customerEmail && customerProfile) {
      const customerName = `${customerProfile.firstName || ""} ${
        customerProfile.lastName || ""
      }`.trim();
      if (customerName) {
        ticketData.name = customerName;
      }
    }

    // Add phone if available
    const customerPhone = conversation.customerPhone || customerProfile?.phone;
    if (customerPhone && !ticketData.phone) {
      ticketData.phone = customerPhone;
    }

    // Add default group ID (required by this Freshdesk instance)
    // Use configured default or fallback to 1 (usually the default group)
    ticketData.group_id = freshdeskConfig.defaultGroupId
      ? Number(freshdeskConfig.defaultGroupId)
      : 1;

    // Only add custom fields if they were explicitly provided
    // Note: Custom fields need to be created in Freshdesk first
    if (customFields && Object.keys(customFields).length > 0) {
      ticketData.custom_fields = customFields;
    }

    // Debug: Log the ticket data being sent
    console.log(
      "🎫 Creating Freshdesk ticket with data:",
      JSON.stringify(ticketData, null, 2)
    );

    // Create ticket in Freshdesk
    const ticket = await freshdeskAPI.createTicket(ticketData);

    // Update conversation with ticket information
    const ticketUrl = `https://${freshdeskConfig.domain}.freshdesk.com/a/tickets/${ticket.id}`;

    // Get existing tickets array or initialize empty array
    const currentTickets = (conversation.freshdeskTickets as any[]) || [];

    // Add new ticket to the array
    const newTicket = {
      id: ticket.id,
      url: ticketUrl,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.created_at,
    };

    const updatedTickets = [...currentTickets, newTicket];

    await db.conversation.update({
      where: { id: conversationId },
      data: {
        freshdeskTickets: updatedTickets,
        status: "OPEN", // Keep conversation open for continued monitoring
        updatedAt: new Date(),
      },
    });

    // Log the ticket creation
    console.log(
      `✅ Freshdesk ticket created: ${ticket.id} for conversation ${conversationId}`
    );

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        url: ticketUrl,
        createdAt: ticket.created_at,
      },
      conversation: {
        id: conversation.id,
        freshdeskTickets: updatedTickets,
      },
    });
  } catch (error) {
    console.error("Freshdesk ticket creation error:", error);

    // Handle specific Freshdesk API errors
    if (
      error instanceof Error &&
      error.message.includes("Freshdesk API error")
    ) {
      return NextResponse.json(
        {
          error: "Failed to create ticket in Freshdesk",
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({
      enabled: freshdeskConfig?.enabled || false,
      configured: !!freshdeskConfig,
      domain: freshdeskConfig?.domain,
      defaultPriority: freshdeskConfig?.defaultPriority || 2,
      defaultStatus: freshdeskConfig?.defaultStatus || 2,
    });
  } catch (error) {
    console.error("Freshdesk config fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Freshdesk configuration" },
      { status: 500 }
    );
  }
}
