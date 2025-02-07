import { Snapshot } from "./Snapshot.js";

export interface Event {
  id: string;
  day: string;
  snapshots?: Array<Snapshot>;
  hasVideo: boolean;
}
