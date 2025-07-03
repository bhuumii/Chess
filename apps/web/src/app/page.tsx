"use client";
import Link from "next/link";
import { useSession, signOut, SessionProvider } from "next-auth/react";

function Hub() {
  const { data: session, status } = useSession();
  if (status === "loading") return <div className="text-white">Loading...</div>;
  if (!session) return <div className="text-white">Please sign in.</div>;

  return (
    <div className="w-full max-w-lg text-center">
      <h1 className="text-4xl font-bold text-white mb-2">
        Welcome, {session.user?.name}!
      </h1>
      <p className="text-lg text-gray-400 mb-8">How would you like to play?</p>
      <div className="space-y-4">
        <Link
          href="/lobby/public"
          className="block rounded-lg bg-green-600 p-6 text-xl font-bold text-white shadow-lg transition hover:bg-green-500"
        >
          Play Online (Public)
        </Link>
        <Link
          href="/lobby/private"
          className="block rounded-lg bg-blue-600 p-6 text-xl font-bold text-white shadow-lg transition hover:bg-blue-500"
        >
          Play with a Friend (Private)
        </Link>
      </div>
      <button
        onClick={() => signOut()}
        className="mt-8 text-gray-400 hover:text-white"
      >
        Sign Out
      </button>
    </div>
  );
}

export default function HubPageWrapper() {
  return (
    <SessionProvider>
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
        <Hub />
      </div>
    </SessionProvider>
  );
}
