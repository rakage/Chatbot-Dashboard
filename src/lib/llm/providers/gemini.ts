import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMProvider, LLMRequest, LLMResponse } from "../types";

export class GeminiProvider implements LLMProvider {
  name = "Gemini";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    try {
      const model = this.client.getGenerativeModel({
        model: request.model,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
        systemInstruction: request.systemPrompt,
      });

      // Convert messages to Gemini format
      const history = request.messages.slice(0, -1).map((msg) => ({
        role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: msg.content }],
      }));

      const lastMessage = request.messages[request.messages.length - 1];

      const chat = model.startChat({
        history,
      });

      const result = await chat.sendMessage(lastMessage.content);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error("No response content from Gemini");
      }

      return {
        text,
        usage: {
          // Gemini doesn't provide detailed token usage in the same format
          totalTokens: response.usageMetadata?.totalTokenCount,
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
        },
        provider: this.name,
        model: request.model,
      };
    } catch (error) {
      console.error("Gemini API error:", error);
      throw new Error(
        `Gemini API error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
