import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import EmbeddingService from "@/lib/embeddings";
import VectorService, { VectorMatch } from "@/lib/supabase";
import { z } from "zod";

const searchSchema = z.object({
  query: z.string().min(1, "Query is required"),
  limit: z.number().min(1).max(50).optional().default(5),
  threshold: z.number().min(0).max(1).optional().default(0.75),
  documentIds: z.array(z.string()).optional(), // Filter by specific documents
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user and company
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    });

    if (!user || !user.companyId) {
      return NextResponse.json(
        { error: "User must be associated with a company" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = searchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { query, limit, threshold, documentIds } = validation.data;

    // Generate embedding for the search query
    console.log(`Generating embedding for query: "${query}"`);
    const queryEmbedding = await EmbeddingService.generateEmbedding(query);

    let searchResults: VectorMatch[] = [];

    // Try Supabase vector search first
    try {
      searchResults = await VectorService.searchSimilar(
        queryEmbedding.embedding,
        user.companyId,
        limit,
        threshold
      );
      console.log(`Found ${searchResults.length} results from Supabase`);
    } catch (error) {
      console.error(
        "Supabase search failed, falling back to local search:",
        error
      );

      // Fallback to local PostgreSQL search
      const whereClause: any = {
        companyId: user.companyId,
      };

      if (documentIds && documentIds.length > 0) {
        whereClause.documentId = { in: documentIds };
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

      // Calculate similarities locally
      const chunksWithSimilarity = chunks
        .map((chunk) => {
          if (!chunk.embedding || chunk.embedding.length === 0) return null;

          const similarity = EmbeddingService.cosineSimilarity(
            queryEmbedding.embedding,
            chunk.embedding as number[]
          );

          return {
            id: chunk.id,
            content: chunk.content,
            metadata: {
              ...((chunk.metadata as Record<string, any>) || {}),
              documentName: chunk.document.originalName,
              fileType: chunk.document.fileType,
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
        .slice(0, limit);

      searchResults = chunksWithSimilarity;
    }

    // Log the search for analytics
    await db.vectorSearch.create({
      data: {
        companyId: user.companyId,
        query,
        results: JSON.parse(JSON.stringify(searchResults)), // Serialize to JSON
        resultCount: searchResults.length,
      },
    });

    return NextResponse.json({
      success: true,
      query,
      results: searchResults,
      metadata: {
        totalResults: searchResults.length,
        threshold,
        searchMethod: "vector_similarity",
      },
    });
  } catch (error) {
    console.error("RAG search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user and company
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.companyId) {
      return NextResponse.json(
        { error: "User must be associated with a company" },
        { status: 400 }
      );
    }

    // Get recent search history
    const recentSearches = await db.vectorSearch.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        query: true,
        resultCount: true,
        createdAt: true,
      },
    });

    // Get search statistics
    const stats = await db.vectorSearch.aggregate({
      where: { companyId: user.companyId },
      _count: { id: true },
      _avg: { resultCount: true },
    });

    return NextResponse.json({
      success: true,
      recentSearches,
      statistics: {
        totalSearches: stats._count.id,
        averageResults: Math.round(stats._avg.resultCount || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching search history:", error);
    return NextResponse.json(
      { error: "Failed to fetch search history" },
      { status: 500 }
    );
  }
}
