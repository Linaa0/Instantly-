"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui-primitives";
import { useToast } from "@/components/providers";

export default function RegisterPage() {
  const router = useRouter();
  const { notify } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const existingToken = window.localStorage.getItem("instantly_token");
      if (existingToken) {
        router.replace("/overview");
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.register(email.trim(), fullName.trim(), password);
      window.localStorage.setItem("instantly_token", res.access_token);
      notify("Welcome", `Account created for ${res.user.full_name}.`);
      router.push("/overview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setLoading(false);
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
          Create account
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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="register-name"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Name
            </label>
            <input
              id="register-name"
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              data-testid="register-name-input"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Email
            </label>
            <input
              id="register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              data-testid="register-email-input"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                data-testid="register-password-input"
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
            data-testid="register-submit-button"
            className="w-full mt-2"
          >
            Create account
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-subtle)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[var(--accent-soft)] hover:underline"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
