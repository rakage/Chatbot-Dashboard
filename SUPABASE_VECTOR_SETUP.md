# Supabase Vector Search Setup Guide

## Issue

The playground is not finding documents because the vector search setup might be incomplete.

## Quick Diagnosis

1. First, test the vector search with our diagnostic API:
   ```
   POST http://localhost:3000/api/debug/vector-search
   {
     "query": "Who is Raka?"
   }
   ```

## Setup Steps

### 1. Verify Supabase Environment Variables

Ensure these are set in your `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Run the SQL Setup

Execute the complete `supabase-setup.sql` file in your Supabase SQL editor:

**Key components:**

- `pgvector` extension
- `document_embeddings` table with proper structure
- `match_documents` RPC function for similarity search
- Proper indexes for performance
- Row Level Security policies

### 3. Verify Table Structure

Your table should match:

```sql
CREATE TABLE document_embeddings (
  id text PRIMARY KEY,
  content text NOT NULL,
  embedding vector(768), -- 768-dimensional for Gemini
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
```

### 4. Check RPC Function

The `match_documents` function should exist:

```sql
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
```

### 5. Verify Data Format

Your embeddings should have this metadata structure:

```json
{
  "companyId": "your_company_id",
  "documentId": "document_id",
  "documentName": "Raka Luthfi - CV v9.pdf",
  "chunkIndex": 0,
  "fileType": "PDF"
}
```

## Common Issues & Solutions

### Issue 1: RPC Function Missing

**Error:** `function match_documents does not exist`
**Solution:** Run the complete SQL setup file

### Issue 2: Wrong Vector Dimensions

**Error:** `dimension mismatch`
**Solution:** Ensure embeddings are 768-dimensional (Gemini standard)

### Issue 3: Metadata Structure Mismatch

**Error:** No results returned
**Solution:** Check that `companyId` in metadata matches your user's company ID

### Issue 4: Permissions

**Error:** `permission denied`
**Solution:** Ensure service role key has proper permissions

## Testing Steps

1. **Run Diagnostic API:**

   ```bash
   curl -X POST http://localhost:3000/api/debug/vector-search \
     -H "Content-Type: application/json" \
     -d '{"query": "Who is Raka?"}'
   ```

2. **Check Supabase Dashboard:**

   - Go to Table Editor → `document_embeddings`
   - Verify records exist with proper structure
   - Check that `companyId` in metadata matches your user's company

3. **Test RPC Function Directly:**
   ```sql
   SELECT * FROM match_documents(
     '[0.1, 0.2, ...]'::vector, -- Your query embedding
     'your_company_id',
     0.1, -- Low threshold for testing
     5
   );
   ```

## Expected Results

After proper setup, the playground should:

- Find relevant document chunks
- Show source documents in responses
- Display similarity scores and token usage
- Provide contextual answers based on your CV content

## Next Steps

1. Run the diagnostic API to identify the specific issue
2. Execute the missing SQL setup steps
3. Verify data exists with correct structure
4. Test the playground again

The diagnostic API will tell you exactly what's missing or misconfigured.
