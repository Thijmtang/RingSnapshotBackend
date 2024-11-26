import cors from "cors";
import * as dotenv from "dotenv";
import { auth } from "express-oauth2-jwt-bearer";
import express, { Request } from "express";
import Queue from "queue";
import {
  CameraEventOptions,
  CameraEventResponse,
  RingApi,
} from "ring-client-api";
import { saveEventImages } from "./helpers/RingEventHelper.js";
import eventRouter from "./routes/eventRouter.js";
import dashboardRouter from "./routes/dashboardRouter.js";
import {
  getLastTrackedEvent,
  saveLastTrackedEvent,
} from "./helpers/ConfigHelper.js";
import { promisify } from "util";
import { readFile, writeFile } from "fs";
import path from "path";
import { Server } from "socket.io";
import { createServer } from "node:http";

dotenv.config();

const corsOptions = {
  origin: process.env.SPA_FRONTEND,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const app = express();
const httpServer = createServer(app); // Create an HTTP server with Express

const io = new Server(httpServer, {
  transports: ["websocket"],
  cors: corsOptions,
});
const jwtCheck = auth({
  audience: process.env.AUTH0_IDENTIFIER,
  issuerBaseURL: process.env.AUTH0_DOMAIN,
  tokenSigningAlg: "RS256",
});

app.use(cors<Request>(corsOptions));

app.use(
  "/snapshots",
  (req, res, next) => {
    const referer = req.headers.referer;
    const allowedDomain = process.env.SPA_FRONTEND ?? "http://localhost:5173";

    // Since the api is hosted on the same domain, users can publicly access the files using the api/snapshots url, this is not alolowed
    if (req.url.includes(allowedDomain + "/api")) {
      return res.status(403).send("Forbidden");
    }

    // Check if the referer exists and matches the allowed domain
    if (referer?.startsWith(allowedDomain)) {
      next(); // Allow access
    } else {
      res.status(403).send("Forbidden");
    }
  },
  (req, res, next) => {
    // Allow range requests for video playback
    if (req.headers.range) {
      res.setHeader("Accept-Ranges", "bytes");
    }
    next();
  },
  express.static(path.join("snapshots"))
);

if (process.env.NODE_ENV == "PROD") {
  app.use(jwtCheck);
}

app.use(jwtCheck);

// Define routes
app.use("/dashboard", dashboardRouter);
app.use("/event", eventRouter);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
  console.log(`Express backend running on localhost:${PORT}`);
  // Run background processes to actively create snapshots when detecting motion.
  const queue = new Queue({ results: [] });
  queue.autostart = true;
  const ringApi = new RingApi({
    refreshToken: process.env.RING_REFRESH_TOKEN,
    cameraStatusPollingSeconds: 2,
  });
  const locations = await ringApi.getLocations();
  const location = locations[0];
  const ringDoorbell = location.cameras[0];
  // Configure the filters, for fetching the events
  const cameraOptions: CameraEventOptions = {
    limit: 1,
    state: "person_detected",
    kind: "motion",
  };
  ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
      console.log("Refresh Token Updated: ", newRefreshToken);
      // If you are implementing a project that use `ring-client-api`, you should subscribe to onRefreshTokenUpdated and update your config each time it fires an event
      // Here is an example using a .env file for configuration
      if (!oldRefreshToken) {
        return;
      }
      const currentConfig = await promisify(readFile)(".env"),
        updatedConfig = currentConfig
          .toString()
          .replace(oldRefreshToken, newRefreshToken);
      await promisify(writeFile)(".env", updatedConfig);
    }
  );
  try {
    // Polling
    ringDoorbell.onData.subscribe(async (data) => {
      // Fetch latest event on each poll
      ringDoorbell
        .getEvents(cameraOptions)
        .then(async (value: CameraEventResponse) => {
          const lastEvent = await getLastTrackedEvent();
          // We're only fetching the latest event
          const event = value.events[0];

          // Event has already been processed
          if (lastEvent === event.ding_id_str) {
            return;
          }

          await saveLastTrackedEvent(event.ding_id_str);

          // Add workload to queue
          queue.push(async () => {
            const date = Date.now();
            await saveEventImages(ringDoorbell, date);
            io.emit("motion");
          });
        })
        .catch((error) => {
          console.log("Error occurred:", error);
        });
    });
  } catch (Exception) {
    console.log(Exception);
  }
});
