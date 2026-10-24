import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Building2, LockKeyhole } from "lucide-react";
import { cloudAuth } from "../data/firebase";
import { Button, Field } from "./ui";

export function FirebaseSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cloudAuth) return;
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(cloudAuth, email.trim(), password);
    } catch {
      setError(
        "Could not sign in. Check your email and password, or ask the account owner for access.",
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
        <h1>Sign in to PG Space</h1>
        <p>Open the PG records saved in your Firebase account.</p>
        <Field label="Email address">
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" className="warning-text">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          <LockKeyhole size={17} /> {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
