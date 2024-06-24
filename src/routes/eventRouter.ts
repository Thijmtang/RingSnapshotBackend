import express from "express";
import { Request, Response } from "express";
import {
  flattenEvents,
  getEvent,
  getEvents,
} from "../helpers/RingEventHelper.js";

const router = express.Router();

router.get("/all", async (request: Request, response: Response) => {
  const filter = request.query.filter ?? "";
  const order: "desc" | "asc" = request.query.order ?? "";

  const events = await getEvents(filter);

  const formattedEvents = flattenEvents(events, order);

  response.send(formattedEvents);
});

router.get("/:day/:datetime", async (request: Request, response: Response) => {
  const day = request.params.day;
  const datetime = request.params.datetime;

  const event = await getEvent(day, datetime);

  response.send(event);
});

export default router;
