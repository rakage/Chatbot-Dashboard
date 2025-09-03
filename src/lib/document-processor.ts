import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import fs from "fs/promises";
import path from "path";

export interface ProcessedDocument {
  text: string;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    language?: string;
  };
}

export class DocumentProcessor {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly ALLOWED_TYPES = ["pdf", "doc", "docx", "txt"];

  static validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${
          this.MAX_FILE_SIZE / (1024 * 1024)
        }MB`,
      };
    }

    // Check file type
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (!fileExtension || !this.ALLOWED_TYPES.includes(fileExtension)) {
      return {
        valid: false,
        error: `File type not supported. Allowed types: ${this.ALLOWED_TYPES.join(
          ", "
        )}`,
      };
    }

    return { valid: true };
  }

  static async processDocument(
    filePath: string,
    fileType: string
  ): Promise<ProcessedDocument> {
    try {
      switch (fileType.toLowerCase()) {
        case "pdf":
          return await this.processPDF(filePath);
        case "docx":
          return await this.processDOCX(filePath);
        case "doc":
          return await this.processDOC(filePath);
        case "txt":
          return await this.processTXT(filePath);
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error("Error processing document:", error);
      throw new Error(
        `Failed to process document: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private static async processPDF(
    filePath: string
  ): Promise<ProcessedDocument> {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);

    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).length,
      },
    };
  }

  private static async processDOCX(
    filePath: string
  ): Promise<ProcessedDocument> {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages.length > 0) {
      console.warn("DOCX processing warnings:", result.messages);
    }

    return {
      text: result.value,
      metadata: {
        wordCount: result.value.split(/\s+/).length,
      },
    };
  }

  private static async processDOC(
    filePath: string
  ): Promise<ProcessedDocument> {
    // For .doc files, we'll use mammoth which has limited support
    // In production, you might want to use a more robust solution
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages.length > 0) {
      console.warn("DOC processing warnings:", result.messages);
    }

    return {
      text: result.value,
      metadata: {
        wordCount: result.value.split(/\s+/).length,
      },
    };
  }

  private static async processTXT(
    filePath: string
  ): Promise<ProcessedDocument> {
    const text = await fs.readFile(filePath, "utf-8");

    return {
      text,
      metadata: {
        wordCount: text.split(/\s+/).length,
      },
    };
  }

  static async saveUploadedFile(
    file: Buffer,
    originalName: string,
    uploadsDir: string
  ): Promise<string> {
    // Ensure uploads directory exists
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const extension = path.extname(originalName);
    const basename = path.basename(originalName, extension);
    const filename = `${basename}_${timestamp}${extension}`;
    const filePath = path.join(uploadsDir, filename);

    // Save file
    await fs.writeFile(filePath, file);

    return filename;
  }

  static getFileType(filename: string): string {
    const extension = path.extname(filename).toLowerCase().slice(1);
    return extension;
  }

  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error("Error deleting file:", error);
      // Don't throw error for file deletion failures
    }
  }

  static formatFileSize(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  }

  static cleanText(text: string): string {
    // Remove excessive whitespace and normalize line breaks
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  static preprocessText(text: string): string {
    // Clean and prepare text for embedding
    return text
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\n{3,}/g, "\n\n") // Limit consecutive newlines
      .trim();
  }

  static chunkText(text: string, maxChunkSize: number = 2000): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split("\n\n");
    let currentChunk = "";

    for (const paragraph of paragraphs) {
      if (this.canAddToParagraph(currentChunk, paragraph, maxChunkSize)) {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      } else if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        // Paragraph is too long, split it
        const splitChunks = this.splitLongParagraph(paragraph, maxChunkSize);
        chunks.push(...splitChunks.slice(0, -1));
        currentChunk = splitChunks[splitChunks.length - 1] || "";
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private static canAddToParagraph(
    currentChunk: string,
    paragraph: string,
    maxChunkSize: number
  ): boolean {
    return currentChunk.length + paragraph.length + 2 <= maxChunkSize;
  }

  private static splitLongParagraph(
    paragraph: string,
    maxChunkSize: number
  ): string[] {
    const sentences = paragraph.split(/[.!?]+/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 1 <= maxChunkSize) {
        currentChunk += (currentChunk ? "." : "") + sentence;
      } else if (currentChunk) {
        chunks.push(currentChunk + ".");
        currentChunk = sentence;
      } else {
        // Sentence is too long, force split
        chunks.push(sentence.slice(0, maxChunkSize));
        currentChunk = sentence.slice(maxChunkSize);
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}

export default DocumentProcessor;
