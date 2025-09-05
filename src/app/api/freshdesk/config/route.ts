import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { createFreshdeskAPI } from "@/lib/freshdesk";
import { z } from "zod";

const configSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  apiKey: z.string().min(1, "API key is required"),
  enabled: z.boolean().default(true),
  autoCreate: z.boolean().default(true),
  defaultPriority: z.number().int().min(1).max(4).default(2),
  defaultStatus: z.number().int().min(2).max(5).default(2),
  defaultSource: z.number().int().default(7),
  defaultGroupId: z.string().optional(),
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
      include: { company: true },
    });

    if (!user?.companyId) {
      return NextResponse.json(
        { error: "User must be associated with a company" },
        { status: 400 }
      );
    }

    // Check if user has admin rights
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Insufficient permissions. Only owners and admins can configure integrations.",
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = configSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      domain,
      apiKey,
      enabled,
      autoCreate,
      defaultPriority,
      defaultStatus,
      defaultSource,
      defaultGroupId,
    } = validation.data;

    // Test the Freshdesk API connection before saving
    try {
      const testAPI = new (await import("@/lib/freshdesk")).FreshdeskAPI(
        domain,
        apiKey
      );
      const connectionTest = await testAPI.testConnection();

      if (!connectionTest.success) {
        return NextResponse.json(
          {
            error: "Failed to connect to Freshdesk",
            details: connectionTest.message,
          },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: "Invalid Freshdesk credentials or domain",
          details:
            error instanceof Error ? error.message : "Connection test failed",
        },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const apiKeyEnc = await encrypt(apiKey);

    // Upsert Freshdesk integration
    const integration = await db.freshdeskIntegration.upsert({
      where: { companyId: user.companyId },
      create: {
        companyId: user.companyId,
        domain: domain.replace(".freshdesk.com", ""), // Remove suffix if provided
        apiKeyEnc,
        enabled,
        autoCreate,
        defaultPriority,
        defaultStatus,
        defaultSource,
        ...(defaultGroupId && { defaultGroupId: BigInt(defaultGroupId) }),
      },
      update: {
        domain: domain.replace(".freshdesk.com", ""), // Remove suffix if provided
        apiKeyEnc,
        enabled,
        autoCreate,
        defaultPriority,
        defaultStatus,
        defaultSource,
        ...(defaultGroupId && { defaultGroupId: BigInt(defaultGroupId) }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        domain: integration.domain,
        enabled: integration.enabled,
        autoCreate: integration.autoCreate,
        defaultPriority: integration.defaultPriority,
        defaultStatus: integration.defaultStatus,
        defaultSource: integration.defaultSource,
        defaultGroupId: integration.defaultGroupId?.toString(),
        updatedAt: integration.updatedAt,
      },
    });
  } catch (error) {
    console.error("Freshdesk configuration error:", error);
    return NextResponse.json(
      {
        error: "Failed to save Freshdesk configuration",
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

    const integration = user.company?.freshdeskIntegration;

    if (!integration) {
      return NextResponse.json({
        configured: false,
        enabled: false,
      });
    }

    // Test connection if enabled
    let connectionStatus = null;
    if (integration.enabled) {
      try {
        const freshdeskAPI = await createFreshdeskAPI({
          domain: integration.domain,
          apiKeyEnc: integration.apiKeyEnc,
        });
        connectionStatus = await freshdeskAPI.testConnection();
      } catch (error) {
        connectionStatus = {
          success: false,
          message:
            error instanceof Error ? error.message : "Connection test failed",
        };
      }
    }

    return NextResponse.json({
      configured: true,
      integration: {
        id: integration.id,
        domain: integration.domain,
        enabled: integration.enabled,
        autoCreate: integration.autoCreate,
        defaultPriority: integration.defaultPriority,
        defaultStatus: integration.defaultStatus,
        defaultSource: integration.defaultSource,
        defaultGroupId: integration.defaultGroupId?.toString(),
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      },
      connectionStatus,
    });
  } catch (error) {
    console.error("Freshdesk config fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Freshdesk configuration" },
      { status: 500 }
    );
  }
}
