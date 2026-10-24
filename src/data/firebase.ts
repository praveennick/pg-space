import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseMode = import.meta.env.VITE_DATA_BACKEND === "firebase";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (firebaseMode && Object.values(config).some((value) => !value))
  throw new Error(
    "Firebase configuration is incomplete. Check .env.firebase.local.",
  );

// Analytics is intentionally omitted: PG records do not need analytics events.
const app = firebaseMode ? initializeApp(config) : null;
export const cloudAuth = app ? getAuth(app) : null;
export const cloudDb = app ? getFirestore(app) : null;
