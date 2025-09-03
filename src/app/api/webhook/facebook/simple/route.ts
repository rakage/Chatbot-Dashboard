import { NextRequest, NextResponse } from "next/server";

// Simple webhook endpoint for testing without Redis dependency
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("Simple webhook verification:", {
    mode,
    token: token ? "***" : null,
    challenge,
  });

  if (!mode || !token || !challenge) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  if (mode === "subscribe") {
    // For testing, accept any token (or check against environment variable)
    const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || "test_token_123";

    if (token === expectedToken) {
      console.log("Simple webhook verified successfully");
      return new NextResponse(challenge, {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    } else {
      console.log("Invalid token. Expected:", expectedToken, "Got:", token);
      return NextResponse.json(
        { error: "Invalid verify token" },
        { status: 403 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
}

// Simple POST handler for webhook events (just logs them)
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log("Received webhook event:", body);

    // Just acknowledge receipt without processing
    return NextResponse.json({ status: "received" });
  } catch (error) {
    console.error("Simple webhook error:", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
