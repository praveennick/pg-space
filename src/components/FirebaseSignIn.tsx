import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Building2, LockKeyhole } from "lucide-react";
import { cloudAuth } from "../data/firebase";
import { normalizeAccessEmail } from "../auth/members";
import { Button, Field } from "./ui";

type Mode = "signin" | "setup" | "reset";

export function FirebaseSignIn() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const changeMode = (next: Mode) => {
    setMode(next);
    setPassword("");
    setConfirm("");
    setError("");
    setMessage("");
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cloudAuth) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const address = normalizeAccessEmail(email);
      if (mode === "reset") {
        await sendPasswordResetEmail(cloudAuth, address);
        setMessage(
          "If this email has an account, a password reset link has been sent. Check your inbox and spam folder.",
        );
      } else if (mode === "setup") {
        if (password !== confirm)
          throw new Error("The two passwords do not match.");
        sessionStorage.setItem("pg-verify-after-setup", address);
        try {
          await createUserWithEmailAndPassword(cloudAuth, address, password);
        } catch (cause) {
          sessionStorage.removeItem("pg-verify-after-setup");
          throw cause;
        }
      } else {
        await signInWithEmailAndPassword(cloudAuth, address, password);
      }
    } catch (cause) {
      const code = (cause as { code?: string }).code;
      setError(
        code === "auth/email-already-in-use"
          ? "This email already has a password. Sign in or choose Forgot password."
          : code === "auth/weak-password" ||
              code === "auth/password-does-not-meet-requirements"
            ? "Choose a stronger password that meets the account's password requirements."
            : code === "auth/too-many-requests"
              ? "Too many attempts. Please wait and try again."
              : code === "auth/operation-not-allowed"
                ? "Email and password sign-in needs to be enabled by the app owner."
                : code?.startsWith("auth/")
                  ? "Could not continue. Check your details and try again."
                  : (cause as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="firebase-signin">
      <form className="panel firebase-signin-card" onSubmit={submit}>
        <span className="brand-mark">
          <Building2 size={25} />
        </span>
        <h1>
          {mode === "setup"
            ? "Set your password"
            : mode === "reset"
              ? "Reset your password"
              : "Sign in to PG Space"}
        </h1>
        <p>
          {mode === "setup"
            ? "Use the email your PG owner added. Set your password, then verify your email to continue."
            : mode === "reset"
              ? "We'll send a link so you can choose a new password."
              : "Use your email and password. Your PG opens automatically."}
        </p>
        <Field label="Email address">
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        {mode !== "reset" && (
          <Field
            label={
              mode === "setup"
                ? "New password (at least 8 characters)"
                : "Password"
            }
          >
            <input
              type="password"
              required
              minLength={mode === "setup" ? 8 : undefined}
              autoComplete={
                mode === "setup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        )}
        {mode === "setup" && (
          <Field label="Confirm password">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
        )}
        {error && (
          <p role="alert" className="warning-text">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <Button type="submit" disabled={busy}>
          <LockKeyhole size={17} />
          {busy
            ? "Please wait…"
            : mode === "setup"
              ? "Set password & continue"
              : mode === "reset"
                ? "Send reset link"
                : "Sign in"}
        </Button>
        {mode === "signin" ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => changeMode("setup")}
            >
              First time? Set password
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => changeMode("reset")}
            >
              Forgot password?
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => changeMode("signin")}
          >
            Back to sign in
          </Button>
        )}
      </form>
    </main>
  );
}
