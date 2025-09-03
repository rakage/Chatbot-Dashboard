-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the document_embeddings table for vector storage
CREATE TABLE IF NOT EXISTS document_embeddings (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(768), -- Gemini embeddings are 768-dimensional
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for efficient vector search
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx 
ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for company filtering
CREATE INDEX IF NOT EXISTS document_embeddings_company_id_idx 
ON document_embeddings USING btree ((metadata->>'companyId'));

-- Create index for document filtering
CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx 
ON document_embeddings USING btree ((metadata->>'documentId'));

-- Create function for similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  company_id text,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    document_embeddings.metadata,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  WHERE 
    document_embeddings.metadata->>'companyId' = company_id
    AND 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function for document deletion by company
CREATE OR REPLACE FUNCTION delete_company_documents(company_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM document_embeddings 
  WHERE metadata->>'companyId' = company_id;
END;
$$;

-- Create function for document deletion by document ID
CREATE OR REPLACE FUNCTION delete_document_embeddings(document_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM document_embeddings 
  WHERE metadata->>'documentId' = document_id;
END;
$$;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating timestamps
CREATE TRIGGER update_document_embeddings_updated_at 
    BEFORE UPDATE ON document_embeddings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy for service role (full access)
CREATE POLICY "Service role can do everything" ON document_embeddings
FOR ALL USING (auth.role() = 'service_role');

-- Policy for authenticated users (can only access their company's data)
CREATE POLICY "Users can access their company documents" ON document_embeddings
FOR SELECT USING (
  auth.role() = 'authenticated' AND
  metadata->>'companyId' IN (
    SELECT companies.id::text 
    FROM companies 
    JOIN users ON users.company_id = companies.id 
    WHERE users.id = auth.uid()::text
  )
);

-- Grant necessary permissions
GRANT ALL ON document_embeddings TO service_role;
GRANT SELECT ON document_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents TO service_role;
GRANT EXECUTE ON FUNCTION delete_company_documents TO service_role;
GRANT EXECUTE ON FUNCTION delete_document_embeddings TO service_role;
