import { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from "./types";
import { Provider } from "@prisma/client";
import { OpenAIProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";
import { OpenRouterProvider } from "./providers/openrouter";
import { decrypt } from "../encryption";

class LLMService {
  private providers: Map<Provider, LLMProvider> = new Map();

  private createProvider(provider: Provider, apiKey: string): LLMProvider {
    switch (provider) {
      case "OPENAI":
        return new OpenAIProvider(apiKey);
      case "GEMINI":
        return new GeminiProvider(apiKey);
      case "OPENROUTER":
        return new OpenRouterProvider(apiKey);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async generateResponse(
    config: ProviderConfig,
    messages: { role: "user" | "assistant"; content: string }[]
  ): Promise<LLMResponse> {
    try {
      // API key should already be decrypted by the caller
      const apiKey = config.apiKey;

      console.log(
        `🔧 LLM Service: Creating provider for ${config.provider} with API key length ${apiKey.length}`
      );

      // Get or create provider instance
      const providerEnum = config.provider as Provider;
      let provider = this.providers.get(providerEnum);
      if (!provider) {
        console.log(`🆕 Creating new provider instance for ${config.provider}`);
        provider = this.createProvider(providerEnum, apiKey);
        this.providers.set(providerEnum, provider);
      } else {
        console.log(
          `♻️ Reusing existing provider instance for ${config.provider}`
        );
      }

      // Prepare request
      const request: LLMRequest = {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        systemPrompt: config.systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      };

      // Safety checks
      if (messages.length > 20) {
        throw new Error("Too many messages in conversation history");
      }

      if (messages.some((msg) => msg.content.length > 10000)) {
        throw new Error("Message content too long");
      }

      // Check for profanity or unsafe content (basic implementation)
      const unsafePatterns = [
        /\b(kill|harm|hurt|violence)\b/i,
        /\b(hack|exploit|attack)\b/i,
        // Add more patterns as needed
      ];

      const hasUnsafeContent = messages.some((msg) =>
        unsafePatterns.some((pattern) => pattern.test(msg.content))
      );

      if (hasUnsafeContent) {
        throw new Error("Unsafe content detected");
      }

      const response = await provider.generateResponse(request);

      // Additional safety check on response
      const responseHasUnsafeContent = unsafePatterns.some((pattern) =>
        pattern.test(response.text)
      );

      if (responseHasUnsafeContent) {
        throw new Error("Generated response contains unsafe content");
      }

      return response;
    } catch (error) {
      console.error("LLM Service error:", error);
      throw error;
    }
  }

  // Clear provider cache (useful when API keys change)
  clearProviders(): void {
    this.providers.clear();
  }

  // Check if provider is supported
  isProviderSupported(provider: string): provider is Provider {
    return Object.values(Provider).includes(provider as Provider);
  }

  // Get available models for each provider
  getAvailableModels(provider: Provider): string[] {
    switch (provider) {
      case Provider.OPENAI:
        return [
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4-turbo",
          "gpt-4",
          "gpt-3.5-turbo",
        ];
      case Provider.GEMINI:
        return ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"];
      case Provider.OPENROUTER:
        return [
          "anthropic/claude-3.5-sonnet",
          "anthropic/claude-3-haiku",
          "meta-llama/llama-3.1-8b-instruct",
          "openai/gpt-4o",
          "openai/gpt-4o-mini",
          "google/gemini-2.5-flash-image-preview:free",
          "deepseek/deepseek-chat-v3.1:free",
        ];
      default:
        return [];
    }
  }
}

export const llmService = new LLMService();
export default llmService;
