# PG Space

A PG management workspace built with React, TypeScript and Vite. The default demo is local-first with Dexie; an opt-in Firebase mode adds account sign-in and cloud records. All demo residents are fictional.

## Run locally

Use Node 22.12+ or a supported newer LTS release and npm.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd install` and `npm.cmd run dev`.

To use the configured Firebase project, complete the [Firebase setup steps](FIREBASE_INTEGRATION.md) and run `npm run dev:firebase`. Local demo records are never uploaded automatically.

Use [User access setup](USER_ACCESS.md) to add Super admins, Admins, Staff and Tenants by email. Added users set their own password and verify their email in the app.

To open the demo from a phone on the same Wi-Fi network, start Vite with `npm run dev -- --host 0.0.0.0` and visit the computer's LAN address (for example, `http://192.168.1.17:5173/app/dashboard`). The app supports browsers that omit `crypto.randomUUID()` on LAN HTTP. Browser storage belongs to that phone and URL, so records saved on your computer's `localhost` are not shared with the phone. LAN HTTP is unencrypted; use fictional demo data and an HTTPS deployment for real use.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The browser tests use an installed Chrome when `PLAYWRIGHT_CHROME_PATH` is set, otherwise Playwright Chromium (install with `npx playwright install chromium`). They run against an isolated browser context and never touch your normal Chrome profile. Test screenshots are written to `tests/artifacts/`.

## Features

- Responsive sidebar and mobile navigation; locally bundled Inter font; Light, Dark, System themes.
- Seeded property with four floors, 24 rooms, 1–6 sharing and custom seven-sharing, fictional residents, six months of finances, reservations, and maintenance.
- Create/edit rooms, numeric custom capacity, generated bed labels, safe bed retirement, archive guards, individual bed rent, filters, sorting, grid/table views and pagination.
- Transactional resident wizard, profiles, editable personal details, historical stays, transfers, checkout and separate deposit settlement.
- Resident photos can be captured or uploaded on localhost, previewed, and shown in lists, profiles and bed details. Verification details are recorded without ID numbers. Private document and cloud-storage requirements are in [FILE_STORAGE_INTEGRATION.md](FILE_STORAGE_INTEGRATION.md).
- Monthly invoice generation with duplicate prevention, optional initial proration, exact integer-paise payments, partial/full receipts, overpayment guards, transaction-reference and idempotency checks.
- Unallocated advances and explicit invoice allocation, separate deposit collection/deduction/refund ledger, downloadable PDF payment receipts.
- Quotation form at `/app/quotations` with automatically assigned quotation numbers, accommodation rows, live monthly total, notes, and a downloadable PDF using the Lucky Luxury Men's PG letterhead artwork supplied in the reference Word file. Saved quotations appear in Quotation history, can be reopened or downloaded again, and are included in the Settings backup. The unfinished draft is saved separately in this browser.
- Expense editing, categories, recurring-template metadata and CSV exports.
- Reservation conflict prevention and conversion to check-in; expiry-derived availability; maintenance tickets with optional operational bed blocks.
- Stored notifications, live reminders, read state, activity history, property/billing defaults, transactional JSON backup/restore with schema and integrity validation, confirmed demo reset.
- Live dashboard statistics and reporting from the selected data store. Occupancy is a current snapshot; rent totals use invoice billing months; cash flow uses payment dates and operating expense dates.

## Architecture

`pages/components -> application service -> DataStore/Repository contracts -> LocalStore (Dexie) or FirestoreStore`

- `src/domain`: independent Zod schemas, domain types and pure calculations.
- `src/data/contracts.ts`: typed repositories for every persistent entity and a transactional store contract.
- `src/data/local.ts`: Dexie indexes, repositories, atomic commands and reactive subscriptions.
- `src/services/application.ts`: validation and multi-entity use cases. UI never calls IndexedDB directly.
- `src/hooks/useData.ts`: TanStack Query cache invalidated by a Dexie live subscription, including other tabs.
- `src/data/index.ts`: selects the local adapter by default or the opt-in Firebase adapter.

Financial and occupancy commands revalidate inside a read/write transaction. Retired beds remain addressable by historical records. Schema version 1 stores rooms, beds, tenants, occupancies, reservations, invoices, payments, allocations, deposit transactions, expenses, tickets, notifications, audit entries and one property/settings record. Floors are numeric, configured on the property. A single monthly rent amount is represented directly on each invoice.

## Billing rules and boundaries

- An active stay uses its agreed rent, not the room’s current default. Changing defaults does not rewrite historical invoices.
- Generation creates at most one rent invoice per tenant per billing month. Transfers keep the agreed rent and existing month’s invoice. There is no automatic credit/rebilling after an early checkout or transfer; review settlement separately.
- Proration is based on known stay dates when an invoice is first generated. Later checkout does not mutate issued invoices.
- Security deposits, booking amounts and unallocated advances are not rental revenue. A reservation booking amount remains separately recorded after conversion/cancellation; automatic booking credit/refund processing is not implemented.
- Recurring expenses are templates/flags, not automatically scheduled charges. Automatic late fees, discount/charge line items, receipt attachments, and secure document uploads are not implemented.
- Custom financial date ranges select whole billing months for invoice totals and exact dates for cash receipts/expenses. Occupancy is current, not a reconstructed historical snapshot.
- Local browser storage is device/browser/origin specific. Clearing site data removes it; export backups in Settings. Firebase mode adds owner sign-in and private cloud records, but does not yet include staff roles or trusted server-side financial commands. Do not upload identity documents.

See [FIREBASE_INTEGRATION.md](FIREBASE_INTEGRATION.md) for Firebase setup, security rules and explicit backup import. No automatic upload occurs.
