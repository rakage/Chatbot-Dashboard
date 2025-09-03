"use client";

import React, { memo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { CheckCircle } from "lucide-react";

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

interface DashboardChartsProps {
  chartData: ChartData;
  chartsLoading: boolean;
}

const conversationChartConfig = {
  conversations: {
    label: "Conversations",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const messageChartConfig = {
  userMessages: {
    label: "User Messages",
    color: "hsl(var(--chart-1))",
  },
  botMessages: {
    label: "Bot Messages",
    color: "hsl(var(--chart-2))",
  },
  agentMessages: {
    label: "Agent Messages",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const hourlyChartConfig = {
  messages: {
    label: "Messages",
    color: "hsl(var(--chart-1))",
  },
  conversations: {
    label: "Conversations",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const LoadingChart = memo(() => (
  <div className="h-[400px] flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Loading chart...</div>
  </div>
));

LoadingChart.displayName = "LoadingChart";

const ConversationTrendsChart = memo(
  ({ data }: { data: Array<{ date: string; conversations: number }> }) => (
    <ChartContainer
      config={conversationChartConfig}
      className="h-[400px] w-full"
    >
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="conversations"
          stroke="var(--color-conversations)"
          fill="var(--color-conversations)"
          fillOpacity={0.2}
          strokeWidth={2}
          animationBegin={0}
          animationDuration={800}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
);

ConversationTrendsChart.displayName = "ConversationTrendsChart";

const MessageActivityChart = memo(
  ({
    data,
  }: {
    data: Array<{
      date: string;
      userMessages: number;
      botMessages: number;
      agentMessages: number;
      total: number;
    }>;
  }) => (
    <ChartContainer config={messageChartConfig} className="h-[300px]">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="userMessages"
          stroke="var(--color-userMessages)"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="botMessages"
          stroke="var(--color-botMessages)"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="agentMessages"
          stroke="var(--color-agentMessages)"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
);

MessageActivityChart.displayName = "MessageActivityChart";

const HourlyActivityChart = memo(
  ({
    data,
  }: {
    data: Array<{ hour: string; messages: number; conversations: number }>;
  }) => (
    <ChartContainer config={hourlyChartConfig} className="h-[300px]">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="messages"
          stroke="var(--color-messages)"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="conversations"
          stroke="var(--color-conversations)"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
);

HourlyActivityChart.displayName = "HourlyActivityChart";

const DashboardCharts = memo(
  ({ chartData, chartsLoading }: DashboardChartsProps) => {
    return (
      <div className="space-y-6">
        {/* Conversation Trends Chart - Full Width */}
        <Card className="w-full" key="conversation-trends">
          <CardHeader>
            <CardTitle>Conversation Trends</CardTitle>
            <CardDescription>
              Daily conversation volume over the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <LoadingChart />
            ) : (
              <ConversationTrendsChart
                key={`conv-chart-${chartData.conversationTrends.length}`}
                data={chartData.conversationTrends}
              />
            )}
          </CardContent>
        </Card>

        {/* Message Trends Chart */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card key="message-activity">
            <CardHeader>
              <CardTitle>Message Activity</CardTitle>
              <CardDescription>
                Message breakdown by sender type (30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartsLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">
                    Loading chart...
                  </div>
                </div>
              ) : (
                <MessageActivityChart
                  key={`msg-chart-${chartData.messageTrends.length}`}
                  data={chartData.messageTrends}
                />
              )}
            </CardContent>
          </Card>

          {/* Today's Hourly Activity */}
          <Card key="hourly-activity">
            <CardHeader>
              <CardTitle>Today's Activity</CardTitle>
              <CardDescription>
                Hourly message and conversation activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartsLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground">
                    Loading chart...
                  </div>
                </div>
              ) : (
                <HourlyActivityChart
                  key={`hourly-chart-${chartData.hourlyActivity.length}`}
                  data={chartData.hourlyActivity}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card key="system-status">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              Current status of bot and integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">
                    Facebook Integration
                  </span>
                </div>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">AI Bot</span>
                </div>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">Message Queue</span>
                </div>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  Healthy
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
);

DashboardCharts.displayName = "DashboardCharts";

export default DashboardCharts;
