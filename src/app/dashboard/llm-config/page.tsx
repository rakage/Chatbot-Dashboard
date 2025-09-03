"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Key,
  Save,
  AlertCircle,
  CheckCircle,
  Brain,
  Settings,
  Zap,
} from "lucide-react";

export default function LLMConfigPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [llmLoading, setLlmLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const hasMountedRef = useRef(false);

  const [llmSettings, setLlmSettings] = useState({
    provider: "OPENAI",
    apiKey: "",
    model: "gpt-3.5-turbo",
    temperature: 0.3,
    maxTokens: 512,
    systemPrompt:
      "You are a helpful, brand-safe support assistant. Always be professional, helpful, and on-brand.",
  });

  const [currentConfig, setCurrentConfig] = useState<{
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    hasApiKey: boolean;
  } | null>(null);

  // Load cached data on component mount
  useEffect(() => {
    try {
      const cachedConfig = localStorage.getItem("llm-config");
      const cacheTimestamp = localStorage.getItem("llm-config-timestamp");

      // Check if cache is less than 5 minutes old
      const isCacheValid =
        cacheTimestamp && Date.now() - parseInt(cacheTimestamp) < 5 * 60 * 1000;

      if (cachedConfig && isCacheValid) {
        const parsedConfig = JSON.parse(cachedConfig);
        setCurrentConfig(parsedConfig);

        // Set form settings (without API key for security)
        setLlmSettings({
          provider: parsedConfig.provider || "OPENAI",
          apiKey: "", // Never load the actual API key for security
          model: parsedConfig.model || "gpt-3.5-turbo",
          temperature: parsedConfig.temperature || 0.3,
          maxTokens: parsedConfig.maxTokens || 512,
          systemPrompt: parsedConfig.systemPrompt || "",
        });

        setDataLoaded(true);
        return;
      }
    } catch (error) {
      console.error("Error loading cached LLM config:", error);
    }
  }, []);

  const loadLLMSettings = useCallback(async () => {
    if (dataLoaded) return; // Prevent multiple loads

    try {
      const response = await fetch("/api/settings/provider");
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          // Set current config for display
          setCurrentConfig(data.config);

          // Cache the config
          localStorage.setItem("llm-config", JSON.stringify(data.config));
          localStorage.setItem("llm-config-timestamp", Date.now().toString());

          // Set form settings (without API key for security)
          setLlmSettings({
            provider: data.config.provider || "OPENAI",
            apiKey: "", // Never load the actual API key for security
            model: data.config.model || "gpt-3.5-turbo",
            temperature: data.config.temperature || 0.3,
            maxTokens: data.config.maxTokens || 512,
            systemPrompt: data.config.systemPrompt || "",
          });
        }
      }
    } catch (error) {
      console.error("Failed to load LLM settings:", error);
    } finally {
      setDataLoaded(true);
    }
  }, [dataLoaded]);

  // Permission check - only run when session is actually loaded
  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (
      session?.user?.role &&
      !["OWNER", "ADMIN"].includes(session.user.role)
    ) {
      router.push("/dashboard");
    }
  }, [session, sessionStatus, router]);

  // Load data only once when component first mounts and user is authenticated
  useEffect(() => {
    if (
      sessionStatus === "loading" ||
      !session?.user ||
      dataLoaded ||
      hasMountedRef.current
    ) {
      return;
    }

    hasMountedRef.current = true;
    loadLLMSettings();
  }, [session, sessionStatus, dataLoaded, loadLLMSettings]);

  const handleLLMSave = async () => {
    setLlmLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/settings/provider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(llmSettings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to save LLM settings");
        return;
      }

      const data = await response.json();
      setSuccess("LLM settings saved successfully!");

      // Update current config with the saved data
      if (data.config) {
        setCurrentConfig(data.config);

        // Update cache
        localStorage.setItem("llm-config", JSON.stringify(data.config));
        localStorage.setItem("llm-config-timestamp", Date.now().toString());
      }

      // Clear the API key field after successful save
      setLlmSettings((prev) => ({ ...prev, apiKey: "" }));
    } catch (error) {
      setError("Failed to save LLM settings");
      console.error("LLM save error:", error);
    } finally {
      setLlmLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!llmSettings.apiKey) {
      setError("Please enter an API key before testing");
      return;
    }

    setError("");
    setSuccess("");

    try {
      // Test the connection by attempting to save the config first
      const response = await fetch("/api/settings/provider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(llmSettings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "LLM connection test failed");
        return;
      }

      const data = await response.json();
      setSuccess(
        "LLM connection successful! Configuration saved and validated."
      );

      // Update current config with the saved data
      if (data.config) {
        setCurrentConfig(data.config);

        // Update cache
        localStorage.setItem("llm-config", JSON.stringify(data.config));
        localStorage.setItem("llm-config-timestamp", Date.now().toString());
      }

      // Clear the API key field after successful save
      setLlmSettings((prev) => ({ ...prev, apiKey: "" }));
    } catch (error) {
      setError("Failed to test LLM connection");
      console.error("LLM test error:", error);
    }
  };

  // Auto-dismiss messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "OPENAI":
        return "🤖";
      case "GEMINI":
        return "✨";
      case "OPENROUTER":
        return "🚀";
      default:
        return "🤖";
    }
  };

  const getModelOptions = (provider: string) => {
    switch (provider) {
      case "OPENAI":
        return ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-3.5-turbo-16k"];
      case "GEMINI":
        return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"];
      case "OPENROUTER":
        return []; // OpenRouter uses text input instead of dropdown
      default:
        return [];
    }
  };

  const getDefaultModel = (provider: string) => {
    switch (provider) {
      case "OPENAI":
        return "gpt-3.5-turbo";
      case "GEMINI":
        return "gemini-1.5-flash";
      case "OPENROUTER":
        return "openai/gpt-3.5-turbo";
      default:
        return "";
    }
  };

  // Show loading state if not loaded and not using cache
  if (!dataLoaded && sessionStatus === "loading") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            LLM Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure your AI language model provider and settings
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">
            Loading configuration...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">LLM Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Configure your AI language model provider and settings
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LLM Provider Configuration */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bot className="h-5 w-5 text-purple-600" />
                <span>AI Provider Settings</span>
              </CardTitle>
              <CardDescription>
                Configure your AI language model provider and parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selection */}
              <div>
                <fieldset>
                  <legend className="block text-sm font-medium text-gray-700 mb-3">
                    AI Provider
                  </legend>
                  <div
                    id="provider-selection"
                    className="grid grid-cols-1 md:grid-cols-3 gap-3"
                  >
                    {["OPENAI", "GEMINI", "OPENROUTER"].map((provider) => (
                      <label
                        key={provider}
                        className={`relative cursor-pointer rounded-lg border p-4 hover:bg-gray-50 ${
                          llmSettings.provider === provider
                            ? "border-purple-500 ring-2 ring-purple-500"
                            : "border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="provider"
                          value={provider}
                          checked={llmSettings.provider === provider}
                          onChange={() =>
                            setLlmSettings((prev) => ({
                              ...prev,
                              provider,
                              model: getDefaultModel(provider),
                            }))
                          }
                          className="sr-only"
                          aria-describedby={`${provider}-description`}
                        />

                        <span className="sr-only">
                          Select {provider === "OPENAI" && "OpenAI"}
                          {provider === "GEMINI" && "Google Gemini"}
                          {provider === "OPENROUTER" && "OpenRouter"} as AI
                          provider
                        </span>
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">
                            {getProviderIcon(provider)}
                          </span>
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {provider === "OPENAI" && "OpenAI"}
                              {provider === "GEMINI" && "Google Gemini"}
                              {provider === "OPENROUTER" && "OpenRouter"}
                            </h3>
                            <p
                              className="text-sm text-gray-500"
                              id={`${provider}-description`}
                            >
                              {provider === "OPENAI" && "GPT models"}
                              {provider === "GEMINI" && "Gemini Pro/Flash"}
                              {provider === "OPENROUTER" &&
                                "Multiple providers"}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type="password"
                    value={llmSettings.apiKey}
                    onChange={(e) =>
                      setLlmSettings((prev) => ({
                        ...prev,
                        apiKey: e.target.value,
                      }))
                    }
                    placeholder={`Enter ${llmSettings.provider} API key`}
                    className="pl-10"
                  />
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your API key is encrypted and stored securely
                </p>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                {llmSettings.provider === "OPENROUTER" ? (
                  <Input
                    id="model"
                    type="text"
                    value={llmSettings.model}
                    onChange={(e) =>
                      setLlmSettings((prev) => ({
                        ...prev,
                        model: e.target.value,
                      }))
                    }
                    placeholder="e.g., openai/gpt-4, anthropic/claude-3-sonnet"
                    className="w-full"
                  />
                ) : (
                  <Select
                    value={llmSettings.model}
                    onValueChange={(value) =>
                      setLlmSettings((prev) => ({
                        ...prev,
                        model: value,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {getModelOptions(llmSettings.provider).map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {llmSettings.provider === "OPENROUTER" && (
                  <p className="text-xs text-muted-foreground">
                    Enter the full model path (e.g., openai/gpt-4,
                    anthropic/claude-3-sonnet)
                  </p>
                )}
              </div>

              {/* Model Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={llmSettings.temperature}
                    onChange={(e) =>
                      setLlmSettings((prev) => ({
                        ...prev,
                        temperature: parseFloat(e.target.value),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness (0.0-2.0)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min="100"
                    max="4000"
                    value={llmSettings.maxTokens}
                    onChange={(e) =>
                      setLlmSettings((prev) => ({
                        ...prev,
                        maxTokens: parseInt(e.target.value),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum response length
                  </p>
                </div>
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  rows={4}
                  value={llmSettings.systemPrompt}
                  onChange={(e) =>
                    setLlmSettings((prev) => ({
                      ...prev,
                      systemPrompt: e.target.value,
                    }))
                  }
                  placeholder="Define the AI's personality and behavior..."
                />
                <p className="text-xs text-muted-foreground">
                  Instructions that define how the AI should behave and respond
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Button
                  onClick={handleLLMSave}
                  disabled={llmLoading || !llmSettings.apiKey}
                  className="flex-1"
                >
                  {llmLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Configuration
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={!llmSettings.apiKey}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Info & Tips */}
        <div className="space-y-6">
          {/* Current Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-gray-600" />
                <span>Current Setup</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentConfig ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Provider:</span>
                    <span className="text-sm font-medium flex items-center">
                      <span className="mr-1">
                        {getProviderIcon(currentConfig.provider)}
                      </span>
                      {currentConfig.provider}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Model:</span>
                    <span className="text-sm font-medium">
                      {currentConfig.model}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Temperature:</span>
                    <span className="text-sm font-medium">
                      {currentConfig.temperature}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Max Tokens:</span>
                    <span className="text-sm font-medium">
                      {currentConfig.maxTokens}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">API Key:</span>
                    <span className="text-sm font-medium flex items-center">
                      {currentConfig.hasApiKey ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-green-600">Configured</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                          <span className="text-red-600">Not Set</span>
                        </>
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">
                    No configuration found
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Configure your LLM provider to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips & Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-blue-600" />
                <span>Best Practices</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-500">•</span>
                  <span className="text-gray-600">
                    Use lower temperature (0.0-0.3) for consistent, factual
                    responses
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-blue-500">•</span>
                  <span className="text-gray-600">
                    Set clear brand guidelines in your system prompt
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-blue-500">•</span>
                  <span className="text-gray-600">
                    Test different models to find the best fit for your use case
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-blue-500">•</span>
                  <span className="text-gray-600">
                    Monitor token usage to optimize costs
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
