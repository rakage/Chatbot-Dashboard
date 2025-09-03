import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerSession } from "next-auth";
import SessionProvider from "@/components/providers/SessionProvider";
import { authOptions } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Facebook Bot Dashboard",
  description:
    "Manage your Facebook Messenger chatbot with real-time conversations and AI integration",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
