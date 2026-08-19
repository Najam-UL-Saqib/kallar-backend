import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { directorySubmitSchema } from "../utils/validators.js";
import { checkRateLimit, recordRateLimitEvent } from "../middleware/rateLimiter.js";
import { listDirectory, submitEntry } from "../services/directoryService.js";

export const list = asyncHandler(async (req, res) => {
  res.json(await listDirectory());
});

export const submit = asyncHandler(async (req, res) => {
  const parsed = directorySubmitSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid data");
  await checkRateLimit(req.userId, "directorySubmit");
  // Only record the quota hit once the submission actually succeeded — a
  // failed insert (bad data, a not-yet-run migration, ...) shouldn't burn
  // one of the user's 3 daily attempts.
  const entry = await submitEntry(req.userId, parsed.data);
  await recordRateLimitEvent(req.userId, "directorySubmit");
  res.status(201).json(entry);
});
