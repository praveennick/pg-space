import { createContext, useContext } from "react";
import type { EditorState } from "../components/Editors";

export type Role = "super_admin" | "admin" | "staff" | "tenant";

export type WorkspaceAccess = {
  uid: string;
  ownerUid: string;
  role: Role;
  tenantId?: string;
};

export const AccessContext = createContext<WorkspaceAccess | null>(null);

export function useAccess(): WorkspaceAccess {
  const access = useContext(AccessContext);
  if (!access) throw new Error("Workspace access is unavailable.");
  return access;
}

const staffPages = new Set([
  "rooms",
  "tenants",
  "reservations",
  "maintenance",
  "payments",
]);

export function canAccessPage(role: Role, page: string): boolean {
  if (role === "super_admin") return true;
  if (role === "admin") return page !== "team";
  if (role === "staff") return staffPages.has(page);
  return page === "my-account";
}

export function landingPage(role: Role): string {
  return role === "staff"
    ? "/app/rooms"
    : role === "tenant"
      ? "/app/my-account"
      : "/app/dashboard";
}

export function canOpenEditor(role: Role, editor: EditorState): boolean {
  if (role === "super_admin" || role === "admin") return true;
  if (role !== "staff") return false;
  if (editor.kind === "tenant") return Boolean(editor.id);
  return [
    "room",
    "bed",
    "reservation",
    "ticket",
    "transfer",
    "checkout",
    "payment",
    "allocate",
  ].includes(editor.kind);
}
