"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "./auth-provider";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { login, register, initializationError, isInitializing } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      router.replace("/trips");
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "We couldn't reach SplitTrip. Check that the API is running and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link aria-label="SplitTrip home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            <span />
            <span />
          </span>
          <span>
            split<span className="brand-light">trip</span>
          </span>
        </Link>
        <Link className="auth-back-link" href="/">
          Back to home
        </Link>
      </header>

      <main className="auth-layout">
        <section className="auth-aside">
          <span className="auth-aside-label">
            {isRegister
              ? "YOUR NEXT TRIP STARTS HERE"
              : "GOOD TO HAVE YOU BACK"}
          </span>
          <h1>
            {isRegister ? (
              <>
                Make room
                <br />
                for more
                <br />
                <span>memories.</span>
              </>
            ) : (
              <>
                Your people.
                <br />
                Your plans.
                <br />
                <span>All in sync.</span>
              </>
            )}
          </h1>
          <p>
            Shared plans, clear expenses, and fewer awkward “who owes who?”
            messages.
          </p>
          <div className="auth-aside-decoration" aria-hidden="true">
            <span>✳</span>
            <span>↗</span>
            <span>✓</span>
          </div>
        </section>

        <section aria-labelledby="auth-title" className="auth-card">
          <div className="auth-card-heading">
            <p className="section-kicker">
              {isRegister
                ? "LET'S GET YOU STARTED"
                : "PICK UP WHERE YOU LEFT OFF"}
            </p>
            <h2 id="auth-title">
              {isRegister ? "Create your account" : "Welcome back"}
            </h2>
            <p>
              {isRegister
                ? "One account. Every trip with your crew."
                : "Sign in to get back to your trips."}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input
              autoComplete="email"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />

            <div className="password-label-row">
              <label htmlFor="password">Password</label>
              {isRegister && <span>At least 12 characters</span>}
            </div>
            <input
              autoComplete={isRegister ? "new-password" : "current-password"}
              id="password"
              maxLength={128}
              minLength={isRegister ? 12 : undefined}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                isRegister ? "Create a strong password" : "Enter your password"
              }
              required
              type="password"
              value={password}
            />

            {(error || (!isInitializing && initializationError)) && (
              <p className="auth-error" role="alert">
                {error || initializationError}
              </p>
            )}

            <button
              className="auth-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : "Sign in"}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? "Already have an account?" : "New here?"}{" "}
            <Link href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="auth-privacy">
            Your password is securely hashed and never shared with your group.
          </p>
        </section>
      </main>
    </div>
  );
}
