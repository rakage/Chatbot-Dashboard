import OpenAI from "openai";
import { LLMProvider, LLMRequest, LLMResponse } from "../types";

export class OpenRouterProvider implements LLMProvider {
  name = "OpenRouter";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3001",
        "X-Title": "Facebook Bot Dashboard",
      },
    });
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Prepare messages with system prompt
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: request.systemPrompt },
        ...request.messages.map((msg) => ({
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content,
        })),
      ];

      const response = await this.client.chat.completions.create({
        model: request.model,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new Error("No response content from OpenRouter");
      }

      return {
        text: choice.message.content,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
        provider: this.name,
        model: request.model,
      };
    } catch (error) {
      console.error("OpenRouter API error:", error);
      throw new Error(
        `OpenRouter API error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
