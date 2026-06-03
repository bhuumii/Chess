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
    if (joinCode.trim()) router.push("/game/" + joinCode.trim() + "?type=private");
  };

  return (
    <main className="app-shell flex items-center">
      <div className="mx-auto w-full max-w-md">
        <section className="ui-card rounded-xl p-6">
          <Link href="/" className="text-sm font-semibold text-[#c89b3c] hover:text-[#f1eadc]">Back to home</Link>
          <h1 className="mt-3 text-3xl font-bold text-[#f1eadc]">Private Game</h1>
          <p className="mt-2 text-[#b9ae9a]">Create a game for a friend or join using their code.</p>

          <Link href={"/game/" + nanoid(7) + "?type=private"} className="ui-button mt-6 w-full bg-[#536f8f] px-5 py-3 text-white">Create New Game</Link>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#b9ae9a]">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleJoinGame} className="space-y-4">
            <div>
              <label htmlFor="join-code" className="mb-1.5 block text-sm font-semibold text-[#f1eadc]">Game code</label>
              <input id="join-code" type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="ENTER CODE" className="ui-input w-full rounded-lg px-4 py-3 text-center font-mono text-xl font-bold uppercase tracking-[0.2em] placeholder:text-[#756b5b]" maxLength={7} />
            </div>
            <button type="submit" disabled={!joinCode.trim()} className="ui-button w-full bg-[#4f7f55] px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50">Join Game</button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function PrivateLobbyWrapper() {
  return (
    <SessionProvider>
      <PrivateLobby />
    </SessionProvider>
  );
}
