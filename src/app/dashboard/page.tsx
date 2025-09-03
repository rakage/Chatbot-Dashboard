"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MessageSquare,
  Users,
  Bot,
  TrendingUp,
  Clock,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import DashboardCharts from "@/components/dashboard/DashboardCharts";

interface DashboardStats {
  totalConversations: number;
  conversationGrowth: number;
  activeConversations: number;
  totalMessages: number;
  messageGrowth: number;
  botMessages: number;
  automationRate: number;
  avgResponseTime: string;
  satisfactionRate: number;
  providerStats: Array<{ provider: string; count: number }>;
}

interface ChartData {
  conversationTrends: Array<{ date: string; conversations: number }>;
  messageTrends: Array<{
    date: string;
    userMessages: number;
    botMessages: number;
    agentMessages: number;
    total: number;
  }>;
  hourlyActivity: Array<{
    hour: string;
    messages: number;
    conversations: number;
  }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    conversationGrowth: 0,
    activeConversations: 0,
    totalMessages: 0,
    messageGrowth: 0,
    botMessages: 0,
    automationRate: 0,
    avgResponseTime: "0s",
    satisfactionRate: 0,
    providerStats: [],
  });
  const [chartData, setChartData] = useState<ChartData>({
    conversationTrends: [],
    messageTrends: [],
    hourlyActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch stats and charts in parallel
      const [statsResponse, chartsResponse] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/dashboard/charts"),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (chartsResponse.ok) {
        const chartsData = await chartsResponse.json();
        console.log("Frontend received chart data:", chartsData);
        console.log(
          "Conversation trends last 3 days:",
          chartsData.conversationTrends?.slice(-3)
        );
        console.log(
          "Message trends last 3 days:",
          chartsData.messageTrends?.slice(-3)
        );
        setChartData(chartsData);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      // Fallback to mock data
      setStats({
        totalConversations: 156,
        conversationGrowth: 12,
        activeConversations: 23,
        totalMessages: 1247,
        messageGrowth: 8,
        botMessages: 789,
        automationRate: 63,
        avgResponseTime: "2.3s",
        satisfactionRate: 4.2,
        providerStats: [
          { provider: "OPENAI", count: 450 },
          { provider: "GEMINI", count: 339 },
        ],
      });

      // Mock chart data
      const mockConversationTrends = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
        return {
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          conversations: Math.floor(Math.random() * 20) + 5,
        };
      });

      const mockMessageTrends = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
        const userMessages = Math.floor(Math.random() * 50) + 10;
        const botMessages = Math.floor(Math.random() * 40) + 5;
        const agentMessages = Math.floor(Math.random() * 15) + 2;
        return {
          date: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          userMessages,
          botMessages,
          agentMessages,
          total: userMessages + botMessages + agentMessages,
        };
      });

      const mockHourlyActivity = Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, "0")}:00`,
        messages: Math.floor(Math.random() * 30) + 5,
        conversations: Math.floor(Math.random() * 10) + 1,
      }));

      setChartData({
        conversationTrends: mockConversationTrends,
        messageTrends: mockMessageTrends,
        hourlyActivity: mockHourlyActivity,
      });
    } finally {
      setLoading(false);
      setChartsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.companyId) {
      fetchDashboardData();
    } else {
      setLoading(false);
      setChartsLoading(false);
    }
  }, [session?.user?.companyId, fetchDashboardData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <div className="text-sm text-gray-500">
          Welcome back, {session?.user?.name || session?.user?.email}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Conversations
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalConversations.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {stats.conversationGrowth > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              {Math.abs(stats.conversationGrowth)}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.activeConversations.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Currently ongoing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Messages
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalMessages.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {stats.messageGrowth > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              {Math.abs(stats.messageGrowth)}% from last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Automation Rate
            </CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.automationRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.botMessages.toLocaleString()} bot responses
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Response Time
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponseTime}</div>
            <p className="text-xs text-muted-foreground">Target: &lt;5s</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Satisfaction Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.satisfactionRate}/5</div>
            <p className="text-xs text-muted-foreground">
              Based on user feedback
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LLM Provider</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.providerStats.length > 0
                ? stats.providerStats[0].provider
                : "None"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.providerStats
                .reduce((sum, p) => sum + p.count, 0)
                .toLocaleString()}{" "}
              responses
            </p>
          </CardContent>
        </Card>
      </div>

      <DashboardCharts
        key={`dashboard-charts-${session?.user?.companyId || "anonymous"}`}
        chartData={chartData}
        chartsLoading={chartsLoading}
      />
    </div>
  );
}
