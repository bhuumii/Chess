"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { useSession, signOut } from "next-auth/react";
import { SessionProvider } from "next-auth/react";

type Player = { id: string; name: string | null; image: string | null };
type Game = { id: string; whitePlayer: Player | null };

function PlayerAvatar({ player, label }: { player: Player | null; label: string }) {
  if (player?.image) {
    return <img src={player.image} alt={label} className="h-10 w-10 rounded-lg border border-white/10 object-cover" />;
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#4f7f55] text-sm font-bold text-white">
      {(player?.name ?? "A").charAt(0).toUpperCase()}
    </div>
  );
}

function PublicLobby() {
  const { data: session, status } = useSession();
  const [openGames, setOpenGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchOpenGames() {
    try {
      const res = await fetch("/api/open");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (Array.isArray(data)) setOpenGames(data);
    } catch (error) {
      console.error("Could not fetch open games", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      fetchOpenGames();
      const interval = setInterval(fetchOpenGames, 10000);
      return () => clearInterval(interval);
    }
  }, [status]);

  if (status === "loading" || isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-[#f1eadc]">Loading lobby...</div>;
  }

  const joinableGames = openGames.filter((game) => session?.user && game.whitePlayer?.id !== session.user.id);
  const userName = session?.user?.name ?? session?.user?.email ?? "Player";

  return (
    <main className="app-shell">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#c89b3c] hover:text-[#f1eadc]">Back to home</Link>
            <h1 className="mt-2 text-3xl font-bold text-[#f1eadc]">Public Lobby</h1>
            <p className="mt-1 text-[#b9ae9a]">Join an open game or create a new one.</p>
          </div>

          {session?.user && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2 pr-3">
              <PlayerAvatar player={{ id: session.user.id, name: userName, image: session.user.image ?? null }} label="Your avatar" />
              <div>
                <p className="max-w-40 truncate text-sm font-semibold text-[#f1eadc]">{userName}</p>
                <button onClick={() => signOut()} className="text-xs text-[#b9ae9a] hover:text-[#f1eadc]">Sign out</button>
              </div>
            </div>
          )}
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_18rem]">
          <div className="ui-card rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-[#f1eadc]">Open games</h2>
              <p className="text-sm text-[#b9ae9a]">Refreshes every 10 seconds</p>
            </div>

            <div className="scrollbar-soft max-h-[30rem] space-y-3 overflow-y-auto pr-1">
              {joinableGames.length > 0 ? (
                joinableGames.map((game) => (
                  <div key={game.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar player={game.whitePlayer} label="Opponent avatar" />
                      <div>
                        <p className="font-semibold text-[#f1eadc]">{game.whitePlayer?.name ?? "Anonymous"}</p>
                        <p className="font-mono text-xs text-[#b9ae9a]">{game.id}</p>
                      </div>
                    </div>
                    <Link href={"/game/" + game.id} className="ui-button bg-[#4f7f55] px-5 py-2.5 text-white sm:w-28">Join</Link>
                  </div>
                ))
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/10 p-8 text-center">
                  <h3 className="text-xl font-bold text-[#f1eadc]">No open games right now</h3>
                  <p className="mt-2 max-w-sm text-[#b9ae9a]">Create a public game and it will show here for someone else to join.</p>
                </div>
              )}
            </div>
          </div>

          <aside className="ui-card h-fit rounded-xl p-5">
            <h2 className="text-xl font-bold text-[#f1eadc]">Create game</h2>
            <p className="mt-2 text-sm leading-6 text-[#b9ae9a]">Start a public board and wait for another player.</p>
            <Link href={"/game/" + nanoid(7) + "?type=public"} className="ui-button mt-5 w-full bg-[#4f7f55] px-5 py-3 text-white">Create Public Game</Link>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default function PublicLobbyWrapper() {
  return (
    <SessionProvider>
      <PublicLobby />
    </SessionProvider>
  );
}
