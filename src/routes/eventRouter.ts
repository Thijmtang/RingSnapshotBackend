import express from "express";
import { Request, Response } from "express";
import { flattenEvents, getEvents } from "../helpers/RingEventHelper.js";

const router = express.Router();

router.get("/all", async (request: Request, response: Response) => {
  const filter = request.query.filter ?? "";
  const events = await getEvents(filter);

  const formattedEvents = flattenEvents(events);

  response.send(formattedEvents);
});

export default router;
