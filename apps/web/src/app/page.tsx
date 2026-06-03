"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useSession, signIn, signOut, SessionProvider } from "next-auth/react";

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

        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok) {
          setMessage(data?.error ?? "Signup failed. Please try again.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setMessage(
          mode === "login"
            ? "Invalid email or password."
            : "Signup worked, but login failed. Please try logging in.",
        );
        return;
      }

      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading") {
    return <div className="text-center text-white animate-pulse">Loading...</div>;
  }

  if (status === "unauthenticated") {
    const loginTabClass = "rounded-md px-4 py-2 transition " +
      (mode === "login" ? "bg-indigo-600 text-white" : "hover:text-white");
    const signupTabClass = "rounded-md px-4 py-2 transition " +
      (mode === "signup" ? "bg-indigo-600 text-white" : "hover:text-white");

    return (
      <div className="w-full max-w-md text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-white">Chess Clone</h1>
        <p className="mb-8 text-xl text-gray-400">Please sign in to continue</p>

        <div className="rounded-2xl border border-gray-700 bg-gray-800/70 p-6 text-left shadow-2xl">
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-gray-900 p-1 text-sm font-semibold text-gray-300">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={loginTabClass}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
              className={signupTabClass}
            >
              Signup
            </button>
          </div>

          {mode === "login" && (
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="mb-4 w-full rounded-lg bg-white px-5 py-3 text-base font-semibold text-gray-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-100"
            >
              Login with Google
            </button>
          )}

          <form onSubmit={handleCredentialsAuth} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-200">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-600 bg-gray-950 px-4 py-3 text-white outline-none transition focus:border-indigo-400"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-200">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-gray-600 bg-gray-950 px-4 py-3 text-white outline-none transition focus:border-indigo-400"
                placeholder="Minimum 6 characters"
              />
            </div>

            {message && <p className="text-sm font-medium text-red-300">{message}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-indigo-600 px-5 py-3 text-base font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? mode === "login"
                  ? "Logging in..."
                  : "Signing up..."
                : mode === "login"
                  ? "Login with Credentials"
                  : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg text-center">
      <div className="mb-8">
        {session?.user?.image ? (
          <img
            src={session.user.image}
            alt="Your avatar"
            className="mx-auto h-20 w-20 rounded-full border-4 border-gray-700"
          />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-gray-700 bg-indigo-600 text-3xl font-bold text-white">
            {(session?.user?.name ?? session?.user?.email ?? "U").charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="mt-4 text-4xl font-bold text-white">
          Welcome, {session?.user?.name ?? session?.user?.email}!
        </h1>
        <p className="mt-2 text-lg text-gray-400">How would you like to play?</p>
      </div>

      <div className="space-y-4">
        <Link href="/lobby/public" className="block rounded-lg bg-green-600 p-6 text-xl font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-100">
          Play Online (Public)
        </Link>
        <Link href="/lobby/private" className="block rounded-lg bg-blue-600 p-6 text-xl font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-100">
          Play with a Friend (Private)
        </Link>
      </div>
      <button onClick={() => signOut()} className="mt-8 text-gray-400 transition hover:text-white">Sign Out</button>
    </div>
  );
}

export default function HubPageWrapper() {
  return (
    <SessionProvider>
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
        <MainPage />
      </div>
    </SessionProvider>
  );
}
