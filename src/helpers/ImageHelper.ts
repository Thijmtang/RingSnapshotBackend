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

export const encodeBase64 = (filePath: string) => {
  var imageAsBase64 = fs.readFileSync(filePath, "base64");

  return imageAsBase64;
};
