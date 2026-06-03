"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useSession, signIn, signOut, SessionProvider } from "next-auth/react";
import { AVATAR_PRESETS, buildAvatarDataUri } from "@/lib/avatars";

type PlayerStats = {
  played: number;
  won: number;
  lost: number;
  draw: number;
};

function BoardPreview() {
  return (
    <div className="board-preview aspect-square w-full max-w-sm">
      {Array.from({ length: 64 }).map((_, index) => (
        <span
          key={index}
          className={(index + Math.floor(index / 8)) % 2 === 0 ? "bg-[#e5d1a7]" : "bg-[#8d6748]"}
        />
      ))}
    </div>
  );
}

function ProfileMenu({
  name,
  image,
  onSaved,
}: {
  name: string;
  image: string | null | undefined;
  onSaved: (profile: { name: string; image: string }) => Promise<void>;
}) {
  const fallbackAvatar = buildAvatarDataUri(AVATAR_PRESETS[0]);
  const currentAvatar = image ?? fallbackAvatar;
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"stats" | "profile">("stats");
  const [username, setUsername] = useState(name);
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);
  const [profileMessage, setProfileMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    setUsername(name);
    setSelectedAvatar(image ?? fallbackAvatar);
  }, [name, image, fallbackAvatar]);

  useEffect(() => {
    let isCancelled = false;

    async function loadStats() {
      try {
        const response = await fetch("/api/profile/stats");
        const data = (await response.json().catch(() => null)) as PlayerStats | { error?: string } | null;

        const isStats =
          data &&
          "played" in data &&
          "won" in data &&
          "lost" in data &&
          "draw" in data;

        if (!response.ok || !isStats) {
          if (!isCancelled) setStatsError("Could not load stats.");
          return;
        }

        if (!isCancelled) setStats(data);
      } catch {
        if (!isCancelled) setStatsError("Could not load stats.");
      }
    }

    loadStats();
    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: username, image: selectedAvatar }),
      });
      const data = (await response.json().catch(() => null)) as {
        name?: string;
        image?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.name || !data?.image) {
        setProfileMessage(data?.error ?? "Could not save profile.");
        return;
      }

      await onSaved({ name: data.name, image: data.image });
      setProfileMessage("Profile saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="relative z-20"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/30 p-1 transition hover:border-[#c89b3c]/70"
        aria-label="Open profile menu"
      >
        <img src={currentAvatar} alt="Your avatar" className="h-full w-full rounded-full object-cover" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-14 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-[#20201d] p-4 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <img src={currentAvatar} alt="Your avatar" className="h-12 w-12 rounded-full border border-white/10 object-cover" />
            <div className="min-w-0">
              <p className="truncate font-bold text-[#f1eadc]">{name}</p>
              <p className="text-sm text-[#b9ae9a]">Player profile</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setActivePanel("stats")}
              className={"rounded-md px-3 py-2 text-sm font-semibold transition " + (activePanel === "stats" ? "bg-[#c89b3c] text-[#141414]" : "text-[#b9ae9a] hover:text-[#f1eadc]")}
            >
              Stats
            </button>
            <button
              type="button"
              onClick={() => setActivePanel("profile")}
              className={"rounded-md px-3 py-2 text-sm font-semibold transition " + (activePanel === "profile" ? "bg-[#c89b3c] text-[#141414]" : "text-[#b9ae9a] hover:text-[#f1eadc]")}
            >
              Edit profile
            </button>
          </div>

          {activePanel === "stats" ? (
            <div className="mt-4">
              {stats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#b9ae9a]">Played</p>
                    <p className="mt-1 text-2xl font-bold text-[#f1eadc]">{stats.played}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#b9ae9a]">Won</p>
                    <p className="mt-1 text-2xl font-bold text-[#4f7f55]">{stats.won}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#b9ae9a]">Lost</p>
                    <p className="mt-1 text-2xl font-bold text-[#94443d]">{stats.lost}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#b9ae9a]">Draw</p>
                    <p className="mt-1 text-2xl font-bold text-[#c89b3c]">{stats.draw}</p>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-[#b9ae9a]">
                  {statsError || "Loading stats..."}
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              <div>
                <label htmlFor="profile-name" className="mb-1.5 block text-sm font-semibold text-[#f1eadc]">Username</label>
                <input
                  id="profile-name"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={2}
                  maxLength={30}
                  className="ui-input w-full rounded-lg px-4 py-3"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-[#f1eadc]">Avatar</p>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_PRESETS.map((seed) => {
                    const avatar = buildAvatarDataUri(seed);
                    const isSelected = avatar === selectedAvatar;
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar)}
                        className={"rounded-lg border p-1 transition " + (isSelected ? "border-[#c89b3c] bg-[#c89b3c]/10" : "border-white/10 bg-black/20 hover:border-white/25")}
                        aria-label={"Choose avatar " + seed}
                      >
                        <img src={avatar} alt="" className="h-12 w-12 rounded-md" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {profileMessage && <p className="text-sm font-semibold text-[#b9ae9a]">{profileMessage}</p>}

              <button type="submit" disabled={isSaving} className="ui-button w-full bg-[#c89b3c] px-5 py-3 text-[#141414] disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => signOut()}
            className="mt-4 w-full rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-[#b9ae9a] transition hover:border-[#94443d]/60 hover:text-[#f1eadc]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MainPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCredentialsAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          setMessage(data?.error ?? "Signup failed. Please try again.");
          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false });

      if (result?.error) {
        setMessage(mode === "login" ? "Invalid email or password." : "Signup worked, but login failed. Please try logging in.");
        return;
      }

      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-lg font-semibold text-[#f1eadc]">Loading...</div>;
  }

  if (status === "unauthenticated") {
    const loginTabClass = "rounded-md px-4 py-2 text-sm font-semibold transition " + (mode === "login" ? "bg-[#c89b3c] text-[#141414]" : "text-[#b9ae9a] hover:bg-white/5 hover:text-[#f1eadc]");
    const signupTabClass = "rounded-md px-4 py-2 text-sm font-semibold transition " + (mode === "signup" ? "bg-[#c89b3c] text-[#141414]" : "text-[#b9ae9a] hover:bg-white/5 hover:text-[#f1eadc]");

    return (
      <main className="app-shell flex items-center">
        <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_25rem] lg:items-center">
          <section>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#c89b3c]">Online chess</p>
            <h1 className="font-display text-4xl leading-tight text-[#f1eadc] sm:text-5xl">Play chess with friends or open opponents.</h1>
            <p className="mt-4 max-w-xl text-lg leading-7 text-[#b9ae9a]">
              Create a public board, invite a friend with a private code, or sign back in to continue playing.
            </p>
            <div className="mt-8 hidden lg:block">
              <BoardPreview />
            </div>
          </section>

          <section className="ui-card rounded-xl p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-[#f1eadc]">{mode === "login" ? "Log in" : "Create account"}</h2>
              <p className="mt-1 text-sm text-[#b9ae9a]">Use Google or email and password.</p>
            </div>

            <div className="mb-5 grid grid-cols-2 rounded-lg bg-black/25 p-1">
              <button type="button" onClick={() => { setMode("login"); setMessage(""); }} className={loginTabClass}>Login</button>
              <button type="button" onClick={() => { setMode("signup"); setMessage(""); }} className={signupTabClass}>Signup</button>
            </div>

            {mode === "login" && (
              <button type="button" onClick={() => signIn("google", { callbackUrl: "/" })} className="ui-button mb-4 w-full bg-[#f1eadc] px-5 py-3 text-[#141414]">
                Continue with Google
              </button>
            )}

            <form onSubmit={handleCredentialsAuth} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[#f1eadc]">Email</label>
                <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="ui-input w-full rounded-lg px-4 py-3" placeholder="you@example.com" />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-[#f1eadc]">Password</label>
                <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} className="ui-input w-full rounded-lg px-4 py-3" placeholder="Minimum 6 characters" />
              </div>

              {message && <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{message}</p>}

              <button type="submit" disabled={isSubmitting} className="ui-button w-full bg-[#4f7f55] px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? (mode === "login" ? "Logging in..." : "Signing up...") : mode === "login" ? "Login with Email" : "Create Account"}
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const displayName = session?.user?.name ?? session?.user?.email ?? "Player";

  return (
    <main className="app-shell relative flex min-h-screen items-center">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6 lg:right-8 lg:top-8">
        <ProfileMenu
          name={displayName}
          image={session?.user?.image}
          onSaved={async (profile) => {
            await update({ user: profile });
            router.refresh();
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 text-center">
          <p className="text-sm text-[#b9ae9a]">Welcome, {displayName}</p>
          <h1 className="mt-2 text-3xl font-bold text-[#f1eadc]">Choose a game mode</h1>
        </div>

        <section className="grid gap-5 md:grid-cols-2">
          <Link href="/lobby/public" className="ui-card rounded-xl p-6 transition hover:border-[#c89b3c]/50">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c89b3c]">Public game</p>
            <h2 className="mt-3 text-3xl font-bold text-[#f1eadc]">Play Online</h2>
            <p className="mt-3 text-[#b9ae9a]">Join an open board or create one for another player to join.</p>
            <span className="ui-button mt-6 bg-[#4f7f55] px-5 py-3 text-white">Open Public Lobby</span>
          </Link>

          <Link href="/lobby/private" className="ui-card rounded-xl p-6 transition hover:border-[#c89b3c]/50">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c89b3c]">Private game</p>
            <h2 className="mt-3 text-3xl font-bold text-[#f1eadc]">Play with a Friend</h2>
            <p className="mt-3 text-[#b9ae9a]">Create a game code or join one shared by a friend.</p>
            <span className="ui-button mt-6 bg-[#536f8f] px-5 py-3 text-white">Open Private Lobby</span>
          </Link>
        </section>
      </div>
    </main>
  );
}

export default function HubPageWrapper() {
  return (
    <SessionProvider>
      <MainPage />
    </SessionProvider>
  );
}
