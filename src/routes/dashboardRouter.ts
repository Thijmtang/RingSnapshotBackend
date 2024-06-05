import express from "express";
import { Request, Response } from "express";
import { getDashboardData } from "../helpers/RingEventHelper.js";

const router = express.Router();

router.get("/", async (request: Request, response: Response) => {
  const dashboard = await getDashboardData();

  response.send(dashboard);
});

export default router;
