# User access by email

The PG's existing owner account is the original **Super admin**. Sign in with that account to manage access. Existing PG records stay under the same owner account.

## Publish the access update

1. Run `npm run check:rules` to validate the rules, then `npm run test:rules` to evaluate the role restrictions using fictional requests. These commands do not publish rules or change PG records.
2. Run `npm run deploy:rules` to publish [firestore.rules](firestore.rules). The previous owner-only rules reject team access and cause **Missing or insufficient permissions**. Publishing replaces the active rules, so review this file before deploying.
3. Deploy the updated Firebase build to Netlify and refresh the app.
4. Keep **Firebase Authentication → Email/Password** enabled. Add your Netlify hostname under **Authentication → Settings → Authorized domains** if it is missing. Review the verification and password reset templates in **Authentication → Templates**.

Firebase Authentication sends the verification and password reset messages. No Resend API key, custom sending domain, Firebase Storage, or Supabase setup is needed for this flow. Firebase's email quotas and project password policy still apply.

## Add a person

1. Open **Team & access**.
2. Enter their **email address** and choose **Super admin**, **Admin**, **Staff**, or **Tenant**. A name is optional. For Tenant access, select their saved resident record.
3. Select **Save access**. This records access immediately; it does not send an invitation email.
4. Use **Copy app link** and share the link with them.

No Firebase account needs to be created manually. No user ID or workspace code is shown or requested.

To add another super admin, choose **Super admin** in step 2. They will have full access, including team management, backup import and clearing PG records. The original owner's access cannot be removed from the team list. Use Edit or Remove on other entries to change access.

## First sign-in

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
| Staff | Rooms, existing residents, transfers/checkouts, reservations and repairs. Can see operational room/stay rent amounts. Cannot open finance, reports, settings or team management. Check-in and bill creation remain admin tasks. |
| Tenant | Read only their own basic profile, stay, rent bills and recorded payments. No staff notes, ID details or other residents' records. |

The local IndexedDB demo does not create accounts or send account emails. Use Firebase mode to test separate users.

## How access is enforced

Assignments live in `emailAccess/{lowercase-email}`. They contain the PG owner ID, role, optional resident ID and display labels. A verified Firebase token must match the assigned email; a user cannot grant or change their own role. Only a super admin for that PG may manage its assignments. An email can have one assignment at a time.

Staff reads load only operational collections. Tenant queries include their linked resident ID, and the rules enforce that ID. Tenant profiles come from a small `accounts/{owner}/portal/{resident}` projection containing only name, phone, email and occupation. Payment allocations and internal tenant documents are not exposed to tenants.

Access changes are watched while the app is open, and pending data reads are discarded when the session changes. Firebase rules enforce restrictions independently of the browser UI.

Old `accounts/{owner}/members/{uid}` assignments from the earlier code are no longer used. Re-add those people by email in Team & access. PG business records are unchanged. Clearing PG records preserves the new email access assignments and sign-in accounts; linked tenant portals will be empty until residents are added again.

References: [Firebase account management](https://firebase.google.com/docs/auth/web/manage-users), [Firebase Authentication in Security Rules](https://firebase.google.com/docs/rules/rules-and-auth), [Firestore role access](https://firebase.google.com/docs/firestore/solutions/role-based-access).
