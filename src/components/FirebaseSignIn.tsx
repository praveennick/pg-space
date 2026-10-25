import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Building2, LockKeyhole } from "lucide-react";
import { cloudAuth } from "../data/firebase";
import { normalizeAccessEmail } from "../auth/members";
import { Button, Field } from "./ui";
import { requestAccountEmail } from "../services/accountEmail";

type Mode = "signin" | "setup" | "reset";

export function FirebaseSignIn() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const changeMode = (next: Mode) => {
    setMode(next);
    setPassword("");
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
      if (mode !== "signin") {
        setMessage(await requestAccountEmail(address, mode));
      } else {
        await signInWithEmailAndPassword(cloudAuth, address, password);
      }
    } catch (cause) {
      const code = (cause as { code?: string }).code;
      setError(
        code === "auth/weak-password" ||
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
            ? "Get your password link"
            : mode === "reset"
              ? "Reset your password"
              : "Sign in to PG Space"}
        </h1>
        <p>
          {mode === "setup"
            ? "Enter the email your PG owner added. If your access is active, you can choose your password through the emailed link."
            : mode === "reset"
              ? "Request a password link. Resetting a password cannot restore removed PG access."
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
        {mode === "signin" && (
          <Field label="Password">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
              ? "Send password link"
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
