"use client";

import Link from "next/link";
import { useSession, signIn, signOut, SessionProvider } from "next-auth/react";

// This is the main component that decides what to show
function MainPage() {
  // The useSession hook gives us the user's session data and a status
  const { data: session, status } = useSession();

  // 1. While the session is being checked, show a loading message
  if (status === "loading") {
    return <div className="text-center text-white animate-pulse">Loading...</div>;
  }

  // 2. If the status is "unauthenticated", show the Sign-In screen
  if (status === "unauthenticated") {
    return (
        <div className="flex flex-col items-center justify-center text-center">
            <h1 className="mb-4 text-5xl font-bold tracking-tight text-white">Chess Clone</h1>
            <p className="mb-12 text-xl text-gray-400">Please sign in to continue</p>
            <button
                onClick={() => signIn("google", { callbackUrl: "/" })}
                className="rounded-lg bg-indigo-600 px-8 py-4 text-xl font-semibold text-white shadow-lg transition-transform hover:scale-105 active:scale-100"
            >
                Sign In with Google
            </button>
        </div>
    );
  }

  // 3. If we have a session (status is "authenticated"), show the main Hub
  return (
    <div className="w-full max-w-lg text-center">
      <div className="mb-8">
          <img src={session?.user?.image ?? ''} alt="Your avatar" className="mx-auto h-20 w-20 rounded-full border-4 border-gray-700"/>
          <h1 className="text-4xl font-bold text-white mt-4">Welcome, {session?.user?.name}!</h1>
          <p className="text-lg text-gray-400 mt-2">How would you like to play?</p>
      </div>

      <div className="space-y-4">
        <Link href="/lobby/public" className="block rounded-lg bg-green-600 p-6 text-xl font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-100">
          Play Online (Public)
        </Link>
        <Link href="/lobby/private" className="block rounded-lg bg-blue-600 p-6 text-xl font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-100">
          Play with a Friend (Private)
        </Link>
      </div>
      <button onClick={() => signOut()} className="mt-8 text-gray-400 hover:text-white transition">Sign Out</button>
    </div>
  );
}


// This wrapper provides the Session context and the background color
export default function HubPageWrapper() {
  return (
    <SessionProvider>
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
        <MainPage />
      </div>
    </SessionProvider>
  )
}
