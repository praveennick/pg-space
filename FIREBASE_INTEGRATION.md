# Firebase mode

For email-based Super admin, Admin, Staff and Tenant accounts, see [User access setup](USER_ACCESS.md). Existing owners keep their PG; added users set their password and verify their email in the app. Publish the updated Firestore rules before testing team access.

Firebase mode is opt-in. The normal `npm run dev` command still opens the local IndexedDB demo. `npm run dev:firebase` opens a separate, signed-in Firestore workspace connected to the `lucky-luxury-mens-pg` web app using `.env.firebase.local`. The web config is a public project identifier, not an administrator credential. Analytics is intentionally not initialized.

## Netlify deployment

[netlify.toml](netlify.toml) runs `npm run build:firebase` and publishes `dist`. The committed `.env.firebase` contains only the public Firebase web configuration, so Netlify can build the signed-in app without your local `.env.firebase.local` file. Redeploy the site after pushing these files. The deployed app should show the Firebase sign-in screen, and the workspace should say **Saved to Firebase** after sign-in. Do not set `VITE_DATA_BACKEND=local` or override these web values in Netlify environment variables; build environment variables take precedence over the env file. Keep the Firestore rules and Email/Password Authentication enabled. Local demo records do not appear in Firebase until imported through Settings.

## One-time Firebase Console setup

1. In **Authentication → Sign-in method**, enable **Email/Password**. Use the existing PG owner's account for the initial super admin. Invited users choose **First time? Set password** in the app, then verify their email. Creating an account does not grant a role. See [User access setup](USER_ACCESS.md).
2. Create a **Cloud Firestore** database in this project. Choose a suitable region before storing business data; region choices are difficult to change later. **Firebase Storage is not required.**
3. The Firebase CLI is installed in this project's development dependencies, so you do not need a global `firebase` command. From the project folder, run `npm install` if needed, then `npm run firebase:login` and `npm run firebase:projects` to confirm access to `lucky-luxury-mens-pg`. Review any existing Firestore rules in the Firebase Console before deploying: deployment replaces the active rules with the included [firestore.rules](firestore.rules). Run `npm run check:rules` to validate the deployment, then `npm run deploy:rules`. Both commands target **Firestore rules only**. Review the console's active rules afterward. The frontend does **not** deploy rules by itself.
4. Start the cloud workspace with `npm run dev:firebase`, or make a production bundle with `npm run build:firebase`. Sign in with the existing owner account and update its details in Settings. A completely new database needs its initial owner's property settings provisioned through the Firebase Console or a trusted administrator before sign-in; public sign-up cannot make someone a super admin for an existing PG.

## Share receipt PDFs from a phone

The **Share receipt PDF** action creates a PDF on the device and passes it to the phone's share menu. Choose WhatsApp, then choose the recipient and confirm sending. No PDF is uploaded to Firebase Storage. The app cannot silently select a WhatsApp chat or send the attachment without your confirmation.

Mobile browsers require HTTPS for this file-sharing feature. A Vite URL such as `http://192.168.1.17:5173` cannot use it. Firebase **Hosting** can serve this app over HTTPS on the project's `web.app` domain using the Spark plan's no-cost Hosting quota; it is a separate product from Firebase **Storage** and does not require enabling Storage. The hosting configuration serves the Firebase-mode build and routes `/app/...` pages to the React app.

After reviewing the build and confirming the Firestore rules are active, run `npm run build:firebase`, `npm run check:hosting`, and `npm run deploy:hosting`. Open the resulting HTTPS URL on the phone, sign in, then tap **Share receipt PDF → Share PDF attachment → WhatsApp**. Hosting makes the app reachable on the internet, so use the signed-in Firebase mode for real records and keep the Authentication and Firestore rules enabled. The share menu only offers apps installed on the device that accept PDF files.

Cloud records live under `accounts/{ownerUid}/records/{entity}/items/{recordId}`. The owner and authorized email assignments determine access to that PG. Staff reads and tenant queries are restricted by the Firestore rules. Firebase mode does not upload resident photos or identity document files. It shows initials in place of photos. The local demo still supports browser-only photos.

## Existing local records

Nothing is uploaded when Firebase mode is enabled. To move records deliberately, first **Download backup** from the local demo, then sign into Firebase mode and use **Import backup** in Settings. Review the record counts before confirming; importing replaces that account's cloud records. Firebase imports discard local photo metadata because the photo files are not part of the JSON backup and cloud photo storage is disabled. Keep the downloaded backup.

Local mode and Firebase mode use the same page-facing application service. Firebase mode uses versioned transactions and limits staff reads to operational collections. Admin commands still load the property's collections, so Firestore transaction size, network availability and read costs limit large imports and high-volume use. Larger deployments should move business commands behind trusted functions and add query pagination. Audited document storage is not implemented.

The Firebase API key and app ID are public by design. Access control depends on Firebase Authentication and the deployed Firestore rules. Do not deploy with test-mode/public rules. See [Firebase web setup](https://firebase.google.com/docs/web/setup), [Firestore rules](https://firebase.google.com/docs/firestore/security/get-started), and [Firebase API keys](https://firebase.google.com/docs/projects/api-keys).
