# Firebase mode

Firebase mode is opt-in. The normal `npm run dev` command still opens the local IndexedDB demo. `npm run dev:firebase` opens a separate, signed-in Firestore workspace connected to the `lucky-luxury-mens-pg` web app using `.env.firebase.local`. The web config is a public project identifier, not an administrator credential. Analytics is intentionally not initialized.

## One-time Firebase Console setup

1. In **Authentication → Sign-in method**, enable **Email/Password**. Add your owner email/password in **Authentication → Users**. The app does not offer public account creation.
2. Create a **Cloud Firestore** database in this project. Choose a suitable region before storing business data; region choices are difficult to change later. **Firebase Storage is not required.**
3. The Firebase CLI is installed in this project's development dependencies, so you do not need a global `firebase` command. From the project folder, run `npm install` if needed, then `npm run firebase:login` and `npm run firebase:projects` to confirm access to `lucky-luxury-mens-pg`. Review any existing Firestore rules in the Firebase Console before deploying: deployment replaces the active rules with the included [firestore.rules](firestore.rules). Run `npm run check:rules` to validate the deployment, then `npm run deploy:rules`. Both commands target **Firestore rules only**. Review the console's active rules afterward. The frontend does **not** deploy rules by itself.
4. Start the cloud workspace with `npm run dev:firebase`, or make a production bundle with `npm run build:firebase`. Sign in with the owner account. The first sign-in creates an empty property named **My PG**; update its details in Settings.

Cloud records live under `accounts/{firebaseUid}/records/{entity}/items/{recordId}`. The rules restrict each account to its own records; another Firebase user cannot see that account's PG. Firebase mode does not upload resident photos or identity document files. It shows initials in place of photos. The local demo still supports browser-only photos.

## Existing local records

Nothing is uploaded when Firebase mode is enabled. To move records deliberately, first **Download backup** from the local demo, then sign into Firebase mode and use **Import backup** in Settings. Review the record counts before confirming; importing replaces that account's cloud records. Firebase imports discard local photo metadata because the photo files are not part of the JSON backup and cloud photo storage is disabled. Keep the downloaded backup.

Local mode and Firebase mode use the same page-facing application service. Firebase mode has an owner-scoped Firestore adapter and versioned transactions; it currently reads the entire property's collections for each command. This supports a small single-owner PG, but it is not a scaled server command layer. Firestore transaction size, network availability and read costs limit large imports and high-volume use. A later production release should move payment, bed assignment, audit and role-specific staff commands behind trusted functions and add query pagination. Separate staff accounts and audited document storage are not yet implemented.

The Firebase API key and app ID are public by design. Access control depends on Firebase Authentication and the deployed Firestore rules. Do not deploy with test-mode/public rules. See [Firebase web setup](https://firebase.google.com/docs/web/setup), [Firestore rules](https://firebase.google.com/docs/firestore/security/get-started), and [Firebase API keys](https://firebase.google.com/docs/projects/api-keys).
