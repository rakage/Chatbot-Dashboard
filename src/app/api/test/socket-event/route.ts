import { NextRequest, NextResponse } from "next/server";
import { socketService } from "@/lib/socket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, message } = body;

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: "conversationId and message are required" },
        { status: 400 }
      );
    }

    console.log("🧪 Test API: Emitting test message:new event");

    const testEvent = {
      message: {
        id: "test-" + Date.now(),
        text: message,
        role: "USER",
        createdAt: new Date().toISOString(),
      },
      conversation: {
        id: conversationId,
        psid: "test-psid",
        status: "OPEN",
        autoBot: true,
      },
    };

    // Emit to dev-company room
    socketService.emitToCompany("dev-company", "message:new", testEvent);

    console.log("🧪 Test API: Event emitted successfully");

    return NextResponse.json({
      success: true,
      message: "Test event emitted successfully",
      data: testEvent,
    });
  } catch (error) {
    console.error("Test API error:", error);
    return NextResponse.json(
      { error: "Failed to emit test event" },
      { status: 500 }
    );
  }
}
