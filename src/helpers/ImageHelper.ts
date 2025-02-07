import * as fs from "fs";

export const saveImage = (
  directory: string,
  fileName: string,
  image: string | NodeJS.ArrayBufferView
) => {
  const filePath = directory + fileName + ".webp";
  fs.writeFile(filePath, image, (err) => {
    if (err) throw err;
  });
};

/**
 *
 * @param filePath
 * @returns
 * @deprecated use getDirectoryUrl instead
 */
export const encodeBase64 = (filePath: string) => {
  var imageAsBase64 = fs.readFileSync(filePath, "base64");

  return imageAsBase64;
};

/**
 * Turn into a URL, which can be used to retrieve media
 */
export const getDirectoryUrl = (...paths) => {
  const seperator = "/";

  let directory = paths.join(seperator).replace(/\\/g, "/");
  directory = directory.replace("./", "");

  const imageHost = process.env.HOST;

  return imageHost + seperator + directory;
};
