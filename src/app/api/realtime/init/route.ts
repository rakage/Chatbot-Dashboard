import { NextRequest, NextResponse } from "next/server";
import { initializeWorkers } from "@/lib/queue";

export async function POST(request: NextRequest) {
  try {
    console.log("Initializing real-time workers...");

    // Initialize message processing workers
    await initializeWorkers();

    return NextResponse.json({
      success: true,
      message: "Real-time workers initialized successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to initialize workers:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Failed to initialize real-time workers",
      },
      { status: 500 }
    );
  }
}
