"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui-primitives";
import { useToast } from "@/components/providers";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();

  const nextUrl = searchParams.get("next") || "/overview";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const existingToken = window.localStorage.getItem("instantly_token");
      if (existingToken) {
        router.replace("/overview");
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email.trim(), password);
      window.localStorage.setItem("instantly_token", res.access_token);
      notify("Welcome back", `Signed in as ${res.user.full_name}.`);
      router.push(nextUrl.startsWith("/") ? nextUrl : "/overview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleEnterDemo = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const res = await api.startDemoSession();
      window.localStorage.setItem("instantly_token", res.access_token);
      notify("Demo ready", "Exploring sample workspace.");
      router.push(nextUrl.startsWith("/") ? nextUrl : "/overview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not open demo.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col justify-center items-center p-6">
      <div className="animate-page-in w-full max-w-[400px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 shadow-card">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="Back to home">
            <Logo />
          </Link>
        </div>

        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Sign in to your workspace
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1 mb-6">
          Your inbox, sorted for you.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-3.5 pr-10 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            shimmer
            loading={loading}
            data-testid="login-submit-button"
            className="w-full mt-2"
          >
            Log in
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          <span className="text-xs text-[var(--text-muted)]">or</span>
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          loading={demoLoading}
          onClick={handleEnterDemo}
          data-testid="enter-demo-workspace-button"
          className="w-full"
        >
          Try demo workspace
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>

        <div className="mt-6 text-center text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-subtle)]">
          New here?{" "}
          <Link
            href="/register"
            className="text-[var(--accent-soft)] hover:underline"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-base)]" />}>
      <LoginForm />
    </Suspense>
  );
}
