import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { store } from "../data";
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
    queryFn: () => store.read(),
    staleTime: Infinity,
  });
}
