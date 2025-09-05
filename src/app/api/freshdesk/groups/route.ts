import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createFreshdeskAPI } from "@/lib/freshdesk";

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
    if (!freshdeskConfig || !freshdeskConfig.enabled) {
      return NextResponse.json(
        { error: "Freshdesk integration not configured or disabled" },
        { status: 400 }
      );
    }

    // Create Freshdesk API instance
    const freshdeskAPI = await createFreshdeskAPI({
      domain: freshdeskConfig.domain,
      apiKeyEnc: freshdeskConfig.apiKeyEnc,
    });

    // Fetch groups
    const groups = await freshdeskAPI.getGroups();

    return NextResponse.json({
      success: true,
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
      })),
    });
  } catch (error) {
    console.error("Freshdesk groups fetch error:", error);

    // Handle specific Freshdesk API errors
    if (
      error instanceof Error &&
      error.message.includes("Freshdesk API error")
    ) {
      return NextResponse.json(
        {
          error: "Failed to fetch groups from Freshdesk",
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch groups",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
