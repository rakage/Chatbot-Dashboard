"use client";

import { useSession } from "next-auth/react";
import SystemStatus from "@/components/realtime/SystemStatus";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  Server,
  Database,
  Zap,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";

export default function SystemStatusPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Status</h1>
          <p className="text-gray-600 mt-1">
            Monitor real-time system health and performance
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Real-time System Status Component */}
      <div className="grid grid-cols-1 gap-6">
        <SystemStatus />
      </div>

      {/* Additional System Information */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>System Health</span>
            </CardTitle>
            <CardDescription>
              Current health metrics and performance indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Server className="h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium">Server Uptime</h4>
                    <p className="text-sm text-gray-600">System running time</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">99.9%</div>
                  <div className="text-xs text-gray-500">24h uptime</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Database className="h-5 w-5 text-purple-600" />
                  <div>
                    <h4 className="font-medium">Database Performance</h4>
                    <p className="text-sm text-gray-600">Query response time</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600">&lt; 50ms</div>
                  <div className="text-xs text-gray-500">Avg response</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="font-medium">Message Throughput</h4>
                    <p className="text-sm text-gray-600">Messages per minute</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-blue-600">~25 msg/min</div>
                  <div className="text-xs text-gray-500">Current rate</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Recent Events</span>
            </CardTitle>
            <CardDescription>
              System events, warnings, and notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">
                    All systems operational
                  </p>
                  <p className="text-xs text-green-600">2 minutes ago</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">
                    Socket.IO connection established
                  </p>
                  <p className="text-xs text-blue-600">5 minutes ago</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">
                    Redis cache cleared for maintenance
                  </p>
                  <p className="text-xs text-yellow-600">1 hour ago</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="w-2 h-2 bg-gray-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    Daily backup completed successfully
                  </p>
                  <p className="text-xs text-gray-600">3 hours ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Quick Actions</span>
          </CardTitle>
          <CardDescription>
            Common system management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Database className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-sm font-medium">Check DB</div>
            </button>
            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-sm font-medium">Test Messaging</div>
            </button>
            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Server className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <div className="text-sm font-medium">Restart Workers</div>
            </button>
            <button className="p-4 text-center border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Activity className="h-8 w-8 mx-auto mb-2 text-red-600" />
              <div className="text-sm font-medium">View Logs</div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
