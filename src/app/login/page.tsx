"use client";

import { useActionState, useState } from "react";
import { Logo } from "@/components/Logo";
import { signIn, signUp, type AuthActionState } from "./actions";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, formAction, pending] = useActionState(
    mode === "signin" ? signIn : signUp,
    initialState
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 flex justify-center">
          <Logo className="h-14 w-auto" />
        </div>

        <h1 className="mb-1 text-center text-lg font-bold text-navy">
          {mode === "signin" ? "Sign in to your dashboard" : "Create an account"}
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-500">
          Amazon seller audits, built for agencies.
        </p>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy-light">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green focus:ring-1 focus:ring-green"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy-light">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green focus:ring-1 focus:ring-green"
            />
          </div>

          {state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-green px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-dark disabled:opacity-60"
          >
            {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-xs text-neutral-500 hover:text-navy"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
