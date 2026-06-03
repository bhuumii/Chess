"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useSession, signIn, signOut, SessionProvider } from "next-auth/react";

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

function MainPage() {
  const { data: session, status } = useSession();
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
    <main className="app-shell">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {session?.user?.image ? (
              <img src={session.user.image} alt="Your avatar" className="h-14 w-14 rounded-lg border border-white/10 object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-[#4f7f55] text-xl font-bold text-white">{displayName.charAt(0).toUpperCase()}</div>
            )}
            <div>
              <p className="text-sm text-[#b9ae9a]">Signed in as</p>
              <h1 className="text-2xl font-bold text-[#f1eadc]">{displayName}</h1>
            </div>
          </div>
          <button onClick={() => signOut()} className="ui-button border border-white/10 bg-transparent px-4 py-2.5 text-[#b9ae9a] hover:text-[#f1eadc]">Sign Out</button>
        </header>

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
