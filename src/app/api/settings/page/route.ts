import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canManageSettings } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

export async function GET(request: NextRequest) {
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

    // Get page connections for the user's company
    const pageConnections = await db.pageConnection.findMany({
      where: {
        companyId: session.user.companyId,
      },
      select: {
        id: true,
        pageId: true,
        pageName: true,
        subscribed: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      pageConnections,
    });
  } catch (error) {
    console.error("Error fetching page connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch page connections" },
      { status: 500 }
    );
  }
}
