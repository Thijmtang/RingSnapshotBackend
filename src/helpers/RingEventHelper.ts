import * as fs from "fs";

import moment from "moment";
import { RingCamera } from "ring-client-api";
import { encodeBase64, saveImage } from "./ImageHelper.js";
import { promisify } from "util";
import path from "path";

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
export const getEvents = async (startDate?: Date, endDate?: Date) => {
  let array: Array<{
    day: string;
    events: Array<{ id: string; snapshots: Array<string> }>;
  }> = [];

  const directory = `.${path.sep}snapshots`;
  const readDirPromise = promisify(fs.readdir);
  // const readFilePromise = promisify(fs.readFile);

  const days = await readDirPromise(directory);

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
