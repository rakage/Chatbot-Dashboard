export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  messages: LLMMessage[];
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  provider: string;
  model: string;
}

export interface LLMProvider {
  name: string;
  generateResponse(request: LLMRequest): Promise<LLMResponse>;
}

export interface ProviderConfig {
  provider: string; // Use string instead of enum to match Prisma type
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}
