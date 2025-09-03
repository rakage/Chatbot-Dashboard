import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

export default redis;
