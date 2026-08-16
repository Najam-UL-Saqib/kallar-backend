import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { directorySubmitSchema } from "../utils/validators.js";
import { enforceRateLimit } from "../middleware/rateLimiter.js";
import { listDirectory, submitEntry } from "../services/directoryService.js";

export const list = asyncHandler(async (req, res) => {
  res.json(await listDirectory());
});

export const submit = asyncHandler(async (req, res) => {
  const parsed = directorySubmitSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid data");
  await enforceRateLimit(req.userId, "directorySubmit");
  res.status(201).json(await submitEntry(req.userId, parsed.data));
});
