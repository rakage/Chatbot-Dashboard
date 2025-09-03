import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canManageSettings } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { llmService } from "@/lib/llm/service";
import { z } from "zod";

const providerConfigSchema = z.object({
  provider: z.enum(["OPENAI", "GEMINI", "OPENROUTER"]),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().min(1).max(4000),
  systemPrompt: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageSettings(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!session.user.companyId) {
      return NextResponse.json(
        { error: "No company associated" },
        { status: 400 }
      );
    }

    const providerConfig = await db.providerConfig.findUnique({
      where: { companyId: session.user.companyId },
    });

    if (!providerConfig) {
      return NextResponse.json({ config: null });
    }

    // Return config without decrypted API key
    return NextResponse.json({
      config: {
        id: providerConfig.id,
        provider: providerConfig.provider,
        model: providerConfig.model,
        temperature: providerConfig.temperature,
        maxTokens: providerConfig.maxTokens,
        systemPrompt: providerConfig.systemPrompt,
        hasApiKey: !!providerConfig.apiKeyEnc,
      },
    });
  } catch (error) {
    console.error("Get provider config error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canManageSettings(session.user.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!session.user.companyId) {
      return NextResponse.json(
        { error: "No company associated" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const config = providerConfigSchema.parse(body);

    // Validate provider and model
    if (!llmService.isProviderSupported(config.provider)) {
      return NextResponse.json(
        { error: "Unsupported provider" },
        { status: 400 }
      );
    }

    const availableModels = llmService.getAvailableModels(
      config.provider as any
    );
    if (!availableModels.includes(config.model)) {
      return NextResponse.json(
        { error: "Unsupported model for this provider" },
        { status: 400 }
      );
    }

    // Encrypt API key
    const encryptedApiKey = await encrypt(config.apiKey);
    console.log(
      "🔐 Encrypted API key type:",
      typeof encryptedApiKey,
      "length:",
      encryptedApiKey.length
    );

    // Upsert provider config
    const providerConfig = await db.providerConfig.upsert({
      where: { companyId: session.user.companyId },
      create: {
        companyId: session.user.companyId,
        provider: config.provider as any,
        apiKeyEnc: encryptedApiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        systemPrompt: config.systemPrompt,
      },
      update: {
        provider: config.provider as any,
        apiKeyEnc: encryptedApiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        systemPrompt: config.systemPrompt,
      },
    });

    // Clear provider cache to use new config
    llmService.clearProviders();

    return NextResponse.json({
      config: {
        id: providerConfig.id,
        provider: providerConfig.provider,
        model: providerConfig.model,
        temperature: providerConfig.temperature,
        maxTokens: providerConfig.maxTokens,
        systemPrompt: providerConfig.systemPrompt,
        hasApiKey: true,
      },
    });
  } catch (error) {
    console.error("Save provider config error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
