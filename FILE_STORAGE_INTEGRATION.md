# Resident photos and private files

## Phase 1: local development

The app uses `LocalFileStorageService` by default. It stores **profile photos only** as blobs in the browser's IndexedDB. Registration and editing work on localhost without Firebase or Supabase credentials. Camera capture requires HTTPS or localhost; an HTTP address using a LAN IP cannot use `getUserMedia` in most browsers. Upload Photo remains available there.

JPEG, PNG and WebP uploads are checked against their file signatures, limited to 10 MB, resized to at most 800 px on the longest side, and re-encoded as JPEG without cropping or filters. The local adapter accepts only the prepared JPEG under 500 KB. Photo object URLs are temporary and revoked when their previews unmount. Camera tracks stop when the capture dialog closes or a photo is taken.

Identity document **files are disabled** in local mode. The `FileStorageService` document methods deliberately return an error until a protected backend is configured. Staff may record verification status, method, date and staff name; the UI does not collect document numbers. Aadhaar can be recorded as "checked in person", but must not be required. Local browser data has no account-based access control and is for fictional/test records only.

The Settings JSON backup includes resident photo _metadata_, not image bytes. Importing a backup or resetting demo data clears local photo blobs. A restored resident therefore displays initials until a photo is uploaded again.

## Phase 2: authenticated cloud deployment

Use Firebase Authentication for owner and staff identity, and Cloud Firestore for tenant records, verification metadata, private object keys, ownership scope and audit events. Choose `TrustedFileStorageService` at the composition root only after a trusted file gateway exists; inject a function that returns the current Firebase ID token. The frontend sends that token to the gateway and never holds a Supabase service-role key. `TrustedFileStorageService` is a browser client for the gateway contract, not a public Supabase client.

The trusted gateway must, for **every** method:

1. Verify the Firebase ID token server-side with Firebase Admin SDK, then look up active property membership and a role allowed to read or change this tenant's files. Do not trust tenant IDs, roles, or property IDs from the browser.
2. Resolve the tenant's property and owner from Firestore. Construct opaque, server-owned object keys such as `property/{propertyId}/tenant/{tenantId}/photo/{randomId}`. Never accept a client-supplied path for an upload or deletion.
3. Enforce a private Supabase bucket, MIME allowlist, actual file-signature validation, byte and pixel limits, and a malware scan where appropriate. Profile photos are JPEG/PNG/WebP inputs; approved document types are driving licence, voter ID, passport and other specifically approved IDs. Do not implement unrestricted Aadhaar uploads.
4. Use the Supabase service-role key only on the trusted server. Return image bytes through authorized requests or issue short-lived read URLs after authorization. Never place a public object URL in Firestore or expose the private bucket for anonymous reads.
5. Record access, upload, replacement and deletion events with actor, tenant, property, time and object key. Apply retention/deletion policy, including deletion when a resident record is removed and removal of replaced objects. Do not log file contents or ID numbers.
6. Store only metadata and private object keys in Firestore. Apply Firestore rules that restrict tenant metadata to authorized property staff and deny direct client writes to privileged verification/audit fields. Use server-side checks for file actions even when Firestore rules exist.

Suggested gateway routes used by `TrustedFileStorageService`:

| Method             | Path                                     | Result                                |
| ------------------ | ---------------------------------------- | ------------------------------------- |
| PUT / GET / DELETE | `/tenants/{id}/photo`                    | `StoredFile`, image bytes/204, or 204 |
| PUT                | `/tenants/{id}/documents/{approvedType}` | `StoredFile`                          |
| GET / DELETE       | `/tenants/{id}/documents/{opaqueKey}`    | file bytes/204 or 204                 |

The gateway needs an authenticated deployment and property membership model before these routes can be enabled. No cloud credentials or server endpoints are configured in this repository, so Phase 2 file operations are not live.

References: [Firebase Auth and Firestore rules](https://firebase.google.com/docs/rules/rules-and-auth), [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Supabase RLS](https://supabase.com/docs/guides/storage/security/access-control), [UIDAI verification guidance](https://uidai.gov.in/images/pressrelease/Press_Release_10.1.23.pdf).
