import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  type DocumentReference,
} from "firebase/firestore";
import {
  emptySnapshot,
  names,
  type Entities,
  type EntityName,
  type Snapshot,
} from "../domain/models";
import type { DataStore, Repository } from "./contracts";
import { cloudDb } from "./firebase";

const db = () => {
  if (!cloudDb) throw new Error("Firebase is not configured.");
  return cloudDb;
};

// Each Firebase account owns its own records. No local data is uploaded here.
export class FirestoreStore implements DataStore {
  private uid = "";
  repositories: DataStore["repositories"];

  constructor() {
    const repository = <K extends EntityName>(name: K): Repository<K> => ({
      getAll: async () => (await this.read())[name],
      getById: async (id) =>
        (await this.read())[name].find((item) => item.id === id),
      put: async (value) => {
        await this.transact((state) => {
          const records = state[name] as Entities[K][];
          const index = records.findIndex((item) => item.id === value.id);
          if (index < 0) records.push(value);
          else records[index] = value;
        });
      },
    });
    this.repositories = Object.fromEntries(
      names.map((name) => [name, repository(name)]),
    ) as DataStore["repositories"];
  }

  setUser(uid: string) {
    this.uid = uid;
  }

  private owner() {
    if (!this.uid) throw new Error("Sign in before opening cloud records.");
    return this.uid;
  }

  private records(name: EntityName) {
    return collection(db(), "accounts", this.owner(), "records", name, "items");
  }

  private version(): DocumentReference {
    return doc(db(), "accounts", this.owner(), "control", "version");
  }

  async read(): Promise<Snapshot> {
    const owner = this.owner();
    const snapshots = await Promise.all(
      names.map((name) => getDocs(this.records(name))),
    );
    if (owner !== this.uid)
      throw new Error("The signed-in account changed. Please reload.");
    const state = emptySnapshot();
    names.forEach((name, index) => {
      (state[name] as unknown[]) = snapshots[index].docs.map((item) =>
        item.data(),
      );
    });
    state.beds.sort(
      (a, b) => a.roomId.localeCompare(b.roomId) || a.position - b.position,
    );
    state.audit.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    state.notifications.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    state.occupancies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return state;
  }

  private async change<T>(work: (state: Snapshot) => T): Promise<T> {
    const owner = this.owner();
    for (let attempt = 0; attempt < 4; attempt++) {
      const before = await getDoc(this.version());
      const version = Number(before.data()?.number || 0);
      const state = await this.read();
      const after = await getDoc(this.version());
      if (Number(after.data()?.number || 0) !== version) continue;
      const original = structuredClone(state);
      const result = work(state);
      const writes: Array<{ path: DocumentReference; value?: object }> = [];
      for (const name of names) {
        const old = new Map(
          original[name].map((item) => [item.id, JSON.stringify(item)]),
        );
        const next = new Map(state[name].map((item) => [item.id, item]));
        for (const [id, item] of next)
          if (JSON.stringify(item) !== old.get(id))
            writes.push({
              path: doc(this.records(name), id),
              value: JSON.parse(JSON.stringify(item)) as object,
            });
        for (const id of old.keys())
          if (!next.has(id)) writes.push({ path: doc(this.records(name), id) });
      }
      if (writes.length > 450)
        throw new Error(
          "This cloud import is too large for one save. Contact support before importing it.",
        );
      if (!writes.length) return result;
      try {
        await runTransaction(db(), async (transaction) => {
          const current = await transaction.get(this.version());
          if (
            owner !== this.uid ||
            Number(current.data()?.number || 0) !== version
          )
            throw new Error("Cloud records changed while saving.");
          for (const write of writes) {
            if (write.value) transaction.set(write.path, write.value);
            else transaction.delete(write.path);
          }
          transaction.set(this.version(), { number: version + 1 });
        });
        return result;
      } catch (error) {
        if ((error as Error).message !== "Cloud records changed while saving.")
          throw error;
      }
    }
    throw new Error("Cloud records changed repeatedly. Please try again.");
  }

  transact<T>(work: (state: Snapshot) => T): Promise<T> {
    return this.change(work);
  }

  replace(state: Snapshot): Promise<void> {
    return this.change((current) => {
      for (const name of names)
        (current[name] as unknown[]) = structuredClone(state[name]);
    });
  }

  subscribe(listener: () => void): () => void {
    return onSnapshot(this.version(), () => listener());
  }
}
