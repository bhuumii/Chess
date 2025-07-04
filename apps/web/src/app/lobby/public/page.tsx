"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { useSession, signOut } from "next-auth/react";
import { SessionProvider } from "next-auth/react";

type Player = {
  id: string;
  name: string | null;
  image: string | null;
};

type Game = {
  id: string;
  whitePlayer: Player | null;
};

function PublicLobby() {
  const { data: session, status } = useSession();
  const [openGames, setOpenGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchOpenGames() {
    try {
      const res = await fetch("http://localhost:8000/open");
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
    return <div className="text-center text-white">Loading Lobby...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl rounded-lg bg-gray-800 p-6 shadow-xl">
      <div className="mb-6 flex items-center justify-between border-b border-gray-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Public Lobby</h1>
          <p className="text-gray-400">Join a game or create your own</p>
        </div>

        {/* User Info and Sign Out Button */}
        {session?.user && (
          <div className="flex items-center gap-4">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt="Your avatar"
                className="h-12 w-12 rounded-full border-2 border-gray-600"
              />
            ) : (
              <div className="h-12 w-12 rounded-full border-2 border-gray-600 bg-gray-700 flex items-center justify-center font-bold">
                {session.user.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => signOut()}
              className="rounded-md bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-500"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {/* Open Games List */}
        <div className="rounded-md bg-gray-900 p-4 h-96 overflow-y-auto">
          <h2 className="mb-4 text-xl font-semibold text-white">
            Available to Join
          </h2>
          <div className="space-y-3">
            {openGames.length > 0 ? (
              openGames.map((game) => {
                if (
                  !session?.user ||
                  game.whitePlayer?.id === session.user.id
                ) {
                  return null;
                }

                return (
                  <div
                    key={game.id}
                    className="flex items-center justify-between rounded-lg bg-gray-700 p-3"
                  >
                    <div className="flex items-center gap-3">
                      {game.whitePlayer?.image ? (
                        <img
                          src={game.whitePlayer.image}
                          alt="Opponent's avatar"
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-600 flex items-center justify-center font-bold">
                          {game.whitePlayer?.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-semibold">
                        {game.whitePlayer?.name ?? "Anonymous"}
                      </span>
                    </div>
                    <Link
                      href={`/game/${game.id}`}
                      className="rounded-md bg-green-600 px-5 py-2 font-bold text-white hover:bg-green-500"
                    >
                      Join
                    </Link>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500 pt-16">
                No open games. Why not create one?
              </p>
            )}
          </div>
        </div>

        {/* Create Game Button */}
        <div className="flex-shrink-0">
          <Link
            href={`/game/${nanoid(7)}?type=public`}
            className="block w-full rounded-lg bg-blue-600 p-6 text-center text-xl font-bold text-white shadow-lg hover:bg-blue-500"
          >
            + Create New Public Game
          </Link>
        </div>
      </div>
    </div>
  );
}
export default function PublicLobbyWrapper() {
  return (
    <SessionProvider>
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
        <PublicLobby />
      </div>
    </SessionProvider>
  );
}
