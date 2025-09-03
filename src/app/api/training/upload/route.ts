import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import DocumentProcessor from "@/lib/document-processor";
import path from "path";
import { z } from "zod";

const uploadSchema = z.object({
  file: z.instanceof(File),
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file
    const validation = DocumentProcessor.validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Save uploaded file
    const uploadsDir = path.join(process.cwd(), "uploads", "documents");
    const filename = await DocumentProcessor.saveUploadedFile(
      buffer,
      file.name,
      uploadsDir
    );

    const filePath = path.join(uploadsDir, filename);
    const fileType = DocumentProcessor.getFileType(file.name);

    // Create document record
    const document = await db.document.create({
      data: {
        filename,
        originalName: file.name,
        fileType: fileType.toUpperCase() as any,
        fileSize: file.size,
        filePath,
        status: "UPLOADED",
        companyId: user.companyId,
        uploadedById: user.id,
      },
    });

    // Process document in background
    processDocumentAsync(document.id, filePath, fileType).catch((error) => {
      console.error("Error processing document:", error);
    });

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.originalName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function processDocumentAsync(
  documentId: string,
  filePath: string,
  fileType: string
) {
  try {
    // Update status to processing
    await db.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    // Process the document
    const processed = await DocumentProcessor.processDocument(
      filePath,
      fileType
    );
    const cleanedText = DocumentProcessor.cleanText(processed.text);

    // Update document with extracted text
    await db.document.update({
      where: { id: documentId },
      data: {
        extractedText: cleanedText,
        status: "PROCESSED",
      },
    });

    console.log(`Document ${documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);

    // Update status to error
    await db.document
      .update({
        where: { id: documentId },
        data: { status: "ERROR" },
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
      include: { company: true },
    });

    if (!user || !user.companyId) {
      return NextResponse.json(
        { error: "User must be associated with a company" },
        { status: 400 }
      );
    }

    // Get company documents
    const documents = await db.document.findMany({
      where: { companyId: user.companyId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      documents: documents.map((doc) => ({
        id: doc.id,
        filename: doc.originalName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        status: doc.status,
        uploadedBy: doc.uploadedBy,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
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

    // Get document ID from URL
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID required" },
        { status: 400 }
      );
    }

    // Find document
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this document
    if (document.companyId !== user.companyId) {
      return NextResponse.json(
        { error: "Unauthorized to delete this document" },
        { status: 403 }
      );
    }

    // Delete file from filesystem
    await DocumentProcessor.deleteFile(document.filePath);

    // Delete document record
    await db.document.delete({
      where: { id: documentId },
    });

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
