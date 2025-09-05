"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-black mb-8">
          Salsation AI Agent
        </h1>
        <Link
          href="/auth/login"
          className="bg-black hover:bg-gray-800 text-white font-semibold py-4 px-8 rounded-lg transition-colors text-lg"
        >
          Login
        </Link>
      </div>
    </div>
  );
}
