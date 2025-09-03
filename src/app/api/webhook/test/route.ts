import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canManageSettings } from "@/lib/auth";

// Test webhook endpoint accessibility
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageSettings(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const webhookUrl = `${request.nextUrl.origin}/api/webhook/facebook`;

    // Test if webhook endpoint is accessible
    try {
      const testResponse = await fetch(
        `${webhookUrl}?hub.mode=subscribe&hub.verify_token=test&hub.challenge=test123`,
        {
          method: "GET",
          headers: {
            "User-Agent": "Facebook-Webhook-Test",
          },
        }
      );

      return NextResponse.json({
        webhookUrl,
        accessible: testResponse.ok,
        status: testResponse.status,
        message: testResponse.ok
          ? "Webhook endpoint is accessible"
          : "Webhook endpoint may not be properly configured",
      });
    } catch (error) {
      console.error("Webhook test error:", error);
      return NextResponse.json({
        webhookUrl,
        accessible: false,
        error: "Could not reach webhook endpoint",
        message: "Make sure your server is publicly accessible",
      });
    }
  } catch (error) {
    console.error("Webhook test error:", error);
    return NextResponse.json(
      { error: "Failed to test webhook" },
      { status: 500 }
    );
  }
}
