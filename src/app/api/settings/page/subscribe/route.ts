import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canManageSettings } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { facebookAPI } from "@/lib/facebook";
import { z } from "zod";

const subscribeSchema = z.object({
  pageId: z.string(),
  subscribe: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageSettings(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!session.user.companyId) {
      return NextResponse.json(
        { error: "No company associated" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { pageId, subscribe } = subscribeSchema.parse(body);

    // Get page connection
    const pageConnection = await db.pageConnection.findFirst({
      where: {
        pageId,
        companyId: session.user.companyId,
      },
    });

    if (!pageConnection) {
      return NextResponse.json(
        { error: "Page not connected" },
        { status: 404 }
      );
    }

    // Decrypt page access token
    const pageAccessToken = await decrypt(pageConnection.pageAccessTokenEnc);

    try {
      if (subscribe) {
        // Subscribe to webhook
        await facebookAPI.subscribePageToWebhook(pageAccessToken);
      } else {
        // Unsubscribe from webhook
        await facebookAPI.unsubscribePageFromWebhook(pageAccessToken);
      }

      // Update subscription status
      const updatedPage = await db.pageConnection.update({
        where: { id: pageConnection.id },
        data: { subscribed: subscribe },
      });

      return NextResponse.json({
        page: {
          id: updatedPage.id,
          pageId: updatedPage.pageId,
          pageName: updatedPage.pageName,
          subscribed: updatedPage.subscribed,
        },
      });
    } catch (facebookError) {
      console.error("Facebook API error:", facebookError);
      return NextResponse.json(
        { error: "Failed to update webhook subscription" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Subscribe/unsubscribe error:", error);

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
