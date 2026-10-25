# User access by email

The PG's existing owner account is the original **Super admin**. Sign in with that account to manage access. Existing PG records stay under the same owner account.

## Publish the access update

1. Run `npm run check:rules` to validate the rules, then `npm run test:rules` to evaluate the role restrictions using fictional requests. These commands do not publish rules or change PG records.
2. Run `npm run deploy:rules` to publish [firestore.rules](firestore.rules). The previous owner-only rules reject team access and cause **Missing or insufficient permissions**. Publishing replaces the active rules, so review this file before deploying.
3. Deploy the updated Firebase build to Netlify and refresh the app.
4. Keep **Firebase Authentication → Email/Password** enabled. Add your Netlify hostname under **Authentication → Settings → Authorized domains** if it is missing. Review the verification and password reset templates in **Authentication → Templates**.

Firebase Authentication sends the verification and password reset messages. No Resend API key, custom sending domain, Firebase Storage, or Supabase setup is needed for this flow. Firebase's email quotas and project password policy still apply.

## Add a person

New residents added with an email now receive Tenant access and a Firebase password-setup email automatically once the Netlify server is configured. See [Automatic resident login setup](TENANT_LOGIN_SETUP.md). Their login uses the email saved on the resident record; they should use the emailed setup link rather than creating a second account. The manual Team form below remains available for staff, admins and existing residents.

1. Open **Team & access**.
2. Enter their **email address** and choose **Super admin**, **Admin**, **Staff**, or **Tenant**. A name is optional. For Tenant access, select their saved resident record.
3. Select **Save access**. This records access immediately; it does not send an invitation email.
4. Use **Copy app link** and share the link with them.

No Firebase account needs to be created manually. No user ID or workspace code is shown or requested.

To add another super admin, choose **Super admin** in step 2. They will have full access, including team management, backup import and clearing PG records. The original owner's access cannot be removed from the team list. Use Edit or Remove on other entries to change access.

## First sign-in

Residents whose accounts were created automatically should open their emailed password-setup link, choose a password, then sign in. The steps below apply to people added manually through Team & access who do not have an account yet.

1. Open the app and choose **First time? Set password**.
2. Enter the same email the owner added, choose a password and confirm it.
3. Open Firebase's verification email, then return to the app and select **I verified my email — continue**.
4. The assigned PG and role open automatically. Future visits use normal email/password sign-in.

An existing Firebase Authentication account should use its current password, or **Forgot password?** to choose a new one through an email link. Creating a password alone does not give access to any PG. An uninvited email sees an access-required message after verification.

## Permissions

| Role | Access |
| --- | --- |
| Super admin | All PG records, settings, team roles, backup import and clearing data. |
| Admin | PG operations, finances, reports and settings. Cannot manage team access, import/replace all records or clear data. |
| Staff | Rooms, existing residents, transfers/checkouts, reservations and repairs. Can collect rent, record payments, apply advances to rent, view rent dues/payment history and share receipts. Cannot edit/delete recorded payments, manage deposits or expenses, open reports, change settings or manage users. Check-in and bill creation remain admin tasks. |
| Tenant | View their own profile, stay, rent bills and payments. Submit repair requests and watch their own ticket status. Cannot edit requests or change status. No staff notes, ID details or other residents' records. Access ends at checkout. |

The local IndexedDB demo does not create accounts or send account emails. Use Firebase mode to test separate users.

## How access is enforced

Assignments live in `emailAccess/{lowercase-email}`. They contain the PG owner ID, role, optional resident ID and display labels. A verified Firebase token must match the assigned email; a user cannot grant or change their own role. Only a super admin for that PG may manage its assignments. An email can have one assignment at a time.

Staff reads load only operational collections. Tenant queries include their linked resident ID, and the rules enforce that ID. Tenant profiles come from a small `accounts/{owner}/portal/{resident}` projection containing name, phone, email, occupation and an active-access flag. Payment allocations and internal tenant documents are not exposed to tenants. The portal has its own Light/Dark/System theme selection, saved on the device.

## Checkout, account removal and repair requests

Deploy the updated Netlify app **and** run `npm run deploy:rules` for these changes. The `/api/account-action` function uses the same private `FIREBASE_SERVICE_ACCOUNT_JSON` and `APP_URL` settings as tenant onboarding. No new email or storage provider is required. Firebase mode on localhost needs Netlify Dev for these server actions; the local demo still works without credentials.

Checkout ends the stay and marks portal access inactive in the same Firestore transaction. Rules then block profile, bill, payment and ticket reads even with an existing sign-in token. The server checks that no active stay remains, revokes refresh tokens, deletes the tenant's Firebase Authentication account and removes their Team entry. Saved PG and payment records remain. If account deletion fails, checkout stays saved and portal access stays blocked; a super admin can retry with **Team & access → Remove**. A later check-in can create a fresh login. Original PG owner accounts cannot be removed this way.

**Team & access → Remove** now deletes the Firebase sign-in account, rather than only removing the PG assignment. Its confirmation explains this. It keeps business records. No existing accounts are deleted merely by deploying this update.

An account removed by an older app version can remain in Firebase Authentication after its PG access entry is gone. The app now checks this case and reports the remaining login instead of reporting a successful deletion. It cannot safely infer ownership of an unlinked Firebase account, so the owner must review the exact email in Firebase Authentication and remove it there if appropriate. If Firebase denies server-side deletion, the error now identifies the server account's Authentication permissions as the issue and keeps the PG entry so removal can be retried. **Clear all records** intentionally preserves sign-in accounts and team assignments; it is not a user-deletion action.

The portal's server session check enables the active flag for existing tenants only when they still have a current stay; it never reactivates an explicitly blocked portal. Repair submission derives the resident, room and bed from saved data, sets status **Open**, and allows up to five requests per resident per hour. Staff and managers update status through Repairs. Tenants can only see their own requests and updates; browser writes to tickets remain denied. Old staff-created tickets without a resident link stay staff-only.

Access changes are watched while the app is open, and pending data reads are discarded when the session changes. Firebase rules enforce restrictions independently of the browser UI.

Old `accounts/{owner}/members/{uid}` assignments from the earlier code are no longer used. Re-add those people by email in Team & access. PG business records are unchanged. Clearing PG records preserves the new email access assignments and sign-in accounts; linked tenant portals will be empty until residents are added again.

References: [Firebase account management](https://firebase.google.com/docs/auth/web/manage-users), [Firebase Authentication in Security Rules](https://firebase.google.com/docs/rules/rules-and-auth), [Firestore role access](https://firebase.google.com/docs/firestore/solutions/role-based-access).
