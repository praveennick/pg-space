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
});
afterEach(cleanup);

function fillSetup(password = "TestPassword123", confirm = password) {
  fireEvent.click(
    screen.getByRole("button", { name: "First time? Set password" }),
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "Person@Example.com" },
  });
  fireEvent.change(
    screen.getByLabelText("New password (at least 8 characters)"),
    { target: { value: password } },
  );
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: confirm },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Set password & continue" }),
  );
}

describe("email and password onboarding", () => {
  it("creates the user's own password using their normalized email", async () => {
    render(<FirebaseSignIn />);
    fillSetup();
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        api.auth,
        "person@example.com",
        "TestPassword123",
      ),
    );
    expect(sessionStorage.getItem("pg-verify-after-setup")).toBe(
      "person@example.com",
    );
    expect(api.signin).not.toHaveBeenCalled();
  });
  it("requires matching passwords before creating an account", async () => {
    render(<FirebaseSignIn />);
    fillSetup("TestPassword123", "Different123");
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(api.create).not.toHaveBeenCalled();
  });
  it("directs an existing account to sign-in or password reset", async () => {
    api.create.mockRejectedValueOnce({ code: "auth/email-already-in-use" });
    render(<FirebaseSignIn />);
    fillSetup();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already has a password",
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
      expect(api.reset).toHaveBeenCalledWith(api.auth, "person@example.com"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "password reset link",
    );
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
