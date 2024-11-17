import { Snapshot } from "./Snapshot.js";

export interface Event {
  id: string;
  snapshots?: Array<Snapshot>;
}
