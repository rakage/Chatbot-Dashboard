"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Ticket,
  Save,
  TestTube,
} from "lucide-react";

interface FreshdeskConfig {
  configured: boolean;
  enabled: boolean;
  integration?: {
    id: string;
    domain: string;
    enabled: boolean;
    autoCreate: boolean;
    defaultPriority: number;
    defaultStatus: number;
    defaultSource: number;
    defaultGroupId?: number;
    createdAt: string;
    updatedAt: string;
  };
  connectionStatus?: {
    success: boolean;
    message: string;
  };
}

const PRIORITY_OPTIONS = [
  { value: 1, label: "Low", color: "bg-green-100 text-green-800" },
  { value: 2, label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { value: 3, label: "High", color: "bg-orange-100 text-orange-800" },
  { value: 4, label: "Urgent", color: "bg-red-100 text-red-800" },
];

const STATUS_OPTIONS = [
  { value: 2, label: "Open", color: "bg-blue-100 text-blue-800" },
  { value: 3, label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: 4, label: "Resolved", color: "bg-green-100 text-green-800" },
  { value: 5, label: "Closed", color: "bg-gray-100 text-gray-800" },
];

const SOURCE_OPTIONS = [
  { value: 1, label: "Email" },
  { value: 2, label: "Portal" },
  { value: 3, label: "Phone" },
  { value: 7, label: "Chat" },
  { value: 9, label: "Twitter" },
  { value: 10, label: "Feedback Widget" },
  { value: 11, label: "Outbound Email" },
];

export default function FreshdeskConfigPage() {
  const [config, setConfig] = useState<FreshdeskConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    domain: "salsationfitness", // Pre-filled with the provided domain
    apiKey: "",
    enabled: true,
    autoCreate: true,
    defaultPriority: 2,
    defaultStatus: 2,
    defaultSource: 7, // Chat (used for Facebook)
    defaultGroupId: undefined as string | undefined,
  });

  const [availableGroups, setAvailableGroups] = useState<
    Array<{ id: number; name: string }>
  >([]);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await fetch("/api/freshdesk/groups");
      if (response.ok) {
        const data = await response.json();
        setAvailableGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Failed to fetch Freshdesk groups:", error);
    }
  };

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/freshdesk/config");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch configuration");
      }

      setConfig(data);

      if (data.configured && data.integration) {
        setFormData({
          domain: data.integration.domain,
          apiKey: "", // Don't populate API key for security
          enabled: data.integration.enabled,
          autoCreate: data.integration.autoCreate,
          defaultPriority: data.integration.defaultPriority,
          defaultStatus: data.integration.defaultStatus,
          defaultSource: data.integration.defaultSource,
          defaultGroupId: data.integration.defaultGroupId || undefined, // Keep as string from API
        });

        // Fetch available groups if integration is configured
        if (data.integration.enabled) {
          fetchGroups();
        }
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load configuration"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/freshdesk/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save configuration");
      }

      setSuccess("Freshdesk configuration saved successfully!");
      await fetchConfig(); // Refresh the config
      if (result.integration.enabled) {
        await fetchGroups(); // Fetch available groups
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to save configuration"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setError(null);

      // Test the connection by trying to save with current settings
      const response = await fetch("/api/freshdesk/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          enabled: false, // Test without enabling
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Connection test failed");
      }

      setSuccess(
        "Connection test successful! You can now save the configuration."
      );
      await fetchGroups(); // Fetch available groups after successful test
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Connection test failed"
      );
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Freshdesk Integration
          </h1>
          <p className="text-gray-600 mt-1">
            Configure Freshdesk integration to automatically create support
            tickets from chat conversations.
          </p>
        </div>
        <Badge
          variant={config?.enabled ? "default" : "secondary"}
          className="flex items-center gap-1"
        >
          {config?.enabled ? (
            <>
              <CheckCircle className="h-3 w-3" />
              Enabled
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" />
              Disabled
            </>
          )}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Set up your Freshdesk domain and API credentials to enable ticket
            creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Domain */}
          <div className="space-y-2">
            <Label htmlFor="domain">Freshdesk Domain</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">https://</span>
              <Input
                id="domain"
                value={formData.domain}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, domain: e.target.value }))
                }
                placeholder="yourcompany"
                className="flex-1"
              />
              <span className="text-sm text-gray-500">.freshdesk.com</span>
            </div>
            <p className="text-xs text-gray-500">
              Your Freshdesk subdomain (e.g., "salsationfitness" for
              salsationfitness.freshdesk.com)
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={formData.apiKey}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, apiKey: e.target.value }))
              }
              placeholder={
                config?.configured
                  ? "Enter new API key to update"
                  : "Enter your Freshdesk API key"
              }
            />
            <p className="text-xs text-gray-500">
              Find your API key in Freshdesk: Profile Settings → View API Key
            </p>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultPriority">Default Priority</Label>
              <Select
                value={formData.defaultPriority.toString()}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    defaultPriority: parseInt(value),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value.toString()}
                    >
                      <Badge className={option.color} variant="secondary">
                        {option.label}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultStatus">Default Status</Label>
              <Select
                value={formData.defaultStatus.toString()}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    defaultStatus: parseInt(value),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value.toString()}
                    >
                      <Badge className={option.color} variant="secondary">
                        {option.label}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultSource">Default Source</Label>
              <Select
                value={formData.defaultSource.toString()}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    defaultSource: parseInt(value),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value.toString()}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultGroupId">Default Group</Label>
              <Select
                value={formData.defaultGroupId || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    defaultGroupId: value || undefined, // Keep as string for API validation
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group (required)" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.length === 0 ? (
                    <SelectItem value="1" disabled>
                      No groups available - configure API key first
                    </SelectItem>
                  ) : (
                    availableGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-red-500">
                * Group is required by your Freshdesk instance
              </p>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enable Integration</Label>
                <p className="text-xs text-gray-500">
                  Allow ticket creation from conversations
                </p>
              </div>
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoCreate">Auto-create Tickets</Label>
                <p className="text-xs text-gray-500">
                  Automatically create tickets when certain conditions are met
                </p>
              </div>
              <input
                type="checkbox"
                id="autoCreate"
                checked={formData.autoCreate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    autoCreate: e.target.checked,
                  }))
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={!formData.domain || !formData.apiKey || testing}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={!formData.domain || !formData.apiKey || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Status */}
      {config?.configured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Integration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Domain</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {config.integration?.domain}.freshdesk.com
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `https://${config.integration?.domain}.freshdesk.com`,
                        "_blank"
                      )
                    }
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Connection Status</Label>
                <div className="flex items-center gap-2">
                  {config.connectionStatus?.success ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-600">
                        {config.connectionStatus?.message || "Not connected"}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Default Priority</Label>
                <Badge
                  className={
                    PRIORITY_OPTIONS.find(
                      (p) => p.value === config.integration?.defaultPriority
                    )?.color
                  }
                  variant="secondary"
                >
                  {
                    PRIORITY_OPTIONS.find(
                      (p) => p.value === config.integration?.defaultPriority
                    )?.label
                  }
                </Badge>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Default Status</Label>
                <Badge
                  className={
                    STATUS_OPTIONS.find(
                      (s) => s.value === config.integration?.defaultStatus
                    )?.color
                  }
                  variant="secondary"
                >
                  {
                    STATUS_OPTIONS.find(
                      (s) => s.value === config.integration?.defaultStatus
                    )?.label
                  }
                </Badge>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Auto-create Tickets
                </Label>
                <Badge
                  variant={
                    config.integration?.autoCreate ? "default" : "secondary"
                  }
                >
                  {config.integration?.autoCreate ? "Enabled" : "Disabled"}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Last Updated</Label>
                <span className="text-sm text-gray-600">
                  {config.integration?.updatedAt
                    ? new Date(
                        config.integration.updatedAt
                      ).toLocaleDateString()
                    : "Never"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <h4 className="font-medium">How to get your Freshdesk API Key:</h4>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Log in to your Freshdesk account</li>
              <li>Click on your profile picture in the top right</li>
              <li>Select "Profile Settings"</li>
              <li>Your API key will be displayed on the right side</li>
              <li>Copy the API key and paste it above</li>
            </ol>
          </div>

          <div className="text-sm space-y-2">
            <h4 className="font-medium">Features:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Manual ticket creation from conversation view</li>
              <li>Automatic conversation history inclusion</li>
              <li>Customer information sync</li>
              <li>Customizable priority and status defaults</li>
              <li>Conversation tagging and categorization</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
