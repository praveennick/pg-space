import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { User } from "firebase/auth";
import { FirebaseSignIn } from "../src/components/FirebaseSignIn";
import { VerifyEmail } from "../src/components/VerifyEmail";

const api = vi.hoisted(() => ({
  auth: {},
  create: vi.fn(),
  signin: vi.fn(),
  reset: vi.fn(),
  verify: vi.fn(),
  signout: vi.fn(),
  link: vi.fn(),
}));
vi.mock("../src/services/accountEmail", () => ({
  requestAccountEmail: api.link,
}));
vi.mock("../src/data/firebase", () => ({ cloudAuth: api.auth, cloudDb: null }));
vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: api.create,
  signInWithEmailAndPassword: api.signin,
  sendPasswordResetEmail: api.reset,
  sendEmailVerification: api.verify,
  signOut: api.signout,
}));
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  api.create.mockResolvedValue({});
  api.signin.mockResolvedValue({});
  api.reset.mockResolvedValue(undefined);
  api.verify.mockResolvedValue(undefined);
  api.link.mockResolvedValue(
    "If this email has active PG access, a password link will be sent. A password reset does not restore removed PG access.",
  );
});
afterEach(cleanup);

function fillSetup() {
  fireEvent.click(
    screen.getByRole("button", { name: "First time? Set password" }),
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "Person@Example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send password link" }));
}

describe("email and password onboarding", () => {
  it("requests invitation-only setup without public signup or accepting passwords", async () => {
    render(<FirebaseSignIn />);
    fillSetup();
    await waitFor(() =>
      expect(api.link).toHaveBeenCalledWith("person@example.com", "setup"),
    );
    expect(api.create).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(api.signin).not.toHaveBeenCalled();
  });
  it("shows the same generic setup response without exposing account existence", async () => {
    render(<FirebaseSignIn />);
    fillSetup();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "active PG access",
    );
    expect(api.create).not.toHaveBeenCalled();
  });
  it("reports an unavailable setup service without falling back to public signup", async () => {
    api.link.mockRejectedValueOnce(new Error("Setup service unavailable"));
    render(<FirebaseSignIn />);
    fillSetup();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Setup service unavailable",
    );
    expect(sessionStorage.getItem("pg-verify-after-setup")).toBeNull();
  });
  it("provides an email password reset without asking for a user ID", async () => {
    render(<FirebaseSignIn />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() =>
      expect(api.link).toHaveBeenCalledWith("person@example.com", "reset"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "does not restore removed PG access",
    );
    expect(api.reset).not.toHaveBeenCalled();
  });
  it("sends the verification link after first password setup", async () => {
    sessionStorage.setItem("pg-verify-after-setup", "person@example.com");
    const user = { email: "person@example.com" } as User;
    render(<VerifyEmail user={user} />);
    await waitFor(() => expect(api.verify).toHaveBeenCalledWith(user));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Verification email sent",
    );
  });
  it("does not continue until the email is verified", async () => {
    const user = {
      email: "person@example.com",
      emailVerified: false,
      reload: vi.fn().mockResolvedValue(undefined),
      getIdToken: vi.fn(),
    };
    render(<VerifyEmail user={user as unknown as User} />);
    fireEvent.click(
      screen.getByRole("button", { name: /I verified my email/ }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "not verified yet",
    );
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
  it("refreshes the trusted auth token after verification", async () => {
    const user = {
      email: "person@example.com",
      emailVerified: true,
      reload: vi.fn().mockResolvedValue(undefined),
      getIdToken: vi.fn().mockResolvedValue("test-token"),
    };
    render(<VerifyEmail user={user as unknown as User} />);
    fireEvent.click(
      screen.getByRole("button", { name: /I verified my email/ }),
    );
    await waitFor(() => expect(user.getIdToken).toHaveBeenCalledWith(true));
  });
});
