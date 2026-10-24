import type { Entities, EntityName, Snapshot } from "../domain/models";
export interface Repository<K extends EntityName> {
  getAll(): Promise<Entities[K][]>;
  getById(id: string): Promise<Entities[K] | undefined>;
  put(value: Entities[K]): Promise<void>;
}
export interface DataStore {
  repositories: { [K in EntityName]: Repository<K> };
  read(): Promise<Snapshot>;
  transact<T>(work: (state: Snapshot) => T): Promise<T>;
  replace(state: Snapshot): Promise<void>;
  subscribe(listener: () => void): () => void;
}
