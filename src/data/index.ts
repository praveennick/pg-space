import { LocalStore } from "./local";
import { ApplicationService } from "../services/application";
import { firebaseMode } from "./firebase";
import { FirestoreStore } from "./firestore";
import type { DataStore } from "./contracts";
export const localStore = new LocalStore();
export const firebaseStore = firebaseMode ? new FirestoreStore() : null;
export const store: DataStore = firebaseStore || localStore;
export const service = new ApplicationService(store);
