import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import DocumentProcessor from "@/lib/document-processor";
import EmbeddingService from "@/lib/embeddings";
import VectorService, { VectorDocument } from "@/lib/supabase";
import { z } from "zod";

const trainSchema = z.object({
  documentIds: z
    .array(z.string())
    .min(1, "At least one document must be selected"),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    });

    if (!user || !["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    if (!user.companyId || !user.company) {
      return NextResponse.json(
        { error: "User must be associated with a company" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = trainSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { documentIds } = validation.data;

    // Use sensible backend defaults
    const settings = {
      chunkSize: 1500, // Optimal for most documents
      temperature: 0.3, // Conservative for accuracy
      maxTokens: 512, // Standard response length
    };

    // Verify documents exist and belong to the user's company
    const documents = await db.document.findMany({
      where: {
        id: { in: documentIds },
        companyId: user.companyId,
        status: "PROCESSED",
      },
    });

    if (documents.length !== documentIds.length) {
      return NextResponse.json(
        { error: "Some documents not found or not processed yet" },
        { status: 400 }
      );
    }

    // Check if there's already a running training session
    const existingSession = await db.trainingSession.findFirst({
      where: {
        companyId: user.companyId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });

    if (existingSession) {
      return NextResponse.json(
        { error: "Training session already in progress" },
        { status: 409 }
      );
    }

    // Create training session
    const trainingSession = await db.trainingSession.create({
      data: {
        companyId: user.companyId,
        status: "PENDING",
        startedById: user.id,
        metadata: {
          documentCount: documents.length,
          chunkSize: settings.chunkSize,
        },
        documents: {
          connect: documentIds.map((id) => ({ id })),
        },
      },
      include: {
        documents: true,
      },
    });

    // Start training process in background
    processTrainingAsync(trainingSession.id, documents, settings).catch(
      (error) => {
        console.error("Error in training process:", error);
      }
    );

    return NextResponse.json({
      success: true,
      trainingSession: {
        id: trainingSession.id,
        status: trainingSession.status,
        progress: trainingSession.progress,
        documentCount: documents.length,
        createdAt: trainingSession.createdAt,
      },
    });
  } catch (error) {
    console.error("Training error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function processTrainingAsync(
  sessionId: string,
  documents: any[],
  settings: any
) {
  try {
    // Update status to processing
    await db.trainingSession.update({
      where: { id: sessionId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        progress: 0,
      },
    });

    let totalChunks = 0;
    let processedChunks = 0;
    const allDocumentChunks: Array<{
      documentId: string;
      companyId: string;
      chunkIndex: number;
      content: string;
      metadata: any;
    }> = [];

    // First pass: create chunks and count them
    for (const document of documents) {
      if (document.extractedText) {
        const chunks = DocumentProcessor.chunkText(
          document.extractedText,
          settings.chunkSize
        );

        chunks.forEach((chunk, index) => {
          allDocumentChunks.push({
            documentId: document.id,
            companyId: document.companyId,
            chunkIndex: index,
            content: DocumentProcessor.preprocessText(chunk),
            metadata: {
              documentId: document.id,
              companyId: document.companyId,
              chunkIndex: index,
              documentName: document.originalName,
              fileType: document.fileType,
              tokenCount: EmbeddingService.estimateTokenCount(chunk),
            },
          });
        });

        totalChunks += chunks.length;
      }
    }

    if (allDocumentChunks.length === 0) {
      throw new Error("No text content found in documents");
    }

    console.log(`Processing ${totalChunks} chunks for embedding generation...`);

    // Process in batches for embedding generation
    const batchSize = 10; // Smaller batches for API rate limits
    const vectorDocuments: VectorDocument[] = [];

    for (let i = 0; i < allDocumentChunks.length; i += batchSize) {
      const batch = allDocumentChunks.slice(i, i + batchSize);

      try {
        // Generate embeddings for this batch
        const texts = batch.map((chunk) => chunk.content);
        const embeddingResult = await EmbeddingService.generateEmbeddings(
          texts
        );

        // Create vector documents
        batch.forEach((chunk, batchIndex) => {
          const embedding = embeddingResult.embeddings[batchIndex];
          if (embedding) {
            vectorDocuments.push({
              id: `${chunk.documentId}_chunk_${chunk.chunkIndex}`,
              content: chunk.content,
              metadata: chunk.metadata,
              embedding: embedding,
            });
          }
        });

        // Store chunks in PostgreSQL
        for (const chunk of batch) {
          const embedding = embeddingResult.embeddings[batch.indexOf(chunk)];
          // Only create/update if we have a valid embedding
          if (embedding && embedding.length > 0) {
            await db.documentChunk.upsert({
              where: {
                documentId_chunkIndex: {
                  documentId: chunk.documentId,
                  chunkIndex: chunk.chunkIndex,
                },
              },
              update: {
                content: chunk.content,
                embedding: embedding,
                tokenCount: chunk.metadata.tokenCount,
                metadata: chunk.metadata,
              },
              create: {
                documentId: chunk.documentId,
                companyId: chunk.companyId,
                chunkIndex: chunk.chunkIndex,
                content: chunk.content,
                embedding: embedding,
                tokenCount: chunk.metadata.tokenCount,
                metadata: chunk.metadata,
              },
            });
          }
        }

        processedChunks += batch.length;
        const progress = Math.round((processedChunks / totalChunks) * 90); // Reserve 10% for vector storage

        // Update progress
        await db.trainingSession.update({
          where: { id: sessionId },
          data: { progress },
        });

        console.log(
          `Embedding progress: ${progress}% (${processedChunks}/${totalChunks} chunks)`
        );

        // Rate limiting delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing batch ${i}-${i + batchSize}:`, error);
        // Continue with next batch rather than failing entirely
      }
    }

    // Store all vectors in Supabase
    if (vectorDocuments.length > 0) {
      console.log(
        `Storing ${vectorDocuments.length} embeddings in Supabase...`
      );

      try {
        await VectorService.upsertDocuments(vectorDocuments);
        console.log("Successfully stored embeddings in Supabase");
      } catch (error) {
        console.error("Error storing embeddings in Supabase:", error);
        // Don't fail the training if vector storage fails
      }
    }

    // Final progress update
    await db.trainingSession.update({
      where: { id: sessionId },
      data: { progress: 95 },
    });

    // Update company's provider config with enhanced system prompt
    const session = await db.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        company: {
          include: { providerConfig: true },
        },
        documents: true,
      },
    });

    if (session?.company.providerConfig) {
      const documentSummary = `Based on ${
        documents.length
      } trained document(s): ${documents
        .map((d) => d.originalName)
        .join(", ")}`;
      const enhancedPrompt = session.company.providerConfig.systemPrompt;
      const finalPrompt = `${enhancedPrompt}\n\nTraining Context: ${documentSummary}. You now have access to company documents and can provide more accurate responses based on this context.`;

      await db.providerConfig.update({
        where: { id: session.company.providerConfig.id },
        data: {
          systemPrompt: finalPrompt,
        },
      });
    }

    // Mark training as completed
    await db.trainingSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        progress: 100,
        metadata: {
          documentCount: documents.length,
          totalChunks,
          chunkSize: settings.chunkSize,
          completedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`Training session ${sessionId} completed successfully`);
  } catch (error) {
    console.error(`Error in training session ${sessionId}:`, error);

    // Mark training as failed
    await db.trainingSession
      .update({
        where: { id: sessionId },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
        },
      })
      .catch(console.error);
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

    // Get training sessions for the company
    const trainingSessions = await db.trainingSession.findMany({
      where: { companyId: user.companyId },
      include: {
        documents: {
          select: {
            id: true,
            originalName: true,
            fileType: true,
          },
        },
        startedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10, // Limit to latest 10 sessions
    });

    return NextResponse.json({
      success: true,
      trainingSessions: trainingSessions.map((session) => ({
        id: session.id,
        status: session.status,
        progress: session.progress,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        errorMessage: session.errorMessage,
        documentCount: session.documents.length,
        documents: session.documents,
        startedBy: session.startedBy,
        metadata: session.metadata,
        createdAt: session.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching training sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get session ID from URL
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    // Find training session
    const trainingSession = await db.trainingSession.findUnique({
      where: { id: sessionId },
    });

    if (!trainingSession) {
      return NextResponse.json(
        { error: "Training session not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this session
    if (trainingSession.companyId !== user.companyId) {
      return NextResponse.json(
        { error: "Unauthorized to delete this training session" },
        { status: 403 }
      );
    }

    // Don't allow deletion of running sessions
    if (["PENDING", "PROCESSING"].includes(trainingSession.status)) {
      return NextResponse.json(
        { error: "Cannot delete running training session" },
        { status: 409 }
      );
    }

    // Delete training session
    await db.trainingSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({
      success: true,
      message: "Training session deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting training session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
