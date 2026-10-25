import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  writeBatch,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { z } from "zod/v4";
import { cloudAuth, cloudDb } from "../data/firebase";
import type { Tenant } from "../domain/models";
import type { Role, WorkspaceAccess } from "./access";
import { accountAction } from "../services/accountActions";

export type Member = {
  email: string;
  role: Role;
  tenantId: string;
  label: string;
  ownerUid: string;
  workspaceName: string;
  revoked?: boolean;
};

export function normalizeAccessEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (
    !z.email().safeParse(email).success ||
    email.includes("/") ||
    email.length > 254
  )
    throw new Error("Enter a valid email address.");
  return email;
}

const database = () => {
  if (!cloudDb) throw new Error("Firebase is not configured.");
  return cloudDb;
};
const memberRef = (email: string) =>
  doc(database(), "emailAccess", normalizeAccessEmail(email));

export function parseMember(value: Record<string, unknown>): Member | null {
  if (!["super_admin", "admin", "staff", "tenant"].includes(String(value.role)))
    return null;
  if (
    ["email", "tenantId", "label", "ownerUid", "workspaceName"].some(
      (key) => typeof value[key] !== "string",
    )
  )
    return null;
  if (!value.ownerUid || (value.role === "tenant" && !value.tenantId))
    return null;
  return value as Member;
}

export function watchEmailAccess(
  uid: string,
  email: string,
  changed: (access: WorkspaceAccess | null) => void,
  failed: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    memberRef(email),
    (snapshot) => {
      const member = snapshot.exists() ? parseMember(snapshot.data()) : null;
      changed(
        member && !member.revoked
          ? {
              uid,
              ownerUid: member.ownerUid,
              role: member.role,
              tenantId: member.tenantId,
            }
          : null,
      );
    },
    failed,
  );
}

export async function listMembers(ownerUid: string): Promise<Member[]> {
  const snapshot = await getDocs(
    query(
      collection(database(), "emailAccess"),
      where("ownerUid", "==", ownerUid),
    ),
  );
  return snapshot.docs
    .map((item) => parseMember(item.data()))
    .filter((item): item is Member => Boolean(item));
}

export async function saveMember(
  ownerUid: string,
  workspaceName: string,
  input: Pick<Member, "email" | "label" | "role" | "tenantId">,
  tenant?: Tenant,
) {
  const email = normalizeAccessEmail(input.email);
  if (email === cloudAuth?.currentUser?.email?.toLowerCase())
    throw new Error(
      "Use another person's email. Your own access is already active.",
    );
  if (input.role === "tenant" && tenant?.id !== input.tenantId)
    throw new Error("Choose a saved resident for this account.");
  const batch = writeBatch(database());
  batch.set(memberRef(email), {
    email,
    ownerUid,
    workspaceName,
    role: input.role,
    tenantId: input.role === "tenant" ? input.tenantId : "",
    label: input.label.trim().slice(0, 100),
  });
  if (input.role === "tenant" && tenant)
    batch.set(doc(database(), "accounts", ownerUid, "portal", tenant.id), {
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email,
      occupation: tenant.occupation,
    });
  await batch.commit();
}

export async function removeMember(ownerUid: string, email: string) {
  if (
    normalizeAccessEmail(email) === cloudAuth?.currentUser?.email?.toLowerCase()
  )
    throw new Error("Ask another super admin to change your access.");
  await accountAction({
    action: "remove",
    ownerUid,
    email: normalizeAccessEmail(email),
  });
}

export function accessErrorMessage(error: unknown): string {
  if ((error as { code?: string }).code === "permission-denied")
    return "Access settings could not be opened. The owner needs to publish the updated Firebase access rules.";
  return error instanceof Error
    ? error.message
    : "Unable to update access. Please try again.";
}
