import { useEffect, useState } from "react";
import { sendEmailVerification, signOut, type User } from "firebase/auth";
import { MailCheck } from "lucide-react";
import { cloudAuth } from "../data/firebase";
import { Button } from "./ui";

export function VerifyEmail({ user }: { user: User }) {
  const [busy, setBusy] = useState(
    () =>
      sessionStorage.getItem("pg-verify-after-setup") ===
      user.email?.toLowerCase(),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (
      sessionStorage.getItem("pg-verify-after-setup") !==
      user.email?.toLowerCase()
    )
      return;
    sessionStorage.removeItem("pg-verify-after-setup");
    void sendEmailVerification(user)
      .then(() =>
        setMessage(
          "Verification email sent. Check your inbox and spam folder.",
        ),
      )
      .catch(() =>
        setError(
          "Could not send the verification email. Use the button below to try again.",
        ),
      )
      .finally(() => setBusy(false));
  }, [user]);
  return (
    <main className="firebase-signin">
      <div className="panel firebase-signin-card">
        <span className="brand-mark">
          <MailCheck size={25} />
        </span>
        <h1>Verify your email</h1>
        <p>
          Open the verification link sent to <strong>{user.email}</strong>, then
          come back here to continue.
        </p>
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="warning-text">
            {error}
          </p>
        )}
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            setMessage("");
            try {
              await user.reload();
              if (!user.emailVerified) {
                setMessage(
                  "Your email is not verified yet. Open the link in your inbox first.",
                );
                return;
              }
              await user.getIdToken(true);
            } catch {
              setError("Could not check your email. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          I verified my email — continue
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await sendEmailVerification(user);
              setMessage(
                "Verification email sent. Check your inbox and spam folder.",
              );
            } catch {
              setError(
                "Could not send the email. Please wait a moment and try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Send verification email
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => cloudAuth && void signOut(cloudAuth)}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
