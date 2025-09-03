import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canManageUsers } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!session.user.companyId) {
      return NextResponse.json(
        { error: "No company associated" },
        { status: 400 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user exists and belongs to the same company
    const userToDelete = await db.user.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: "User not found or access denied" },
        { status: 404 }
      );
    }

    // Prevent deletion of OWNER accounts
    if (userToDelete.role === Role.OWNER) {
      return NextResponse.json(
        { error: "Cannot delete OWNER account" },
        { status: 403 }
      );
    }

    // Prevent users from deleting themselves
    if (userToDelete.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 403 }
      );
    }

    // Only OWNER can delete ADMIN users
    if (userToDelete.role === Role.ADMIN && session.user.role !== Role.OWNER) {
      return NextResponse.json(
        { error: "Only OWNER can delete ADMIN users" },
        { status: 403 }
      );
    }

    // Delete the user
    await db.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

// GET /api/users/[id] - Get a specific user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!session.user.companyId) {
      return NextResponse.json(
        { error: "No company associated" },
        { status: 400 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get user if they belong to the same company
    const user = await db.user.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
