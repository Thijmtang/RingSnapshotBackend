import express from "express";
import { Request, Response } from "express";
import {
  flattenEvents,
  getEvent,
  getEvents,
  getVideo,
} from "../helpers/RingEventHelper.js";

const router = express.Router();

router.get("/all", async (request: Request, response: Response) => {
  const filter = request.query.filter ?? "";
  const order: "desc" | "asc" = request.query.order ?? "";

  const events = await getEvents(filter);

  const formattedEvents = flattenEvents(events, order);

  response.send(formattedEvents);
});

/**
 * Retrieve all the snapshot images of the event
 */
router.get("/:day/:datetime", async (request: Request, response: Response) => {
  const day = request.params.day;
  const datetime = request.params.datetime;

  const event = await getEvent(day, datetime);

  response.send(event);
});

/**
 * Returns a recorded video of the event
 */
router.get(
  "/:day/:datetime/video",
  async (request: Request, response: Response) => {
    // response.setHeader("Content-Type", "video/mp4"); // Set the correct content type
    const day = request.params.day;
    const datetime = request.params.datetime;

    try {
      const video = await getVideo(day, datetime);

      response.send(video);
    } catch (error) {
      console.log(error);
      response.status(404).json({ error: "Video not found" });
    }
  }
);

export default router;
