# Firebase integration plan (Phase 2, not connected)

The current app runs entirely in IndexedDB. Keep it runnable without credentials while introducing a separate opt-in Firebase environment. Do not install a fake Firestore implementation or automatically migrate local data.

## Boundary and migration approach

Keep domain schemas/calculations and page-facing application commands. Implement typed entity repositories from `src/data/contracts.ts` and select an adapter in the composition root. The local transaction callback currently works over an in-memory snapshot inside Dexie; do not translate it to a full Firestore download and rewrite. Introduce a command gateway for cross-entity operations (assign, transfer, checkout, invoice, payment, deposit settlement) with matching local and remote implementations. Remote implementations should invoke narrowly scoped callable functions where financial authorization or multi-document invariants demand trusted execution. React hooks retain the same feature-facing API; replace the Dexie subscription with authorized Firestore listeners/query invalidation.

## Authentication and authorization

Add Firebase Authentication email/password owner and staff accounts, authenticated routing, session recovery and sign-out. Provision membership through trusted administrative workflows. Use server-verified custom claims or secured property membership documents with role, property scope and explicit permissions. Rules must enforce membership and permissions, not merely `request.auth != null`. Never accept client role, computed bed status, payment status, or revenue totals as authority.

## Firestore model

Use `properties/{propertyId}` and property-scoped subcollections: `floors`, `rooms`, `beds`, `tenants`, `occupancies`, `reservations`, `invoices`, `invoiceLines`, `payments`, `paymentAllocations`, `depositTransactions`, `expenses`, `maintenanceTickets`, `notifications`, `auditLogs`, `settings`.

Subcollections keep property access boundaries clear and suit the current single-property queries. Cross-property reporting can use authorized collection-group queries later, including immutable property IDs on records. Preserve UUIDs and human labels separately. Convert date-only strings explicitly using the property's Asia/Kolkata calendar; use server timestamps for creation/audit times. Preserve integer paise amounts and invoice snapshots.

Plan composite indexes for floor + archived + room number, roomId + active beds, tenantId + start, bedId + active stay, status + expiry, month + due, tenantId + payment date, expense date + category, ticket status + priority. Use stable cursor pagination (`orderBy` and `startAfter`) rather than downloading the entire ledger. Firestore has no joins: maintain minimal authorized read projections or bounded related queries, with server-maintained aggregate views where useful.

## Critical commands

- Maintain a canonical allocation/lock record per bed. In a Firestore transaction, read and validate the lock, relevant occupancy/reservation/block records and membership before creating a stay. Revalidate capacity retirement and reservation conversion on the server.
- Generate invoices using deterministic property/tenant/billing-month uniqueness keys. Preserve invoice totals; support audited adjustments with distinct line items rather than rewriting paid history.
- Record payments with server-enforced idempotency keys, exact paise allocation totals, invoice ownership and balance checks. Record validated immutable events and audit records; use explicit reversal commands for corrections.
- Distinguish releasing physical occupancy from debt, booking-money and deposit settlement. Deposit deductions/refunds cannot exceed held funds. Do not count deposits or unallocated advances as rent.
- Use transactions for read-dependent invariants and batched writes for already-validated independent updates; do not assume relational transactions or cross-service atomicity. Schedule expiry/billing jobs with retry-safe keys.

## Private files and application protection

Use authenticated private Firebase Storage paths scoped by property and tenant/ticket IDs for future agreements, identity documents, receipt files and maintenance images. Apply Storage Rules for property membership, MIME/type allowlists, size limits, and write permissions. Validate uploaded content in trusted processing; use short-lived authorized downloads and a retention policy. Never expose a public bucket for tenant identity documents.

Add Firebase App Check where appropriate as abuse protection, not a replacement for authentication/rules. Keep secrets in managed server configuration. Firestore and Storage Rules should deny unapproved fields, unauthorized cross-property reads/writes, forged audit records and privileged direct client financial writes.

## Emulator-first development and deployment

Use Auth, Firestore, Storage and Functions emulators. Test owner/staff/unauthenticated roles, cross-property denial, transaction retries, duplicate payments, overpayments, simultaneous bed assignment, reservation conversion races, unsafe retirement, refunds and offline replay. Validate indexes in staging. Add structured monitoring, error alerts, restricted administrative access, scheduled backups, restore drills, retention and incident response before production.

## Explicit local-data import

1. The owner exports a versioned local JSON backup and opts in to migration.
2. Validate schema, IDs, relationships, monetary totals, active allocations, dates, settings and duplicate natural keys. Preview counts, conflicts and rejected records; never migrate fictional seed data implicitly.
3. Map property/floor/settings records and embedded invoice totals to the new schema. Preserve immutable UUIDs and paise amounts; tag a migration batch ID and source checksum.
4. Use a privileged migration tool with least privilege, dry-run mode, resumable checkpoints and deterministic upsert/uniqueness rules. Stage data before making it visible.
5. Reconcile record counts, invoice/payment allocations, deposits and active bed locks. Require explicit acceptance before switching the selected adapter.
6. Retain the original export and a pre-import cloud backup. Roll back only the tagged migration batch or restore the staged property according to a tested recovery plan. Log the migration through trusted audit writes.

No records leave the browser until the user explicitly initiates a future authorized migration.

Resident photo and private-document storage have a separate provider and gateway plan in [FILE_STORAGE_INTEGRATION.md](FILE_STORAGE_INTEGRATION.md).
