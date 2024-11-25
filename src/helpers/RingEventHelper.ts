import * as fs from "fs";
import moment from "moment";
import path from "path";
import { RingCamera } from "ring-client-api";
import { promisify } from "util";
import { Chartdata } from "../interfaces/Chartdata.js";
import { Dashboard } from "../interfaces/dashboard.js";
import { Event } from "../interfaces/event.js";
import { getDirectoryUrl, saveImage } from "./ImageHelper.js";
import { Snapshot } from "../interfaces/Snapshot.js";

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

  const snapshotDirectory = `./snapshots/${dateTodayString}/${date}/`;

  if (!fs.existsSync(snapshotDirectory)) {
    fs.mkdirSync(snapshotDirectory);
  }

  for (let i = 0; i < 1; i++) {
    try {
      const result = await ringCamera.getSnapshot();

      saveImage(snapshotDirectory, date.toString() + `-${i}`, result);
    } catch (e) {
      console.log(e);
    }

    // Wait for the snapshot to be taken in intervals so we get different images
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  // EXPERIMENTAL, This is not as viable as the snapshots but still nice to have for the user

  await ringCamera.recordToFile(`${snapshotDirectory}video.mp4`, 60);
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
        const snapshotFiles = await readDirPromise(
          path.join(currentPath, event)
        );

        // Convert into base64
        const snapshots = snapshotFiles.map((snapshot: string) => {
          return {
            media: getDirectoryUrl(currentPath, event, snapshot),
            type:
              path.extname(snapshot) === ".mp4"
                ? ("video" as "video")
                : ("image" as "image"),
          };
        });
        return {
          id: event,
          day: day,
          snapshots: snapshots,
          hasVideo: snapshots.some((s) => s.type === "video"),
        };
      })
    );

    array.push({
      day: day,
      events: eventArray,
    });
  }

  return array;
};

export const getEvent = async (
  day: string,
  datetime: string
): Promise<Event> => {
  const directory = `.${path.sep}snapshots${path.sep}${day}${path.sep}${datetime}`;
  const readDirPromise = promisify(fs.readdir);

  const snapshotsDir = await readDirPromise(directory);
  let hasVideo = false;

  if (!fs.existsSync(directory)) {
    throw new Error("Not found");
  }

  let snapshots = snapshotsDir
    .filter((snapshot) => {
      const ext = path.extname(directory + path.sep + snapshot);
      if (ext == ".mp4") {
        hasVideo = true;
      }

      return ext !== ".mp4"; // Skip video files
    })
    .map((snapshot) => {
      const ext = path.extname(directory + path.sep + snapshot);

      return {
        media: getDirectoryUrl(directory, snapshot),
        type: ext == ".webp" ? "image" : ("video" as "video" | "image"),
      };
    })
    .filter((snapshot) => snapshot !== null);

  // We are only returning images, to keep the legacy code working
  snapshots = snapshots.filter((s) => {
    return s.type != "video";
  });

  // Only allow user to view a video, if its done recording and encoding
  const date = moment(parseInt(datetime)); // Parse the day
  const minutesAgo = moment().diff(date, "minutes");
  return {
    id: datetime,
    snapshots: snapshots,
    day: day,
    hasVideo: minutesAgo > 1 ? hasVideo : false,
  };
};

export const getVideo = async (
  day: string,
  datetime: string
): Promise<Snapshot> => {
  const directory = path.join("snapshots", day, datetime, "video.mp4");

  if (!fs.existsSync(directory)) {
    throw new Error("Not found");
  }

  return {
    media: getDirectoryUrl(directory),
    type: "video",
  };
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
        hasVideo: event.hasVideo, // False for now, not neccessary
      });
    });
  });

  const sortedEvents = events.sort((a, b) => {
    const dateA = moment(a.day, "DD-MM-YYYY"); // Adjust date format as needed
    const dateB = moment(b.day, "DD-MM-YYYY"); // Adjust date format as needed

    if (dateA.isBefore(dateB)) return -1;
    if (dateA.isAfter(dateB)) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  switch (order) {
    case "asc":
      return sortedEvents;
    case "desc":
      return sortedEvents.reverse();
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
  const motionToday = flattenEvents(await getEvents("today"), "desc");

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

export const deleteEvent = async (day: string, datetime: string) => {
  const directory = path.join("snapshots", day, datetime);
  console.log(directory);
  if (!fs.existsSync(directory)) {
    throw new Error("Not found");
  }

  fs.rmSync(directory, { recursive: true, force: true });
};
