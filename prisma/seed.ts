import { PrismaClient } from "@prisma/client";
import { encrypt } from "../src/lib/encryption";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Create demo company
  const company = await prisma.company.upsert({
    where: { id: "demo-company" },
    update: {},
    create: {
      id: "demo-company",
      name: "Demo Company",
    },
  });

  console.log("✅ Created demo company");

  // Create demo users
  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      email: "owner@example.com",
      name: "Company Owner",
      role: "OWNER",
      companyId: company.id,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin User",
      role: "ADMIN",
      companyId: company.id,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@example.com" },
    update: {},
    create: {
      email: "agent@example.com",
      name: "Support Agent",
      role: "AGENT",
      companyId: company.id,
    },
  });

  console.log("✅ Created demo users");

  // Create demo provider config (with dummy encrypted API key)
  const dummyApiKey = await encrypt("sk-dummy-api-key-for-demo");

  const providerConfig = await prisma.providerConfig.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      provider: "OPENAI",
      apiKeyEnc: dummyApiKey,
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 512,
      systemPrompt: `You are a helpful customer support assistant for Demo Company. 
Be friendly, professional, and concise in your responses. 
If you cannot help with a request, politely ask the customer to wait for a human agent.`,
    },
  });

  console.log("✅ Created demo provider config");

  // Create demo page connection (with dummy tokens)
  const dummyPageToken = await encrypt("dummy-page-access-token");
  const dummyVerifyToken = await encrypt("dummy-verify-token");

  const pageConnection = await prisma.pageConnection.upsert({
    where: { pageId: "demo-page-123" },
    update: {},
    create: {
      companyId: company.id,
      pageId: "demo-page-123",
      pageName: "Demo Company Page",
      pageAccessTokenEnc: dummyPageToken,
      verifyTokenEnc: dummyVerifyToken,
      subscribed: true,
    },
  });

  console.log("✅ Created demo page connection");

  // Create demo conversations
  const conversation1 = await prisma.conversation.upsert({
    where: { id: "demo-conv-1" },
    update: {},
    create: {
      id: "demo-conv-1",
      pageId: pageConnection.id,
      psid: "user-123",
      status: "OPEN",
      autoBot: false,
      assigneeId: agent.id,
      notes: "Customer asking about product pricing",
      tags: ["pricing", "sales"],
    },
  });

  const conversation2 = await prisma.conversation.upsert({
    where: { id: "demo-conv-2" },
    update: {},
    create: {
      id: "demo-conv-2",
      pageId: pageConnection.id,
      psid: "user-456",
      status: "OPEN",
      autoBot: true,
      notes: "Technical support inquiry",
      tags: ["support", "technical"],
    },
  });

  console.log("✅ Created demo conversations");

  // Create demo messages
  const messages = [
    {
      conversationId: conversation1.id,
      role: "USER" as const,
      text: "Hi, I'm interested in your pricing plans. Can you help me?",
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    },
    {
      conversationId: conversation1.id,
      role: "AGENT" as const,
      text: "Hello! I'd be happy to help you with our pricing. We have several plans available. What type of solution are you looking for?",
      createdAt: new Date(Date.now() - 50 * 60 * 1000), // 50 minutes ago
    },
    {
      conversationId: conversation1.id,
      role: "USER" as const,
      text: "I need something for a small team of about 10 people.",
      createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes ago
    },
    {
      conversationId: conversation2.id,
      role: "USER" as const,
      text: "I'm having trouble logging into my account. Can you help?",
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    },
    {
      conversationId: conversation2.id,
      role: "BOT" as const,
      text: "I'd be happy to help you with your login issue. Let me ask a few questions to better assist you:\n\n1. What email address are you using to log in?\n2. Are you receiving any specific error messages?\n3. Have you tried resetting your password recently?",
      providerUsed: "OPENAI" as const,
      meta: {
        usage: { totalTokens: 156, promptTokens: 89, completionTokens: 67 },
        model: "gpt-4o-mini",
      },
      createdAt: new Date(Date.now() - 29 * 60 * 1000), // 29 minutes ago
    },
    {
      conversationId: conversation2.id,
      role: "USER" as const,
      text: 'I\'m using john@example.com and getting "invalid credentials" error.',
      createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    },
  ];

  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: `${message.conversationId}-${message.createdAt.getTime()}` },
      update: {},
      create: {
        id: `${message.conversationId}-${message.createdAt.getTime()}`,
        ...message,
      },
    });
  }

  console.log("✅ Created demo messages");

  // Update conversation last message times
  await prisma.conversation.update({
    where: { id: conversation1.id },
    data: { lastMessageAt: new Date(Date.now() - 40 * 60 * 1000) },
  });

  await prisma.conversation.update({
    where: { id: conversation2.id },
    data: { lastMessageAt: new Date(Date.now() - 15 * 60 * 1000) },
  });

  console.log("✅ Updated conversation timestamps");

  console.log("🎉 Database seeding completed!");
  console.log("\nDemo users created:");
  console.log("  Owner: owner@example.com");
  console.log("  Admin: admin@example.com");
  console.log("  Agent: agent@example.com");
  console.log(
    "\nYou can sign in with any of these email addresses using the magic link authentication."
  );
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
