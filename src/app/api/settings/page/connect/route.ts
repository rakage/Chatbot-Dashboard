import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canManageSettings } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { facebookAPI } from "@/lib/facebook";
import { z } from "zod";

const pageConnectSchema = z.object({
  pageId: z.string().min(1),
  pageName: z.string().min(1),
  pageAccessToken: z.string().min(1),
  verifyToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    console.log("🔌 Page connect request received");

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.error("❌ No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageSettings(session.user.role)) {
      console.error("❌ User doesn't have permission:", session.user.role);
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!session.user.companyId) {
      console.error("❌ No company associated with user");
      return NextResponse.json(
        { error: "No company associated" },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log("📝 Request body received:", {
      pageId: body.pageId,
      pageName: body.pageName,
      hasAccessToken: !!body.pageAccessToken,
      hasVerifyToken: !!body.verifyToken,
    });
    const { pageId, pageName, pageAccessToken, verifyToken } =
      pageConnectSchema.parse(body);

    // Validate page access token if Facebook API is available
    let pageInfo = { id: pageId, name: pageName };
    try {
      console.log("🔍 Attempting to validate page with Facebook API");
      pageInfo = await facebookAPI.getPageInfo(pageAccessToken);
      console.log("✅ Facebook API validation successful:", pageInfo);
    } catch (error) {
      console.warn("⚠️ Could not validate page info with Facebook API:", error);
      console.log("📝 Using provided values as fallback");
      // Use provided values as fallback
    }

    // Encrypt tokens
    console.log("🔐 Encrypting tokens");
    let encryptedPageToken: string;
    let encryptedVerifyToken: string;

    try {
      console.log("🔐 Encrypting page access token...");
      encryptedPageToken = await encrypt(pageAccessToken);
      console.log(
        "✅ Page access token encrypted, length:",
        encryptedPageToken.length
      );

      console.log("🔐 Encrypting verify token...");
      encryptedVerifyToken = await encrypt(verifyToken);
      console.log(
        "✅ Verify token encrypted, length:",
        encryptedVerifyToken.length
      );

      console.log("✅ Both tokens encrypted successfully");
    } catch (encryptError) {
      console.error("❌ Encryption failed:", encryptError);
      throw new Error(
        `Encryption failed: ${
          encryptError instanceof Error ? encryptError.message : "Unknown error"
        }`
      );
    }

    // Create or update page connection
    console.log("💾 Saving page connection to database");
    const pageConnection = await db.pageConnection.upsert({
      where: { pageId: pageInfo.id },
      create: {
        companyId: session.user.companyId,
        pageId: pageInfo.id,
        pageName: pageInfo.name,
        pageAccessTokenEnc: encryptedPageToken,
        verifyTokenEnc: encryptedVerifyToken,
        subscribed: false,
      },
      update: {
        pageName: pageInfo.name,
        pageAccessTokenEnc: encryptedPageToken,
        verifyTokenEnc: encryptedVerifyToken,
      },
    });

    console.log(
      "✅ Page connection saved successfully:",
      pageConnection.pageId
    );

    return NextResponse.json({
      page: {
        id: pageConnection.id,
        pageId: pageConnection.pageId,
        pageName: pageConnection.pageName,
        subscribed: pageConnection.subscribed,
      },
    });
  } catch (error) {
    console.error("❌ Connect page error:", error);

    if (error instanceof z.ZodError) {
      console.error("❌ Validation error:", error.errors);
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to connect page" },
      { status: 500 }
    );
  }
}
