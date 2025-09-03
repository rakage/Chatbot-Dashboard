import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Client for public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Vector operations interface
export interface VectorMatch {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
}

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: {
    documentId: string;
    companyId: string;
    chunkIndex: number;
    documentName?: string;
    fileType?: string;
    [key: string]: any;
  };
  embedding: number[];
}

export class VectorService {
  private static readonly COLLECTION_NAME = "document_embeddings";

  static async upsertDocuments(documents: VectorDocument[]): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not available");
    }

    // Transform documents to match the table structure
    const formattedDocuments = documents.map((doc) => ({
      id: doc.id,
      content: doc.content,
      embedding: doc.embedding,
      metadata: doc.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    console.log(
      `📤 Upserting ${formattedDocuments.length} documents to Supabase...`
    );

    const { error } = await supabaseAdmin
      .from(this.COLLECTION_NAME)
      .upsert(formattedDocuments, { onConflict: "id" });

    if (error) {
      console.error("❌ Supabase upsert error:", error);
      throw new Error(`Failed to upsert documents: ${error.message}`);
    }

    console.log(
      `✅ Successfully upserted ${formattedDocuments.length} documents`
    );
  }

  static async searchSimilar(
    queryEmbedding: number[],
    companyId: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<VectorMatch[]> {
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not available");
    }

    console.log(
      `🔍 Searching vectors for company ${companyId} with threshold ${threshold}...`
    );

    // Use Supabase's vector similarity search
    const { data, error } = await supabaseAdmin.rpc("match_documents", {
      query_embedding: queryEmbedding,
      company_id: companyId,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error("❌ Vector search RPC failed:", error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    console.log(`✅ Vector search returned ${data?.length || 0} results`);

    // Transform the results to match our interface
    return (data || []).map((result: any) => ({
      id: result.id,
      content: result.content,
      metadata: result.metadata,
      similarity: result.similarity,
    }));
  }

  static async deleteByCompany(companyId: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not available");
    }

    const { error } = await supabaseAdmin
      .from(this.COLLECTION_NAME)
      .delete()
      .eq("metadata->companyId", companyId);

    if (error) {
      throw new Error(`Failed to delete company documents: ${error.message}`);
    }
  }

  static async deleteByDocument(documentId: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not available");
    }

    const { error } = await supabaseAdmin
      .from(this.COLLECTION_NAME)
      .delete()
      .eq("metadata->documentId", documentId);

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }
}

export default VectorService;
