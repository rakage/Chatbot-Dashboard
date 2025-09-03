import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface EmbeddingResult {
  embedding: number[];
  tokenCount?: number;
}

export interface EmbeddingBatch {
  inputs: string[];
  embeddings: number[][];
  tokenCounts?: number[];
}

export class EmbeddingService {
  private static readonly MODEL_NAME = "embedding-001"; // Gemini embedding model
  private static readonly MAX_BATCH_SIZE = 100;
  private static readonly MAX_INPUT_LENGTH = 2048; // Max tokens per input

  /**
   * Generate embedding for a single text input
   */
  static async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    try {
      // Truncate text if too long
      const truncatedText = this.truncateText(text);

      const model = genAI.getGenerativeModel({ model: this.MODEL_NAME });
      const result = await model.embedContent(truncatedText);

      if (!result.embedding?.values) {
        throw new Error("No embedding returned from Gemini API");
      }

      return {
        embedding: result.embedding.values,
        tokenCount: truncatedText.length, // Approximate token count
      };
    } catch (error) {
      console.error("Gemini embedding error:", error);
      throw new Error(
        `Failed to generate embedding: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate embeddings for multiple text inputs
   */
  static async generateEmbeddings(texts: string[]): Promise<EmbeddingBatch> {
    if (texts.length === 0) {
      return { inputs: [], embeddings: [] };
    }

    const batches = this.chunkArray(texts, this.MAX_BATCH_SIZE);
    const allEmbeddings: number[][] = [];
    const allTokenCounts: number[] = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((text) => this.generateEmbedding(text))
      );

      allEmbeddings.push(...batchResults.map((r) => r.embedding));
      allTokenCounts.push(...batchResults.map((r) => r.tokenCount || 0));
    }

    return {
      inputs: texts,
      embeddings: allEmbeddings,
      tokenCounts: allTokenCounts,
    };
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar embeddings from a collection
   */
  static findMostSimilar(
    queryEmbedding: number[],
    embeddings: { id: string; embedding: number[]; metadata?: any }[],
    topK: number = 5,
    threshold: number = 0.7
  ): Array<{ id: string; similarity: number; metadata?: any }> {
    const similarities = embeddings.map((item) => ({
      id: item.id,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
      metadata: item.metadata,
    }));

    return similarities
      .filter((item) => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Truncate text to fit within model limits
   */
  private static truncateText(text: string): string {
    // Simple truncation - in production, you might want more sophisticated tokenization
    const maxChars = this.MAX_INPUT_LENGTH * 4; // Rough estimate: 1 token ≈ 4 chars
    return text.length > maxChars ? text.substring(0, maxChars) : text;
  }

  /**
   * Split array into chunks of specified size
   */
  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  static estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Clean and prepare text for embedding
   */
  static preprocessText(text: string): string {
    return text
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
      .trim();
  }
}

export default EmbeddingService;
