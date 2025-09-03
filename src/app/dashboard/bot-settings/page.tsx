"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, Brain, ArrowRight, Info } from "lucide-react";

export default function BotSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // Check if user has permission to access this page
  useEffect(() => {
    if (
      session?.user?.role &&
      !["OWNER", "ADMIN"].includes(session.user.role)
    ) {
      router.push("/dashboard");
    }
  }, [session, router]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bot Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure your bot integrations and AI settings
          </p>
        </div>
      </div>

      {/* Migration Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              Settings Have Been Reorganized!
            </h3>
            <p className="text-blue-800 mb-4">
              We've split the bot settings into two dedicated pages for better
              organization and easier management.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Integration Settings */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Link className="h-5 w-5 text-blue-600" />
              <span>Integration Settings</span>
            </CardTitle>
            <CardDescription>
              Connect and manage Facebook pages and other external services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">What's included:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Facebook Page connections</li>
                <li>• Webhook configuration</li>
                <li>• Third-party integrations</li>
                <li>• Connection status monitoring</li>
              </ul>
            </div>

            <Button
              onClick={() => router.push("/dashboard/integrations")}
              className="w-full"
            >
              Go to Integrations
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* LLM Configuration */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <span>LLM Configuration</span>
            </CardTitle>
            <CardDescription>
              Configure AI language models, providers, and behavior settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">What's included:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• AI provider selection (OpenAI, Gemini, etc.)</li>
                <li>• Model configuration and parameters</li>
                <li>• System prompts and behavior</li>
                <li>• Connection testing</li>
              </ul>
            </div>

            <Button
              onClick={() => router.push("/dashboard/llm-config")}
              className="w-full"
            >
              Go to LLM Config
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks you might want to perform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/integrations")}
              className="h-auto p-4 flex flex-col items-center space-y-2"
            >
              <Link className="h-6 w-6 text-blue-600" />
              <span className="text-sm">Connect Facebook Page</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/llm-config")}
              className="h-auto p-4 flex flex-col items-center space-y-2"
            >
              <Brain className="h-6 w-6 text-purple-600" />
              <span className="text-sm">Configure AI Model</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/training")}
              className="h-auto p-4 flex flex-col items-center space-y-2"
            >
              <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-green-600">AI</span>
              </div>
              <span className="text-sm">Train with Documents</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
