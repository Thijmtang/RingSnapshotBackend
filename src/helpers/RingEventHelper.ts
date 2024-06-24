import * as fs from "fs";
import moment from "moment";
import path from "path";
import { RingCamera } from "ring-client-api";
import { promisify } from "util";
import { Chartdata } from "../interfaces/Chartdata.js";
import { Dashboard } from "../interfaces/dashboard.js";
import { Event } from "../interfaces/event.js";
import { encodeBase64, saveImage } from "./ImageHelper.js";
/**
 * Save 5 snapshots with a interval to capture as much of the motion as possible, since getting a snapshot has a huge delay
 * @param ringCamera
 * @param date
 */
export const saveEventImages = async (ringCamera: RingCamera, date: number) => {
  if (!fs.existsSync("./snapshots/")) {
    fs.mkdirSync("./snapshots/");
  }

  // Create directory for todays events/snapshots,
  const dateTodayString = moment(new Date(Number(date))).format("DD-MM-yyyy");
  if (!fs.existsSync("./snapshots/" + dateTodayString)) {
    fs.mkdirSync("./snapshots/" + dateTodayString);
  }

  for (let i = 0; i < 5; i++) {
    try {
      const result = await ringCamera.getSnapshot();
      const snapshotDirectory = `./snapshots/${dateTodayString}/${date}/`;

      if (!fs.existsSync(snapshotDirectory)) {
        fs.mkdirSync(snapshotDirectory);
      }

      saveImage(snapshotDirectory, date.toString() + `-${i}`, result);
    } catch (e) {
      console.log(e);
    }

    // Wait for the snapshot to be taken in intervals so we get different images
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
};
/**
 * Fetch the saved snapshots, within the given time period
 * @param startDate
 * @param endDate
 * @returns
 */
export const getEvents = async (
  filter: "today" | "week" | "month" | "year" | "all" | "",
  includeSnapshots = false
) => {
  let array: Array<{
    day: string;
    events: Array<Event>;
  }> = [];

  const directory = `.${path.sep}snapshots`;
  const readDirPromise = promisify(fs.readdir);

  let days = await readDirPromise(directory);
  if (filter !== "all" && filter !== "") {
    let intervalText = "";

    switch (filter) {
      case "today":
        intervalText = "day";
        break;
      case "week":
        intervalText = "week";
        break;
      case "month":
        intervalText = "month";
        break;
      case "year":
        intervalText = "year";
        break;
      default:
        intervalText = filter;
        return;
    }

    const startDate = moment()
      .startOf(intervalText as moment.unitOfTime.Base)
      .toDate();
    const endDate = moment()
      .endOf(intervalText as moment.unitOfTime.Base)
      .toDate();

    // Filter out the days which are not within the given time period
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
        let snapshots = [];

        if (includeSnapshots) {
          snapshots = (
            await readDirPromise(currentPath + path.sep + event)
          ).map((snapshot: string) => {
            return encodeBase64(
              currentPath + path.sep + event + path.sep + snapshot
            );
          });
        }

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

export const getEvent = async (day: string, datetime: string) => {
  const directory = `.${path.sep}snapshots${path.sep}${day}${path.sep}${datetime}`;
  const readDirPromise = promisify(fs.readdir);

  let snapshots = await readDirPromise(directory);
  snapshots = snapshots.map((snapshot) => {
    return encodeBase64(directory + path.sep + snapshot);
  });

  return { id: datetime, snapshots: snapshots };
};

/**
 * Flatten/merge the arrays seperated by days into a single array with each event object
 * @param days getEvents result array
 * @returns
 */
export const flattenEvents = (
  days: Array<{ day: string; events: Array<Event> }>,
  order: "desc" | "asc" = "asc"
): Array<Event & { day: string }> => {
  const events: Array<Event & { day: string }> = [];

  days.forEach((day) => {
    day.events.forEach((event) => {
      events.push({
        id: event.id,
        snapshots: event.snapshots,
        day: day.day,
      });
    });
  });

  switch (order) {
    case "asc":
      return events.reverse();
    case "desc":
      return events;
  }
};

export const formatEventsForChart = (
  days: Array<{ day: string; events: Array<Event> }>
) => {
  const formattedDayEvents: Array<Chartdata> = [];

  days.forEach((day) => {
    // Fill array with all possible hours,
    // Keep count of the events which occured per hour
    const dayPerHourCount: { [key: string]: number } = {};
    for (let i = 0; i < 24; i++) {
      dayPerHourCount[`${i}:00`] = null;
    }
    let formattedEvents = day.events.map((event) => {
      const date = `${moment(parseInt(event.id)).hour()}:00`;

      if (dayPerHourCount === undefined) {
        dayPerHourCount[date] = 0;
      }
      dayPerHourCount[date]++;

      return dayPerHourCount;
    });

    formattedDayEvents.push(
      Object.assign({}, { date: day.day }, ...formattedEvents)
    );
  });

  return formattedDayEvents;
};

/**
 * Calculate the average ring dings based on the count of the snapshots within days
 * @param days
 * @returns
 */
export const getAverageMotion = (
  days: Array<{
    day: string;
    events: Array<Event>;
  }>
): string => {
  let count = 0;

  days.forEach((day) => {
    count += day.events.length;
  });

  return (count / days.length).toFixed(2);
};

export const getDashboardData = async () => {
  const motionToday = flattenEvents(await getEvents("today"));

  const monthEvents = await getEvents("month");

  const chartData = formatEventsForChart(monthEvents);

  const averageDailyMotion = getAverageMotion(monthEvents);

  const dashboard: Dashboard = {
    todayEvents: motionToday,
    chartData: chartData,
    averageDailyMotion: averageDailyMotion,
  };

  return dashboard;
};
