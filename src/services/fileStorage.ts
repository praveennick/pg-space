import { localStore } from "../data";
import { detectedImageType } from "./profilePhoto";

export type StoredFile = {
  key: string;
  mimeType: string;
  size: number;
  updatedAt: string;
};

export type AuthorizedDocumentType =
  "driving-licence" | "voter-id" | "passport" | "other-approved-id";

export interface FileStorageService {
  saveTenantPhoto(tenantId: string, file: Blob): Promise<StoredFile>;
  getTenantPhoto(tenantId: string): Promise<Blob | null>;
  deleteTenantPhoto(tenantId: string): Promise<void>;
  saveAuthorizedDocument(
    tenantId: string,
    type: AuthorizedDocumentType,
    file: Blob,
  ): Promise<StoredFile>;
  getAuthorizedDocument(tenantId: string, key: string): Promise<Blob | null>;
  deleteAuthorizedDocument(tenantId: string, key: string): Promise<void>;
}

type LocalPhoto = {
  tenantId: string;
  blob: Blob;
  mimeType: string;
  updatedAt: string;
};

const documentsUnavailable = (): never => {
  throw new Error(
    "Identity document files need staff sign-in and private storage. Record verification details only in this local demo.",
  );
};

export class LocalFileStorageService implements FileStorageService {
  async saveTenantPhoto(tenantId: string, file: Blob): Promise<StoredFile> {
    if (
      !tenantId ||
      file.type !== "image/jpeg" ||
      file.size > 500_000 ||
      !file.size ||
      (await detectedImageType(file)) !== "image/jpeg"
    )
      throw new Error("Please choose a valid profile photo.");
    const updatedAt = new Date().toISOString();
    await localStore.db
      .table<LocalPhoto>("tenantPhotos")
      .put({ tenantId, blob: file, mimeType: file.type, updatedAt });
    return {
      key: `tenant-photos/${tenantId}`,
      mimeType: file.type,
      size: file.size,
      updatedAt,
    };
  }

  async getTenantPhoto(tenantId: string): Promise<Blob | null> {
    return (
      (await localStore.db.table<LocalPhoto>("tenantPhotos").get(tenantId))
        ?.blob ?? null
    );
  }

  async deleteTenantPhoto(tenantId: string): Promise<void> {
    await localStore.db.table("tenantPhotos").delete(tenantId);
  }

  async saveAuthorizedDocument(): Promise<StoredFile> {
    return documentsUnavailable();
  }

  async getAuthorizedDocument(): Promise<Blob | null> {
    return documentsUnavailable();
  }

  async deleteAuthorizedDocument(): Promise<void> {
    return documentsUnavailable();
  }
}

export let fileStorage: FileStorageService = new LocalFileStorageService();

export function configureFileStorage(service: FileStorageService) {
  fileStorage = service;
}
