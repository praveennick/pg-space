import type {
  AuthorizedDocumentType,
  FileStorageService,
  StoredFile,
} from "./fileStorage";

/** Browser client for a trusted gateway that verifies Firebase ID tokens server-side. */
export class TrustedFileStorageService implements FileStorageService {
  private readonly baseUrl: string;
  private readonly getFirebaseIdToken: () => Promise<string>;
  constructor(baseUrl: string, getFirebaseIdToken: () => Promise<string>) {
    this.baseUrl = baseUrl;
    this.getFirebaseIdToken = getFirebaseIdToken;
  }

  private async request(
    path: string,
    method = "GET",
    body?: Blob,
  ): Promise<Response> {
    const token = await this.getFirebaseIdToken();
    if (!token) throw new Error("Sign in before opening resident files.");
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": body.type } : {}),
      },
      body,
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok)
      throw new Error(`File request failed (${response.status}).`);
    return response;
  }

  private path(tenantId: string, suffix: string) {
    return `/tenants/${encodeURIComponent(tenantId)}/${suffix}`;
  }

  async saveTenantPhoto(tenantId: string, file: Blob): Promise<StoredFile> {
    return (
      await this.request(this.path(tenantId, "photo"), "PUT", file)
    ).json() as Promise<StoredFile>;
  }
  async getTenantPhoto(tenantId: string): Promise<Blob | null> {
    const response = await this.request(this.path(tenantId, "photo"));
    return response.status === 204 ? null : response.blob();
  }
  async deleteTenantPhoto(tenantId: string): Promise<void> {
    await this.request(this.path(tenantId, "photo"), "DELETE");
  }
  async saveAuthorizedDocument(
    tenantId: string,
    type: AuthorizedDocumentType,
    file: Blob,
  ): Promise<StoredFile> {
    return (
      await this.request(this.path(tenantId, `documents/${type}`), "PUT", file)
    ).json() as Promise<StoredFile>;
  }
  async getAuthorizedDocument(
    tenantId: string,
    key: string,
  ): Promise<Blob | null> {
    const response = await this.request(
      this.path(tenantId, `documents/${encodeURIComponent(key)}`),
    );
    return response.status === 204 ? null : response.blob();
  }
  async deleteAuthorizedDocument(tenantId: string, key: string): Promise<void> {
    await this.request(
      this.path(tenantId, `documents/${encodeURIComponent(key)}`),
      "DELETE",
    );
  }
}
