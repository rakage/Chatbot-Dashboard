import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { conversationId, messageText, senderPsid } = await request.json();

    if (!conversationId || !messageText || !senderPsid) {
      return NextResponse.json(
        { error: "conversationId, messageText, and senderPsid are required" },
        { status: 400 }
      );
    }

    console.log("🧪 Simulating Facebook webhook message");

    // Create a simulated Facebook webhook payload
    const webhookPayload = {
      object: "page",
      entry: [
        {
          id: "test-page-id",
          time: Date.now(),
          messaging: [
            {
              sender: { id: senderPsid },
              recipient: { id: "test-page-id" },
              timestamp: Date.now(),
              message: {
                mid: "test-message-" + Date.now(),
                text: messageText,
              },
            },
          ],
        },
      ],
    };

    // Send to the main Facebook webhook endpoint
    const webhookResponse = await fetch(
      "http://localhost:3000/api/webhook/facebook",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature": "test-signature", // Will be skipped in development
        },
        body: JSON.stringify(webhookPayload),
      }
    );

    const webhookResult = await webhookResponse.text();

    return NextResponse.json({
      success: true,
      message: "Simulated Facebook message sent to webhook",
      webhookResponse: {
        status: webhookResponse.status,
        body: webhookResult,
      },
      payload: webhookPayload,
    });
  } catch (error) {
    console.error("Test Facebook message error:", error);
    return NextResponse.json(
      { error: "Failed to simulate Facebook message" },
      { status: 500 }
    );
  }
}
