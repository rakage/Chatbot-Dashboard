import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import EmbeddingService from "@/lib/embeddings";
import VectorService from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text = "This is a test document for embedding generation." } =
      await request.json();

    console.log("🔍 Starting embedding diagnostics...");

    // Step 1: Test Gemini API Key
    const geminiKey = process.env.GEMINI_API_KEY;
    console.log("1. Gemini API Key:", geminiKey ? "✅ Set" : "❌ Missing");

    // Step 2: Test Supabase Config
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("2. Supabase URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
    console.log(
      "3. Supabase Anon Key:",
      supabaseAnonKey ? "✅ Set" : "❌ Missing"
    );
    console.log(
      "4. Supabase Service Key:",
      supabaseServiceKey ? "✅ Set" : "❌ Missing"
    );

    const results: any = {
      environment: {
        geminiApiKey: !!geminiKey,
        supabaseUrl: !!supabaseUrl,
        supabaseAnonKey: !!supabaseAnonKey,
        supabaseServiceKey: !!supabaseServiceKey,
      },
      embedding: null,
      vectorStorage: null,
      vectorSearch: null,
      errors: [],
    };

    // Step 3: Test Embedding Generation
    if (!geminiKey) {
      results.errors.push("GEMINI_API_KEY environment variable is missing");
    } else {
      try {
        console.log("5. Testing embedding generation...");
        const embedding = await EmbeddingService.generateEmbedding(text);
        results.embedding = {
          success: true,
          dimensionality: embedding.embedding.length,
          tokenCount: embedding.tokenCount,
        };
        console.log(
          `✅ Generated embedding with ${embedding.embedding.length} dimensions`
        );

        // Step 4: Test Vector Storage
        if (!supabaseUrl || !supabaseServiceKey) {
          results.errors.push(
            "Supabase environment variables missing - cannot test vector storage"
          );
        } else {
          try {
            console.log("6. Testing vector storage...");
            const testDoc = {
              id: `test_${Date.now()}`,
              content: text,
              metadata: {
                documentId: "test-doc",
                companyId: session.user.companyId || "unknown",
                chunkIndex: 0,
                test: true,
              },
              embedding: embedding.embedding,
            };

            await VectorService.upsertDocuments([testDoc]);
            results.vectorStorage = { success: true };
            console.log("✅ Successfully stored vector in Supabase");

            // Step 5: Test Vector Search
            try {
              console.log("7. Testing vector search...");
              const searchResults = await VectorService.searchSimilar(
                embedding.embedding,
                session.user.companyId || "unknown",
                5,
                0.1 // Very low threshold for testing
              );

              results.vectorSearch = {
                success: true,
                resultCount: searchResults.length,
                foundTestDoc: searchResults.some((r) => r.id === testDoc.id),
              };
              console.log(
                `✅ Vector search returned ${searchResults.length} results`
              );

              // Clean up test document
              try {
                await VectorService.deleteByDocument("test-doc");
                console.log("✅ Cleaned up test document");
              } catch (cleanupError) {
                console.log(
                  "⚠️ Could not clean up test document:",
                  cleanupError
                );
              }
            } catch (searchError) {
              console.error("❌ Vector search failed:", searchError);
              results.vectorSearch = {
                success: false,
                error:
                  searchError instanceof Error
                    ? searchError.message
                    : "Unknown error",
              };
            }
          } catch (storageError) {
            console.error("❌ Vector storage failed:", storageError);
            results.vectorStorage = {
              success: false,
              error:
                storageError instanceof Error
                  ? storageError.message
                  : "Unknown error",
            };
          }
        }
      } catch (embeddingError) {
        console.error("❌ Embedding generation failed:", embeddingError);
        results.embedding = {
          success: false,
          error:
            embeddingError instanceof Error
              ? embeddingError.message
              : "Unknown error",
        };
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("❌ Diagnostics failed:", error);
    return NextResponse.json(
      {
        error: "Diagnostics failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
