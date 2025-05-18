import getFolderSize from "get-folder-size";

export const getDirectorySizeInBytes = async (
  path: string,
  format: "bytes" | "megabyte"
): Promise<number> => {
  try {
    const size = await getFolderSize.loose(path);
    if (format === "megabyte") {
      return parseFloat((size / 1000 / 1000).toFixed(2));
    }
    return size ?? 0; // 1024000 //= 1MB
  } catch (err) {
    console.error(err);
    return 0;
  }
};
