import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { store } from "../data";
import { firebaseMode } from "../data/firebase";
import { initializeCloud } from "../data/seed";
export function useData() {
  const client = useQueryClient();
  useEffect(
    () =>
      store.subscribe(() => {
        void client.invalidateQueries({ queryKey: ["property"] });
      }),
    [client],
  );
  return useQuery({
    queryKey: ["property"],
    queryFn: async () => {
      const snapshot = await store.read();
      if (!firebaseMode || snapshot.settings.length) return snapshot;
      await initializeCloud(store);
      return store.read();
    },
    staleTime: Infinity,
  });
}
