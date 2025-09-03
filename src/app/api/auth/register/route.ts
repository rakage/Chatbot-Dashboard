import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate email domain
    if (!email.endsWith("@salsationfitness.com")) {
      return NextResponse.json(
        { error: "Only @salsationfitness.com email addresses are allowed" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if this is the first user
    const userCount = await db.user.count();
    const isFirstUser = userCount === 0;

    // Create user
    let user;
    if (isFirstUser) {
      // First user becomes OWNER and gets a company
      const company = await db.company.create({
        data: {
          name: "Salsation Fitness",
        },
      });

      user = await db.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || email.split("@")[0],
          role: Role.OWNER,
          companyId: company.id,
        },
      });
    } else {
      // Subsequent users start as AGENT
      user = await db.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || email.split("@")[0],
          role: Role.AGENT,
        },
      });
    }

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
