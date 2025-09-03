import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions, canManageUsers } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  role: z.enum([Role.ADMIN, Role.AGENT], {
    errorMap: () => ({ message: "Role must be ADMIN or AGENT" }),
  }),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const updateUserSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  name: z.string().min(1, "Name is required").optional(),
  role: z.enum([Role.ADMIN, Role.AGENT]).optional(),
  email: z.string().email("Invalid email address").optional(),
});

// GET /api/users - List all users in the company
export async function GET(request: NextRequest) {
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

    // Get all users in the same company
    const users = await db.user.findMany({
      where: {
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
      orderBy: [
        { role: "asc" }, // OWNER, ADMIN, AGENT
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = createUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { email, name, role, password } = validation.data;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Only OWNER can create ADMIN users
    if (role === Role.ADMIN && session.user.role !== Role.OWNER) {
      return NextResponse.json(
        { error: "Only OWNER can create ADMIN users" },
        { status: 403 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await db.user.create({
      data: {
        email,
        name,
        role,
        password: hashedPassword,
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

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

// PUT /api/users - Update a user
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { id, name, role, email } = validation.data;

    // Check if user exists and belongs to the same company
    const existingUser = await db.user.findFirst({
      where: {
        id,
        companyId: session.user.companyId,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found or access denied" },
        { status: 404 }
      );
    }

    // Prevent users from modifying OWNER accounts
    if (existingUser.role === Role.OWNER) {
      return NextResponse.json(
        { error: "Cannot modify OWNER account" },
        { status: 403 }
      );
    }

    // Only OWNER can create/modify ADMIN users
    if (role === Role.ADMIN && session.user.role !== Role.OWNER) {
      return NextResponse.json(
        { error: "Only OWNER can create or modify ADMIN users" },
        { status: 403 }
      );
    }

    // Prevent users from modifying themselves (except name)
    if (existingUser.id === session.user.id && (role || email)) {
      return NextResponse.json(
        { error: "Cannot modify your own role or email" },
        { status: 403 }
      );
    }

    // Check if email is already taken (if changing email)
    if (email && email !== existingUser.email) {
      const emailTaken = await db.user.findUnique({
        where: { email },
      });

      if (emailTaken) {
        return NextResponse.json(
          { error: "Email is already taken" },
          { status: 400 }
        );
      }
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(role && { role }),
        ...(email && { email }),
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

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
