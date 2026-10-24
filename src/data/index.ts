import { LocalStore } from "./local";
import { ApplicationService } from "../services/application";
export const store = new LocalStore();
export const service = new ApplicationService(store);
