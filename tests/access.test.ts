import { describe, expect, it } from "vitest";
import { canAccessPage, canOpenEditor } from "../src/auth/access";
import { normalizeAccessEmail, parseMember } from "../src/auth/members";

describe("access assignments", () => {
  it("normalizes email addresses and rejects invalid document identities", () => {
    expect(normalizeAccessEmail("  Owner@Example.com  ")).toBe(
      "owner@example.com",
    );
    expect(() => normalizeAccessEmail("not-email")).toThrow();
    expect(() => normalizeAccessEmail("person/other@example.com")).toThrow();
  });
  it("accepts an additional super admin while rejecting invalid roles and unlinked tenants", () => {
    const member = {
      email: "owner@example.com",
      role: "super_admin",
      tenantId: "",
      label: "Owner",
      ownerUid: "pg-owner",
      workspaceName: "My PG",
    };
    expect(parseMember(member)?.role).toBe("super_admin");
    expect(parseMember({ ...member, role: "unknown" })).toBeNull();
    expect(parseMember({ ...member, role: "tenant" })).toBeNull();
  });
  it("keeps staff and tenant navigation limited", () => {
    expect(canAccessPage("super_admin", "team")).toBe(true);
    expect(canAccessPage("admin", "team")).toBe(false);
    expect(canAccessPage("staff", "rooms")).toBe(true);
    expect(canAccessPage("staff", "payments")).toBe(false);
    expect(canAccessPage("tenant", "tenants")).toBe(false);
    expect(canAccessPage("tenant", "my-account")).toBe(true);
    expect(canOpenEditor("staff", { kind: "payment" })).toBe(false);
    expect(canOpenEditor("tenant", { kind: "tenant", id: "own-profile" })).toBe(
      false,
    );
  });
});
