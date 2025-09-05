"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  Facebook,
  Link,
  Unlink,
  Ticket,
  Settings,
  ExternalLink,
} from "lucide-react";

export default function IntegrationsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [existingPageConnections, setExistingPageConnections] = useState<any[]>(
    []
  );

  const [facebookSettings, setFacebookSettings] = useState({
    pageId: "",
    pageName: "",
    accessToken: "",
    verifyToken: "",
  });

  // Check if user has permission to access this page
  useEffect(() => {
    if (
      session?.user?.role &&
      !["OWNER", "ADMIN"].includes(session.user.role)
    ) {
      router.push("/dashboard");
    }

    if (session?.user) {
      loadExistingPageConnections();
    }
  }, [session, router]);

  const loadExistingPageConnections = async () => {
    try {
      const response = await fetch("/api/settings/page");
      if (response.ok) {
        const data = await response.json();
        setExistingPageConnections(data.pageConnections || []);
      }
    } catch (error) {
      console.error("Failed to load existing page connections:", error);
    }
  };

  const handleFacebookSave = async () => {
    setFacebookLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/settings/page/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageId: facebookSettings.pageId,
          pageName: facebookSettings.pageName,
          pageAccessToken: facebookSettings.accessToken,
          verifyToken: facebookSettings.verifyToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to connect page");
        return;
      }

      setSuccess("Facebook page connected successfully!");
      loadExistingPageConnections();
      setFacebookSettings({
        pageId: "",
        pageName: "",
        accessToken: "",
        verifyToken: "",
      });
    } catch (error) {
      setError("Failed to connect page");
      console.error("Facebook save error:", error);
    } finally {
      setFacebookLoading(false);
    }
  };

  const handleDisconnectPage = async (pageId: string) => {
    if (!confirm("Are you sure you want to disconnect this page?")) return;

    try {
      const response = await fetch(`/api/settings/page/disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pageId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to disconnect page");
        return;
      }

      setSuccess("Page disconnected successfully!");
      loadExistingPageConnections();
    } catch (error) {
      setError("Failed to disconnect page");
      console.error("Disconnect error:", error);
    }
  };

  // Auto-dismiss messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Integration Settings
        </h1>
        <p className="text-gray-600 mt-1">
          Connect and manage external services and platforms
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center p-4 mb-4 text-green-700 bg-green-100 rounded-lg">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Existing Facebook Connections */}
        {existingPageConnections.length > 0 && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Facebook className="h-5 w-5 text-blue-600" />
                  <span>Connected Facebook Pages</span>
                </CardTitle>
                <CardDescription>
                  Manage your connected Facebook pages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {existingPageConnections.map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Facebook className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {page.pageName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Page ID: {page.pageId}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge
                              variant={
                                page.webhookConnected ? "default" : "secondary"
                              }
                              className="text-xs"
                            >
                              {page.webhookConnected
                                ? "Connected"
                                : "Disconnected"}
                            </Badge>
                            {page.webhookConnected && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnectPage(page.pageId)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Unlink className="h-4 w-4 mr-1" />
                        Disconnect
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Facebook Page Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Facebook className="h-5 w-5 text-blue-600" />
              <span>Connect Facebook Page</span>
            </CardTitle>
            <CardDescription>
              Connect a new Facebook page to enable Messenger bot functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="page-id"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Page ID
              </label>
              <Input
                id="page-id"
                type="text"
                value={facebookSettings.pageId}
                onChange={(e) =>
                  setFacebookSettings((prev) => ({
                    ...prev,
                    pageId: e.target.value,
                  }))
                }
                placeholder="Enter Facebook Page ID"
              />
            </div>

            <div>
              <label
                htmlFor="page-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Page Name
              </label>
              <Input
                id="page-name"
                type="text"
                value={facebookSettings.pageName}
                onChange={(e) =>
                  setFacebookSettings((prev) => ({
                    ...prev,
                    pageName: e.target.value,
                  }))
                }
                placeholder="Enter Page Name"
              />
            </div>

            <div>
              <label
                htmlFor="access-token"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Page Access Token
              </label>
              <Input
                id="access-token"
                type="password"
                value={facebookSettings.accessToken}
                onChange={(e) =>
                  setFacebookSettings((prev) => ({
                    ...prev,
                    accessToken: e.target.value,
                  }))
                }
                placeholder="Enter Page Access Token"
              />
            </div>

            <div>
              <label
                htmlFor="verify-token"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Webhook Verify Token
              </label>
              <Input
                id="verify-token"
                type="text"
                value={facebookSettings.verifyToken}
                onChange={(e) =>
                  setFacebookSettings((prev) => ({
                    ...prev,
                    verifyToken: e.target.value,
                  }))
                }
                placeholder="Enter Webhook Verify Token"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">
                Setup Instructions
              </h4>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                <li>
                  Create a Facebook App at <code>developers.facebook.com</code>
                </li>
                <li>Add Messenger product to your app</li>
                <li>Generate a Page Access Token</li>
                <li>Set up webhook with your verify token</li>
                <li>Subscribe to page messaging events</li>
              </ol>
            </div>

            <Button
              onClick={handleFacebookSave}
              disabled={
                facebookLoading ||
                !facebookSettings.pageId ||
                !facebookSettings.pageName ||
                !facebookSettings.accessToken ||
                !facebookSettings.verifyToken
              }
              className="w-full"
            >
              {facebookLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Connect Page
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Freshdesk Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Ticket className="h-5 w-5 text-blue-600" />
              <span>Freshdesk Integration</span>
            </CardTitle>
            <CardDescription>
              Create support tickets from chat conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Ticket className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    Freshdesk Ticketing
                  </h3>
                  <p className="text-sm text-gray-500">
                    salsationfitness.freshdesk.com
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      "https://salsationfitness.freshdesk.com",
                      "_blank"
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push("/dashboard/integrations/freshdesk")
                  }
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Configure
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Features</h4>
              <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                <li>Manual ticket creation from conversations</li>
                <li>Automatic conversation history inclusion</li>
                <li>Customer information sync</li>
                <li>Customizable priority and status</li>
                <li>Direct links to created tickets</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Future Integrations */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="h-5 w-5 bg-gray-400 rounded"></div>
              <span>More Integrations</span>
            </CardTitle>
            <CardDescription>
              Additional integrations coming soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-500">
                      WA
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    WhatsApp Business
                  </span>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-500">
                      TG
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">Telegram</span>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-500">
                      IG
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">Instagram</span>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
