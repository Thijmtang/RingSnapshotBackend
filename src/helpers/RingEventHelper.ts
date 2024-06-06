import * as fs from "fs";

import moment from "moment";
import { RingCamera } from "ring-client-api";
import { encodeBase64, saveImage } from "./ImageHelper.js";
import { promisify } from "util";
import path from "path";
import { Event } from "../interfaces/event.js";
import { Dashboard } from "../interfaces/dashboard.js";
import { Chartdata } from "../interfaces/Chartdata.js";

/**
 * Save 5 snapshots with a interval of 2000ms to capture as much of the motion as possible, since getting a snapshot has a huge delay
 * @param ringCamera
 * @param date
 */
export const saveEventImages = async (ringCamera: RingCamera, date: number) => {
  // Create directory for todays events/snapshots,

  if (!fs.existsSync("./snapshots/")) {
    fs.mkdirSync("./snapshots/");
  }

  // const currentTime = moment();

  const dateTodayString = moment(new Date(Number(date))).format("DD-MM-yyyy");
  if (!fs.existsSync("./snapshots/" + dateTodayString)) {
    fs.mkdirSync("./snapshots/" + dateTodayString);
  }

  for (let i = 0; i < 5; i++) {
    const result = await ringCamera.getSnapshot();
    const snapshotDirectory = `./snapshots/${dateTodayString}/${date}/`;

    if (!fs.existsSync(snapshotDirectory)) {
      fs.mkdirSync(snapshotDirectory);
    }

    saveImage(snapshotDirectory, date.toString() + `-${i}`, result);

    // Wait for the snapshot to be taken in intervals so we get different images
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
};
/**
 * Fetch the saved snapshots
 * @param startDate
 * @param endDate
 * @returns
 */
export const getEvents = async (
  filter: "today" | "week" | "month" | "year" | "all" | ""
) => {
  let array: Array<{
    day: string;
    events: Array<Event>;
  }> = [];

  const directory = `.${path.sep}snapshots`;
  const readDirPromise = promisify(fs.readdir);

  let days = await readDirPromise(directory);
  if (filter !== "all" && filter !== "") {
    let startDate: Date;
    let endDate: Date;

    switch (filter) {
      case "today":
        startDate = moment().startOf("day").toDate();
        endDate = moment().endOf("day").toDate();
        break;
      case "week":
        startDate = moment().startOf("week").toDate();
        endDate = moment().endOf("week").toDate();
        break;
      case "month":
        startDate = moment().startOf("month").toDate();
        endDate = moment().endOf("month").toDate();
        break;
      case "year":
        startDate = moment().startOf("year").toDate();
        endDate = moment().endOf("year").toDate();
        break;
      default:
        return;
    }

    days = days.filter((day: string) => {
      const dayDate = moment(day, "DD-MM-YYYY").toDate();
      return dayDate >= startDate && dayDate <= endDate;
    });
  }

  for (const day of days) {
    // snapshot/date/snapshotdate/all files
    let currentPath = `${directory}${path.sep}${day}`;

    // Fetch all events which happened on the day of
    const events = await readDirPromise(currentPath);

    // All the snapshots taken during the event
    const eventArray = await Promise.all(
      events.map(async (event: string) => {
        const snapshots = (
          await readDirPromise(currentPath + path.sep + event)
        ).map((snapshot: string) => {
          return encodeBase64(
            currentPath + path.sep + event + path.sep + snapshot
          );
        });
        return { id: event, snapshots: snapshots };
      })
    );

    array.push({
      day: day,
      events: eventArray,
    });
  }

  return array;
};

export const flattenEvents = (
  days: Array<{ day: string; events: Array<Event> }>
) => {
  const events: Array<Event & { day: string }> = [];

  days.forEach((day) => {
    const formattedEvents = day.events.map((event) => {
      const formattedEvent: Event & { day: string } = {
        id: event.id,
        snapshots: event.snapshots,
        day: day.day,
      };
      return formattedEvent;
    });

    events.push(...formattedEvents);
  });

  events.sort((a, b) => {
    return parseInt(b.id) - parseInt(a.id);
  });

  return events;
};

export const formatEventsForChart = (
  days: Array<{ day: string; events: Array<Event> }>
) => {
  const formattedDayEvents: Array<Chartdata> = [];
  days.forEach((day) => {
    // Count the events per hour
    const perHourCount: { [key: string]: number } = {};

    const formattedEvents = day.events.map((event) => {
      const date = moment(parseInt(event.id));

      if (perHourCount[date.hour()] === undefined) {
        perHourCount[date.hour()] = 0;
      }

      perHourCount[date.hour()]++;

      return perHourCount;
    });

    formattedDayEvents.push(
      Object.assign({}, { date: day.day }, ...formattedEvents)
    );
  });

  return formattedDayEvents;
};

export const getDashboardData = async () => {
  const motionToday = flattenEvents(await getEvents("today"));

  const monthEvents = await getEvents("month");

  const chartData = formatEventsForChart(monthEvents);
  const dashboard: Dashboard = {
    todayEvents: motionToday,
    chartData: chartData,
  };

  return dashboard;
};
