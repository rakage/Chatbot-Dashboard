"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Zap,
  MessageSquare,
} from "lucide-react";

interface SystemStatus {
  redis: {
    status: "connected" | "disconnected" | "error";
    message: string;
  };
  socket: {
    status: "connected" | "disconnected";
    message: string;
  };
  workers: {
    status: "running" | "stopped" | "error";
    message: string;
  };
}

export default function SystemStatus() {
  const { isConnected } = useSocket();
  const [status, setStatus] = useState<SystemStatus>({
    redis: { status: "disconnected", message: "Checking..." },
    socket: { status: "disconnected", message: "Checking..." },
    workers: { status: "stopped", message: "Checking..." },
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSystemStatus();
  }, []);

  useEffect(() => {
    setStatus((prev) => ({
      ...prev,
      socket: {
        status: isConnected ? "connected" : "disconnected",
        message: isConnected ? "Socket.IO connected" : "Socket.IO disconnected",
      },
    }));
  }, [isConnected]);

  const checkSystemStatus = async () => {
    setLoading(true);

    try {
      // Check Redis status
      const redisResponse = await fetch("/api/dev/redis-status");
      const redisData = await redisResponse.json();

      setStatus((prev) => ({
        ...prev,
        redis: {
          status:
            redisData.status === "connected" ? "connected" : "disconnected",
          message: redisData.message,
        },
      }));

      // If Redis is connected, try to initialize workers
      if (redisData.status === "connected") {
        try {
          const workersResponse = await fetch("/api/realtime/init", {
            method: "POST",
          });
          const workersData = await workersResponse.json();

          setStatus((prev) => ({
            ...prev,
            workers: {
              status: workersData.success ? "running" : "error",
              message: workersData.message,
            },
          }));
        } catch (workerError) {
          setStatus((prev) => ({
            ...prev,
            workers: {
              status: "error",
              message: "Failed to initialize workers",
            },
          }));
        }
      } else {
        setStatus((prev) => ({
          ...prev,
          workers: {
            status: "stopped",
            message: "Workers require Redis connection",
          },
        }));
      }
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        redis: {
          status: "error",
          message: "Failed to check Redis status",
        },
      }));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
      case "running":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "disconnected":
      case "stopped":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
      case "running":
        return "bg-green-100 text-green-800";
      case "disconnected":
      case "stopped":
        return "bg-red-100 text-red-800";
      case "error":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Real-time System Status</span>
          </CardTitle>
          <Button
            onClick={checkSystemStatus}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Redis Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Database className="h-6 w-6 text-red-600" />
            <div>
              <h4 className="font-medium">Redis Database</h4>
              <p className="text-sm text-gray-600">{status.redis.message}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(status.redis.status)}
            <Badge className={getStatusColor(status.redis.status)}>
              {status.redis.status}
            </Badge>
          </div>
        </div>

        {/* Socket.IO Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            <div>
              <h4 className="font-medium">Socket.IO Connection</h4>
              <p className="text-sm text-gray-600">{status.socket.message}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(status.socket.status)}
            <Badge className={getStatusColor(status.socket.status)}>
              {status.socket.status}
            </Badge>
          </div>
        </div>

        {/* Workers Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <Zap className="h-6 w-6 text-purple-600" />
            <div>
              <h4 className="font-medium">Message Workers</h4>
              <p className="text-sm text-gray-600">{status.workers.message}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(status.workers.status)}
            <Badge className={getStatusColor(status.workers.status)}>
              {status.workers.status}
            </Badge>
          </div>
        </div>

        {/* Overall Status */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="font-medium">Overall System Status:</span>
            <Badge
              className={
                status.redis.status === "connected" &&
                status.socket.status === "connected" &&
                status.workers.status === "running"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }
            >
              {status.redis.status === "connected" &&
              status.socket.status === "connected" &&
              status.workers.status === "running"
                ? "Fully Operational"
                : "Partial Operation"}
            </Badge>
          </div>

          {status.redis.status !== "connected" && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Redis Setup Required:</strong> Start Redis with:{" "}
                <code className="bg-yellow-100 px-1 rounded">
                  docker run -d -p 6379:6379 redis:alpine
                </code>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
