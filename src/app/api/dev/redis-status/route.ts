import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Try to connect to Redis
    const Redis = (await import("ioredis")).default;
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null, // Required for BullMQ compatibility
      lazyConnect: true,
      enableReadyCheck: false,
      keepAlive: 30000,
    });

    try {
      await redis.ping();
      await redis.disconnect();

      return NextResponse.json({
        status: "connected",
        message: "Redis is running and accessible",
        url: process.env.REDIS_URL || "redis://localhost:6379",
      });
    } catch (error) {
      await redis.disconnect();

      return NextResponse.json({
        status: "disconnected",
        message: "Redis is not running or not accessible",
        error: error instanceof Error ? error.message : "Unknown error",
        url: process.env.REDIS_URL || "redis://localhost:6379",
        solution:
          "Start Redis with: docker run -d -p 6379:6379 redis:alpine OR install Redis locally",
      });
    }
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: "Failed to check Redis status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
