import express from "express";
import { Request, Response } from "express";
import { getResourcesData } from "../helpers/RingEventHelper.js";

const router = express.Router();

router.get("/", async (request: Request, response: Response) => {
  const data = await getResourcesData();

  response.send(data);
});

export default router;
