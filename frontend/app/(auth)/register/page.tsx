"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Mail, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui-primitives";
import { useToast } from "@/components/providers";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();

  const [step, setStep] = useState<"register" | "verify">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP Verification state
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const existingToken = window.localStorage.getItem("instantly_token");
      if (existingToken) {
        router.replace("/overview");
      }
    }
  }, [router]);

  useEffect(() => {
    const stepParam = searchParams.get("step");
    const emailParam = searchParams.get("email");
    if (stepParam === "verify" && emailParam) {
      setStep("verify");
      setEmail(emailParam);
      setResendCooldown(45);
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
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
      if (res.debug_otp) {
        setDebugOtp(res.debug_otp);
      }
      setStep("verify");
      setResendCooldown(60);
      notify("Verification code sent", `We sent a 6-digit code to ${email.trim()}.`);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, "");
    if (!cleanValue) {
      const nextOtp = [...otp];
      nextOtp[index] = "";
      setOtp(nextOtp);
      return;
    }

    // Single digit input
    const char = cleanValue.slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = char;
    setOtp(nextOtp);

    // Auto-advance
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;

    const nextOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      nextOtp[i] = pastedData[i] || "";
    }
    setOtp(nextOtp);
    const targetIdx = Math.min(pastedData.length, 5);
    inputRefs.current[targetIdx]?.focus();
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const codeString = otp.join("");
    if (codeString.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyOTP(email.trim(), codeString);
      window.localStorage.setItem("instantly_token", res.access_token);
      notify("Email verified!", `Welcome to Instantly, ${res.user.full_name}.`);
      router.push("/overview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    try {
      const res = await api.resendOTP(email.trim());
      if (res.debug_otp) {
        setDebugOtp(res.debug_otp);
      }
      setResendCooldown(60);
      notify("Code resent", `A new 6-digit code has been dispatched to ${email.trim()}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setIsResending(false);
    }
  };

  const handleAutoFillDebug = () => {
    if (!debugOtp || debugOtp.length !== 6) return;
    const digits = debugOtp.split("");
    setOtp(digits);
    inputRefs.current[5]?.focus();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col justify-center items-center p-6">
      <div className="animate-page-in w-full max-w-[420px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" aria-label="Back to home">
            <Logo />
          </Link>
          {step === "verify" && (
            <button
              onClick={() => {
                setStep("register");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          )}
        </div>

        {step === "register" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Create account
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1 mb-6">
              Your real unified workspace for Gmail & Slack.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="register-name"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                >
                  Full name
                </label>
                <input
                  id="register-name"
                  type="text"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Lina Ishimwe"
                  data-testid="register-name-input"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="register-email"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                >
                  Email address
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
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                  Verify your email
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">
                  Security verification for account access
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-5">
              We sent a 6-digit confirmation code to{" "}
              <strong className="text-[var(--text-primary)] font-medium">{email}</strong>.
              Enter the code below to activate your workspace.
            </p>

            {debugOtp && (
              <div className="mb-5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs text-indigo-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>
                    Dev Code: <strong className="font-mono text-white tracking-wider text-sm">{debugOtp}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoFillDebug}
                  className="px-2.5 py-1 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-[11px] font-medium transition-colors"
                >
                  Auto-fill
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    className="w-12 h-13 text-center text-xl font-bold font-mono rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:outline-none transition-all"
                  />
                ))}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                shimmer
                loading={loading}
                disabled={otp.join("").length !== 6}
                className="w-full"
              >
                Verify & access workspace
              </Button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-2 pt-4 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
              <div>
                Didn&apos;t receive the email?{" "}
                {resendCooldown > 0 ? (
                  <span className="text-[var(--text-muted)] font-mono">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-[var(--accent-soft)] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
                    Resend code
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("register");
                  setError(null);
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-1"
              >
                Change email address
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-xs text-[var(--text-muted)]">
          Loading registration...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
