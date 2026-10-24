import { createContext, useContext } from "react";
import type { Snapshot } from "../domain/models";
import type { EditorState } from "../components/Editors";
export const AppContext = createContext<{
  s: Snapshot;
  open: (editor: EditorState) => void;
}>({} as never);
export const useApp = () => useContext(AppContext);
