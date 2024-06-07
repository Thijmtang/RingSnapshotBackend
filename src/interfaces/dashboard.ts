import { Event } from "./event.js";

export interface Dashboard {
  todayEvents: Array<Event>;
  chartData: Record<string, any>[];
  averageDailyMotion: string;
}
