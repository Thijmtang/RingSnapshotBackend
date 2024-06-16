import path from "path";
import { DataConfig } from "../interfaces/DataConfig.js";
import * as fs from "fs";

const getConfig = (): DataConfig => {
  const filePath = path.join(process.cwd(), "data.json");

  const data = fs.readFileSync(filePath, "utf8");
  const obj: DataConfig = JSON.parse(data);

  return obj;
};

const setConfig = (config: DataConfig) => {
  fs.writeFileSync(
    path.join(process.cwd(), "data.json"),
    JSON.stringify(config),
    "utf8"
  );
};

/**
 * Get the saved ring ding
 */
export const getLastTrackedEvent = async () => {
  const config = getConfig();
  return config.lastTrackedEventId;
};

/**
 * Get the saved ring ding
 */
export const saveLastTrackedEvent = async (id: string) => {
  const config = getConfig();
  config.lastTrackedEventId = id;
  setConfig(config);
};
