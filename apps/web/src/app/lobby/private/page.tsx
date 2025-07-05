"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { nanoid } from "nanoid";
import { SessionProvider } from "next-auth/react";

function PrivateLobby() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) router.push(`/game/${joinCode.trim()}`);
  };

  return (
    <div className="w-full max-w-md rounded-lg bg-gray-800 p-8 text-white shadow-xl">
      <h1 className="mb-8 text-center text-3xl font-bold">Private Game</h1>

      <Link
        href={`/game/${nanoid(7)}?type=private`}
        className="block w-full rounded-lg bg-blue-600 p-5 text-center text-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-100"
      >
        + Create New Game
      </Link>

      <div className="my-6 text-center text-gray-400">OR</div>

      <form onSubmit={handleJoinGame}>
        <h2 className="mb-4 text-center text-xl font-semibold">
          Join with a Code
        </h2>
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="ENTER CODE"
          className="w-full rounded-md border-gray-600 bg-gray-700 p-3 text-center text-2xl tracking-widest text-white placeholder-gray-500"
          maxLength={7}
        />
        <button
          type="submit"
          disabled={!joinCode.trim()}
          className="mt-4 w-full rounded-lg bg-green-600 p-4 text-lg font-bold shadow-lg transition hover:bg-green-500 disabled:opacity-50 active:brightness-90"
        >
          Join Game
        </button>
      </form>
    </div>
  );
}

export default function PrivateLobbyWrapper() {
  return (
    <SessionProvider>
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
        <PrivateLobby />
      </div>
    </SessionProvider>
  );
}
