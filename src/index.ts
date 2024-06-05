import cors from "cors";
import * as dotenv from "dotenv";

import express, { Request } from "express";
import Queue from "queue";
import {
  CameraEventOptions,
  CameraEventResponse,
  RingApi,
} from "ring-client-api";
import { ExtendedResponse } from "ring-client-api/rest-client";
import { saveEventImages } from "./helpers/RingEventHelper.js";
import eventRouter from "./routes/eventRouter.js";
import dashboardRouter from "./routes/dashboardRouter.js";

dotenv.config();

const app = express();

const corsOptions = {
  origin: process.env.SPA_FRONTEND,
};

app.use(cors<Request>(corsOptions));

// Define routes
app.use("/dashboard", dashboardRouter);
app.use("/event", eventRouter);

const PORT = process.env.PORT || 3000;

// Allowed IPs
const allowedIPs = process.env.ALLOWED_IPS.split(",");

// Middleware to check IP address
// app.use((req, res, next) => {
//   const clientIP =
//     req.headers["x-forwarded-for"] || req.connection.remoteAddress;
//   if (allowedIPs.includes(clientIP)) {
//     next();
//   } else {
//     res.redirect("/404");
//   }
// });

app.listen(PORT, async () => {
  console.log("Express backend running on localhost:3000");

  // Run background processes to actively create snapshots when detecting motion.
  const queue = new Queue({ results: [] });
  queue.autostart = true;

  const ringApi = new RingApi({
    refreshToken: process.env.RING_REFRESH_TOKEN,
    cameraStatusPollingSeconds: 5,
  });

  const locations = await ringApi.getLocations();
  const location = locations[0];
  const ringDoorbell = location.cameras[0];

  let lastEvent: string = "";

  // Configure the filters, for fetching the events
  const cameraOptions: CameraEventOptions = {
    limit: 1,
    state: "person_detected",
    kind: "motion",
  };

  // Polling
  ringDoorbell.onData.subscribe((data) => {
    // Fetch latest event on each poll
    ringDoorbell
      .getEvents(cameraOptions)
      .then(async (value: CameraEventResponse & ExtendedResponse) => {
        // We're only fetching the latest event
        const event = value.events[0];

        // Event has already been processed
        if (lastEvent === event.ding_id_str || event.kind != "motion") {
          return;
        }

        // Some kind of event detected
        lastEvent = event.ding_id_str;

        // Add workload to queue
        queue.push(() => {
          const date = Date.now();
          saveEventImages(ringDoorbell, date);
        });

        await new Promise((resolve) => setTimeout(resolve, 5000));
      });
  });
});
