# Facebook Vector Search Logging Guide

## 🔍 **Enhanced Logging for Facebook Bot RAG**

Comprehensive logging has been added to track vector search behavior specifically for Facebook Messenger bot responses.

## 📊 **Log Types & Examples**

### **1. Initial Request Log**

```
📱 Facebook RAG request: "What programming languages do you know?"
```

- **When**: Facebook user sends a message
- **Shows**: Platform (📱 Facebook vs 🎮 Playground) and user query

### **2. Vector Search Initiation**

```
🔍 📱 Facebook RAG: Searching for "What programming languages do you know?" with 3 results, threshold 0.1
```

- **When**: Vector search starts
- **Shows**: Query, search limit, similarity threshold

### **3. Vector Search Results**

```
✅ 📱 Facebook RAG: Supabase returned 2 relevant chunks
```

- **When**: Supabase returns search results
- **Shows**: Number of chunks found

### **4. Detailed Vector Results (Success)**

```
📊 Facebook Vector Search Results:
  1. Document: Raka Luthfi - CV v9.pdf
     Similarity: 87.3%
     Content Preview: I am a software engineer with experience in JavaScript, React, Node.js, and Python. I have worked on...
     Estimated Tokens: ~245
  2. Document: Skills Summary.txt
     Similarity: 82.1%
     Content Preview: Technical skills include full-stack development with modern frameworks like React and Vue.js...
     Estimated Tokens: ~189
```

- **When**: Relevant chunks are found for Facebook
- **Shows**: Document name, similarity score, content preview, token count

### **5. No Results Found**

```
⚠️ Facebook Vector Search: No relevant chunks found for "What's your favorite color?"
   - Company ID: clp123abc...
   - Search Limit: 3
   - Similarity Threshold: 0.1
   - Document IDs Filter: None
```

- **When**: No relevant chunks found for Facebook query
- **Shows**: Search parameters for debugging

### **6. RAG Response Generated**

```
🤖 Facebook RAG Response Generated:
   Query: "What programming languages do you know?"
   Context Length: 1247 chars
   Response Length: 156 chars
   Source Documents: Raka Luthfi - CV v9.pdf, Skills Summary.txt
   Response Preview: I have experience with JavaScript, React, Node.js, and Python. I've worked extensively with these technologies in various full-stack...
```

- **When**: Final response is generated
- **Shows**: Query, context size, response size, sources, preview

### **7. Facebook Bot Queue Worker**

```
🔍 Using Playground RAG API for Facebook bot response to: "What programming languages do you know?"
✅ Facebook RAG API Response: Generated 156 chars with 2 relevant chunks
📚 Facebook Sources: Raka Luthfi - CV v9.pdf, Skills Summary.txt
```

- **When**: Queue worker processes Facebook message
- **Shows**: API usage, response size, chunk count, source documents

## 🎯 **How to Use These Logs**

### **Debugging No Results:**

Look for:

```
⚠️ Facebook Vector Search: No relevant chunks found
```

Check the parameters shown and consider:

- Lowering similarity threshold
- Checking if documents are properly embedded
- Verifying company ID matches

### **Debugging Poor Results:**

Look for:

```
📊 Facebook Vector Search Results:
  1. Document: SomeDoc.pdf
     Similarity: 45.2%  <- Low similarity!
```

If similarity scores are low (< 60%), consider:

- Rephrasing the query
- Lowering similarity threshold
- Adding more relevant documents

### **Monitoring Response Quality:**

Look for:

```
🤖 Facebook RAG Response Generated:
   Response Preview: I have experience with JavaScript...
```

Check if the response preview looks accurate and relevant.

## 🔧 **Log Locations**

1. **RAG Service** (`src/lib/rag-llm.ts`):

   - Vector search initiation
   - Detailed search results
   - Response generation

2. **RAG API** (`src/app/api/rag/chat/route.ts`):

   - Platform identification (Facebook vs Playground)
   - Request processing

3. **Queue Worker** (`src/lib/queue.ts`):
   - Facebook message processing
   - API response handling
   - Source document tracking

## 📈 **Monitoring Tips**

### **Successful Facebook RAG Flow:**

```
📱 Facebook RAG request: "Who is Raka?"
🔍 📱 Facebook RAG: Searching for "Who is Raka?" with 3 results, threshold 0.1
✅ 📱 Facebook RAG: Supabase returned 2 relevant chunks
📊 Facebook Vector Search Results:
  1. Document: Raka Luthfi - CV v9.pdf
     Similarity: 91.4%
🤖 Facebook RAG Response Generated:
   Response Preview: I'm a software engineer with experience in full-stack development...
✅ Facebook RAG API Response: Generated 187 chars with 2 relevant chunks
📚 Facebook Sources: Raka Luthfi - CV v9.pdf
```

### **Failed Facebook RAG Flow:**

```
📱 Facebook RAG request: "What's the weather?"
🔍 📱 Facebook RAG: Searching for "What's the weather?" with 3 results, threshold 0.1
✅ 📱 Facebook RAG: Supabase returned 0 relevant chunks
⚠️ Facebook Vector Search: No relevant chunks found for "What's the weather?"
   - Company ID: clp123abc...
   - Search Limit: 3
   - Similarity Threshold: 0.1
❌ RAG API failed, falling back to standard LLM
```

## 🚀 **Benefits**

1. **🔍 Transparency**: See exactly what documents are being searched
2. **📊 Performance Monitoring**: Track similarity scores and chunk counts
3. **🐛 Debugging**: Identify why certain queries don't find relevant content
4. **📈 Optimization**: Understand which documents are most useful
5. **🎯 Quality Assurance**: Monitor response quality and accuracy

Now when you test your Facebook bot, you'll see detailed logs showing exactly how the vector search is working! 📱✨
