import { asyncHandler } from "../utils/asyncHandler.js";
import { listDirectory } from "../services/directoryService.js";

export const list = asyncHandler(async (req, res) => {
  res.json(await listDirectory());
});
