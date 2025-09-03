import { GoogleGenerativeAI } from "@google/generative-ai";
import EmbeddingService from "./embeddings";
import VectorService, { VectorMatch } from "./supabase";
import { db } from "./db";

export interface RAGContext {
  query: string;
  relevantChunks: VectorMatch[];
  contextText: string;
  sourceDocuments: string[];
}

export interface RAGResponse {
  response: string;
  context: RAGContext;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class RAGLLMService {
  private static readonly GEMINI_MODEL = "gemini-1.5-flash"; // or gemini-pro
  private static readonly MAX_CONTEXT_LENGTH = 8000; // Characters
  private static readonly DEFAULT_SEARCH_LIMIT = 5;
  private static readonly SIMILARITY_THRESHOLD = 0.7;

  /**
   * Generate a response using RAG with Gemini
   */
  static async generateResponse(
    query: string,
    companyId: string,
    options: {
      systemPrompt?: string | null;
      temperature?: number;
      maxTokens?: number;
      searchLimit?: number;
      similarityThreshold?: number;
      documentIds?: string[];
      isFacebookBot?: boolean; // New flag for Facebook-specific behavior
    } = {}
  ): Promise<RAGResponse> {
    try {
      // 1. Generate query embedding
      const queryEmbedding = await EmbeddingService.generateEmbedding(query);

      // 2. Search for relevant context
      const searchLimit = options.searchLimit || this.DEFAULT_SEARCH_LIMIT;
      const threshold =
        options.similarityThreshold || this.SIMILARITY_THRESHOLD;

      let relevantChunks: VectorMatch[] = [];

      try {
        // Try Supabase vector search first
        const platformLabel = options.isFacebookBot
          ? "📱 Facebook"
          : "🎮 Playground";
        console.log(
          `🔍 ${platformLabel} RAG: Searching for "${query}" with ${searchLimit} results, threshold ${threshold}`
        );
        relevantChunks = await VectorService.searchSimilar(
          queryEmbedding.embedding,
          companyId,
          searchLimit,
          threshold
        );
        console.log(
          `✅ ${platformLabel} RAG: Supabase returned ${relevantChunks.length} relevant chunks`
        );

        // Enhanced logging for Facebook vector search results
        if (options.isFacebookBot && relevantChunks.length > 0) {
          console.log(`📊 Facebook Vector Search Results:`);
          relevantChunks.forEach((chunk, index) => {
            // Debug: Log the chunk structure
            console.log(`🔍 Debug chunk ${index + 1} structure:`, {
              metadata: chunk.metadata,
              metadataKeys: chunk.metadata
                ? Object.keys(chunk.metadata)
                : "none",
            });

            // Handle Supabase metadata format
            const documentName =
              (chunk.metadata as any)?.documentName || "Unknown Document";
            console.log(`  ${index + 1}. Document: ${documentName}`);
            console.log(
              `     Similarity: ${(chunk.similarity * 100).toFixed(1)}%`
            );
            console.log(
              `     Content Preview: ${chunk.content.substring(0, 100)}...`
            );
            console.log(
              `     Estimated Tokens: ~${Math.ceil(chunk.content.length / 4)}`
            );
          });
        } else if (options.isFacebookBot) {
          console.log(
            `⚠️ Facebook Vector Search: No relevant chunks found for "${query}"`
          );
          console.log(`   - Company ID: ${companyId}`);
          console.log(`   - Search Limit: ${searchLimit}`);
          console.log(`   - Similarity Threshold: ${threshold}`);
          console.log(
            `   - Document IDs Filter: ${
              options.documentIds ? options.documentIds.join(", ") : "None"
            }`
          );
        }
      } catch (error) {
        console.error("❌ RAG: Supabase search failed, using fallback:", error);

        // Fallback to local search
        const whereClause: any = {
          companyId,
        };

        if (options.documentIds && options.documentIds.length > 0) {
          whereClause.documentId = { in: options.documentIds };
        }

        const chunks = await db.documentChunk.findMany({
          where: whereClause,
          include: {
            document: {
              select: {
                originalName: true,
                fileType: true,
              },
            },
          },
        });

        relevantChunks = chunks
          .map((chunk) => {
            if (!chunk.embedding || chunk.embedding.length === 0) return null;

            const similarity = EmbeddingService.cosineSimilarity(
              queryEmbedding.embedding,
              chunk.embedding
            );

            return {
              id: chunk.id,
              content: chunk.content,
              metadata: {
                ...(chunk.metadata as Record<string, any>),
                documentName:
                  chunk.document?.originalName || "Unknown Document",
                fileType: chunk.document?.fileType || "unknown",
                chunkIndex: chunk.chunkIndex,
              },
              similarity,
            };
          })
          .filter(
            (item): item is NonNullable<typeof item> =>
              item !== null && item.similarity >= threshold
          )
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, searchLimit);

        console.log(
          `✅ RAG: Fallback search returned ${relevantChunks.length} relevant chunks`
        );
      }

      // 3. Build context from relevant chunks
      const context = this.buildContext(query, relevantChunks);

      // 4. Generate response with Gemini
      const response = await this.generateWithGemini(
        query,
        context.contextText,
        options.systemPrompt,
        options.temperature,
        options.maxTokens,
        options.isFacebookBot
      );

      // Enhanced logging for Facebook responses
      if (options.isFacebookBot) {
        console.log(`🤖 Facebook RAG Response Generated:`);
        console.log(`   Query: "${query}"`);
        console.log(`   Context Length: ${context.contextText.length} chars`);
        console.log(`   Response Length: ${response.length} chars`);
        console.log(
          `   Source Documents: ${context.sourceDocuments.join(", ")}`
        );
        console.log(
          `   Response Preview: ${response.substring(0, 150)}${
            response.length > 150 ? "..." : ""
          }`
        );
      }

      return {
        response,
        context,
        usage: {
          promptTokens: this.estimateTokens(context.contextText + query),
          completionTokens: this.estimateTokens(response),
          totalTokens: this.estimateTokens(
            context.contextText + query + response
          ),
        },
      };
    } catch (error) {
      console.error("RAG LLM error:", error);
      throw new Error(
        `Failed to generate RAG response: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Build context from relevant chunks
   */
  private static buildContext(
    query: string,
    relevantChunks: VectorMatch[]
  ): RAGContext {
    if (relevantChunks.length === 0) {
      return {
        query,
        relevantChunks: [],
        contextText: "",
        sourceDocuments: [],
      };
    }

    let contextText = "";
    const sourceDocuments = new Set<string>();
    let currentLength = 0;

    // Sort by similarity and build context
    const sortedChunks = [...relevantChunks].sort(
      (a, b) => b.similarity - a.similarity
    );

    for (const chunk of sortedChunks) {
      // Build context without revealing document names to the LLM
      const chunkText = `\n\nRelevant Information:\n${chunk.content}\n`;

      if (currentLength + chunkText.length > this.MAX_CONTEXT_LENGTH) {
        break;
      }

      contextText += chunkText;
      currentLength += chunkText.length;

      // Still track source documents for metadata (not shown to LLM)
      if (chunk.metadata?.documentName) {
        sourceDocuments.add(chunk.metadata.documentName);
      }
    }

    return {
      query,
      relevantChunks,
      contextText: contextText.trim(),
      sourceDocuments: Array.from(sourceDocuments),
    };
  }

  /**
   * Generate response using Gemini
   */
  private static async generateWithGemini(
    query: string,
    contextText: string,
    systemPrompt?: string | null,
    temperature: number = 0.1, // Lower temperature for less hallucination
    maxTokens: number = 1000,
    isFacebookBot: boolean = false
  ): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: this.GEMINI_MODEL });

    // Build the enhanced anti-hallucination prompt for conversational responses
    const facebookPrompt = `You are a helpful assistant that provides accurate, natural responses. You must ONLY use information from the background context provided. CRITICAL: Do not make up, assume, or add any information not explicitly stated in the context.

STRICT RULES:
1. **ONLY USE PROVIDED CONTEXT**: If information isn't in the background context, you don't know it. Period.
2. **NO ASSUMPTIONS**: Never fill gaps with general knowledge or assumptions.
3. **NATURAL RESPONSES**: Sound conversational, but stay factual. Never mention "documents" or "context."
4. **BE HONEST**: If you don't have specific information, say "I don't have that information" or "I'm not sure about that."
5. **NO SPECULATION**: Don't extrapolate or make educated guesses beyond what's explicitly stated.

Example GOOD: "I'm a software engineer with experience in React and Node.js."
Example BAD: "I'm a software engineer, and like most developers, I probably work with databases too."

REMEMBER: Accuracy over completeness. If it's not in the context, you don't know it.`;

    const playgroundPrompt = `You are a helpful AI assistant that provides accurate, natural responses based on available company information. Your goal is to have natural conversations while staying truthful to the provided context.

RESPONSE GUIDELINES:

1. **NATURAL CONVERSATION**: Respond in a friendly, conversational tone as if talking to a person. Avoid mentioning "documents" or "files" - just provide the information naturally.

2. **CONTEXT-BASED ANSWERS**: Base your responses on the provided context information. If the context contains relevant information, use it to give helpful answers.

3. **HONEST LIMITATIONS**: If you don't have enough information to answer accurately, say something like "I don't have that specific information available right now" or "I'm not sure about that particular detail."

4. **NO DOCUMENT REFERENCES**: Never mention document names, file types, or say things like "according to the document." Just provide the information as if you naturally know it.

5. **CONVERSATIONAL FLOW**: Keep responses concise and conversational. Don't lecture or provide overly formal responses.

6. **STAY FACTUAL**: Only share information that's explicitly provided in the context. Don't make assumptions or add general knowledge.

7. **HELPFUL TONE**: Be friendly and helpful while staying accurate to the available information.

Example good response: "I'm a software engineer with experience in full-stack development, particularly with React and Node.js."
Example bad response: "According to the CV document, the person is a software engineer..."

Remember: Be conversational and helpful while staying truthful to the provided information.`;

    const defaultSystemPrompt = isFacebookBot
      ? facebookPrompt
      : playgroundPrompt;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    console.log(
      `🎯 RAG: Using ${
        isFacebookBot ? "STRICT Facebook" : "Playground"
      } prompt for query: "${query}"`
    );
    console.log(
      `🌡️ RAG: Temperature capped at ${Math.min(temperature, 0.3)} for ${
        isFacebookBot ? "Facebook" : "Playground"
      }`
    );

    const prompt = contextText
      ? `${finalSystemPrompt}

BACKGROUND INFORMATION:
${contextText}

USER MESSAGE: ${query}

Please respond naturally and conversationally based on the background information provided. Don't mention documents, files, or sources - just provide helpful information as if you naturally know it.`
      : `${finalSystemPrompt}

USER MESSAGE: ${query}

I don't have specific information to answer that question right now. Is there something else I can help you with?`;

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: Math.min(temperature, 0.3), // Cap temperature for consistency
          maxOutputTokens: maxTokens,
          topP: 0.95, // Higher topP for more deterministic responses
          topK: 20, // Lower topK for more focused responses
        },
      });

      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error("No response generated from Gemini");
      }

      return text;
    } catch (error) {
      console.error("Gemini generation error:", error);
      throw new Error(
        `Gemini API error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Search documents without generating a response
   */
  static async searchDocuments(
    query: string,
    companyId: string,
    options: {
      limit?: number;
      threshold?: number;
      documentIds?: string[];
    } = {}
  ): Promise<VectorMatch[]> {
    const queryEmbedding = await EmbeddingService.generateEmbedding(query);

    return VectorService.searchSimilar(
      queryEmbedding.embedding,
      companyId,
      options.limit || this.DEFAULT_SEARCH_LIMIT,
      options.threshold || this.SIMILARITY_THRESHOLD
    );
  }

  /**
   * Get embeddings statistics for a company
   */
  static async getEmbeddingStats(companyId: string) {
    const stats = await db.documentChunk.aggregate({
      where: {
        companyId,
      },
      _count: { id: true },
      _avg: { tokenCount: true },
    });

    const documentCount = await db.document.count({
      where: {
        companyId,
        status: "PROCESSED",
      },
    });

    return {
      totalChunks: stats._count.id,
      averageTokens: Math.round(stats._avg.tokenCount || 0),
      documentsProcessed: documentCount,
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export default RAGLLMService;
