import { afterEach, expect, it, vi } from "vitest";
import { inviteTenantLogin } from "../src/services/tenantLogin";

vi.mock("../src/data/firebase", () => ({
  firebaseMode: true,
  cloudAuth: { currentUser: { getIdToken: async () => "test-token" } },
}));
afterEach(() => vi.unstubAllGlobals());

it("reports a crashed deployed function rather than saying the app is not deployed", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("Function failed", {
          status: 502,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
  );
  await expect(inviteTenantLogin("owner", "resident")).rejects.toThrow(
    "HTTP 502",
  );
});
it("identifies the SPA fallback separately from a function response", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("<html></html>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
  );
  await expect(inviteTenantLogin("owner", "resident")).rejects.toThrow(
    "returned a web page",
  );
});
