# Automatic resident logins and welcome email

When an admin or super admin saves a new resident with an email in Firebase mode, PG Space now:

1. Saves the resident and their stay/rent records.
2. Calls a protected Netlify function with the saved resident ID.
3. Reads the email from that resident record, creates a Firebase Authentication account using that exact normalized email if needed, and assigns Tenant access to that resident only.
4. Requests a Firebase password-setup/reset email. The resident follows the link, chooses their own password, then signs into PG Space with the same email. Email verification is still required if Firebase has not verified it.

No temporary password is generated or emailed. Existing accounts are reused without changing their password. An email already assigned to an admin, another PG or another resident is rejected. Existing disabled accounts and PG owner accounts are protected.

`npm run test:auth` runs a local Firebase Auth emulator and checks account creation, password setup and sign-in using a fictional email. It never contacts the production project or sends real mail.

## One-time Netlify setup

The normal React Firebase configuration cannot create accounts for other people. The Netlify server function needs a private Firebase server credential for this step.

1. In **Firebase Console → Project settings → Service accounts**, generate a private key for `lucky-luxury-mens-pg`. Keep the downloaded JSON private. Prefer a dedicated account with Firebase Authentication Admin and Cloud Datastore User permissions when configuring least-privilege IAM.
2. In **Netlify → Project configuration → Environment variables**, add:

| Variable | Value | Scope |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Complete downloaded JSON, marked sensitive | Functions |
| `FIREBASE_WEB_API_KEY` | This project's public Web API key, already present as `VITE_FIREBASE_API_KEY` in `.env.firebase` | Functions |
| `APP_URL` | `https://lucky-luxury-pg.netlify.app` | Functions |

`APP_URL` can be omitted when Netlify's `URL` variable contains the correct site address. Keep credentials out of source files, `VITE_` variables and the chat. The Web API key is public; the service account JSON is a secret.

3. Keep Email/Password enabled in Firebase Authentication. Add your app hostname in **Authentication → Settings → Authorized domains** so Firebase accepts the continuation link.
4. Deploy the latest app and included Netlify function. [netlify.toml](netlify.toml) routes `/api/tenant-login` before the React fallback. This function uses Node 22 and Firebase Admin; Firebase Cloud Functions, Storage, Gmail and Resend are not required.
5. Deploy the current [Firestore access rules](firestore.rules) with `npm run deploy:rules`. Invitation status/rate records can only be created or updated by the server. Super admins can read/delete them so **Clear all records** also removes invitation metadata; other roles cannot access them.

## Brand the welcome/password-setup email

Firebase uses its **Password reset** template for this legitimate account setup action. There is no separate Firebase welcome-email template. This same template also serves **Forgot password**, so its wording must cover both setting and resetting a password.

In **Firebase Authentication → Templates → Password reset**, use:

- Sender name: **Lucky Luxury Men's PG**
- Subject: **Your PG Space account — set or reset your password**
- Message: the HTML in [firebase-password-setup.html](emails/firebase-password-setup.html), if the editor accepts HTML. Preserve `%DISPLAY_NAME%`, `%EMAIL%` and `%LINK%` exactly. If the editor offers only text, use its equivalent text and keep `%LINK%`.

The included design uses a responsive card and a clear password button. It does not modify the restricted verification-email body. Firebase controls the sender domain and account action link.

Firebase rejected a direct API attempt to customize this project's template with `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`; no template change was applied. Use the Console editor for the branding step. If that editor is also locked, the native password-setup email still works with Firebase's current template, and changing its design requires resolving the template restriction with Firebase.

## Test and retry

Use your own second test email as a new fictional resident. Save it on the deployed Firebase app. Confirm that Authentication contains that exact email and Team & access shows Tenant linked to the saved resident. Open the received setup link, choose a password and sign in. It should open only that resident's portal.

The app reports **email requested** after Firebase accepts the request; this does not prove inbox delivery. Re-saving does not automatically send duplicate emails. For an explicit retry, open **Resident profile → Send login email**, review the address and confirm. Check the inbox before retrying a timeout because the original request might already have been accepted.

If server configuration or email sending fails, the resident remains saved and the app shows the failure. Use the profile button after fixing setup. Local `npm run dev` never creates accounts or sends emails; Firebase mode on Vite alone needs Netlify Dev or a deployed function for this endpoint.

Sending is limited to 30 requests per PG and 3 per resident per hour. Status records are stored under `accounts/{owner}/tenantOnboarding/{tenant}`. They contain email, account ID, timestamps and request status, never passwords or action links. No provider delivery status is available from Firebase's password-reset API.

## Deployment troubleshooting

- **Firebase rejects the password-setup email:** its continuation URL must use a hostname listed in **Authentication → Settings → Authorized domains**. The current app needs `lucky-luxury-pg.netlify.app`. `node scripts/check-auth-email-settings.mjs` reads the relevant settings without sending mail; `--allow-netlify-domain` adds only that fixed hostname while preserving existing entries. Updated functions return safe provider codes such as `UNAUTHORIZED_DOMAIN`, `API_KEY_INVALID` or `EMAIL_RATE_LIMITED`, and record them with the invitation status.

- **HTTP 502 / `ERR_REQUIRE_ESM` mentioning `jwks-rsa` and `jose`:** the function crashed before handling the request. This project pins Firebase Admin to 13.10.0, which loads under Lambda's default module restrictions. Redeploy from the updated repository and lockfile. `npm run check:functions-runtime` is now a build gate that reproduces those restrictions locally.
- **Reset says permission denied:** publish the latest rules with `npm run deploy:rules`. The reset must read/delete invitation metadata too; earlier rules did not permit those paths. All collections are read before deletion starts, so a permission failure at that stage deletes nothing.
- **A webpage is returned for the email endpoint:** confirm Netlify deployed `tenant-login` and used the current `netlify.toml`; uploading only the `dist` folder does not deploy a server function. `node scripts/check-tenant-login-deployment.mjs` checks the public routes using GET only and does not send mail.
- **Manually created owner account:** a Firebase Authentication user can remain the original PG owner if it already owns the saved property. The word `admin` in its email does not assign a role. Use an inbox you control for password recovery and any email-based invitations.

Account identity is not silently transferred when an existing resident's contact email is edited. If that resident already has access under a different email, a super admin must review/remove the old Tenant assignment before inviting the new email. Other roles are never automatically replaced.

References: [Firebase Admin account creation](https://firebase.google.com/docs/auth/admin/manage-users), [Firebase account emails](https://firebase.google.com/docs/auth/web/manage-users), [Firebase email template fields](https://support.google.com/firebase/answer/7000714).
