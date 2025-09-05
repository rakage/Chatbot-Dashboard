import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { facebookAPI } from "@/lib/facebook";
import { decrypt } from "@/lib/encryption";

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

    // Get conversation with page connection info
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

    // Check if we have cached profile data
    const cachedProfile = conversation.meta as any;
    if (
      cachedProfile?.customerProfile?.cached &&
      cachedProfile?.customerProfile?.cachedAt
    ) {
      const cacheAge =
        Date.now() - new Date(cachedProfile.customerProfile.cachedAt).getTime();
      // Cache for 24 hours
      if (cacheAge < 24 * 60 * 60 * 1000) {
        return NextResponse.json({
          profile: cachedProfile.customerProfile,
          source: "cache",
        });
      }
    }

    try {
      // Decrypt page access token
      const pageAccessToken = await decrypt(
        conversation.page.pageAccessTokenEnc
      );

      // Fetch user profile from Facebook
      const profile = await facebookAPI.getUserProfile(
        conversation.psid,
        pageAccessToken,
        ["first_name", "last_name", "profile_pic", "locale"]
      );

      // Enhanced profile data
      const enhancedProfile = {
        id: conversation.psid,
        firstName: profile.first_name || "Unknown",
        lastName: profile.last_name || "",
        fullName: `${profile.first_name || "Unknown"} ${
          profile.last_name || ""
        }`.trim(),
        profilePicture: profile.profile_pic || null,
        locale: profile.locale || "en_US",
        facebookUrl: `https://www.facebook.com/${conversation.psid}`,
        cached: true,
        cachedAt: new Date().toISOString(),
      };

      // Cache the profile data in conversation metadata
      await db.conversation.update({
        where: { id: conversationId },
        data: {
          meta: {
            ...((conversation.meta as any) || {}),
            customerProfile: enhancedProfile,
          },
        },
      });
      return NextResponse.json({
        profile: enhancedProfile,
        source: "facebook_api",
      });
    } catch (facebookError) {
      console.error("Facebook API error:", facebookError);

      // Return fallback profile data
      const fallbackProfile = {
        id: conversation.psid,
        firstName: "Customer",
        lastName: `#${conversation.psid.slice(-4)}`,
        fullName: `Customer #${conversation.psid.slice(-4)}`,
        profilePicture: null,
        locale: "en_US",
        facebookUrl: `https://www.facebook.com/${conversation.psid}`,
        cached: false,
        error: "Facebook API unavailable",
      };

      return NextResponse.json({
        profile: fallbackProfile,
        source: "fallback",
        error: "Could not fetch from Facebook API",
      });
    }
  } catch (error) {
    console.error("Error fetching customer profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer profile" },
      { status: 500 }
    );
  }
}
