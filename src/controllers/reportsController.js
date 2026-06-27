import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { enforceRateLimit } from "../middleware/rateLimiter.js";
import { reportSchema } from "../utils/validators.js";
import { createReport } from "../services/reportsService.js";

export const reportPost = asyncHandler(async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message || "Invalid report");
  }
  await enforceRateLimit(req.userId, "report");
  const result = await createReport(req.params.id, req.userId, parsed.data.reason);
  res.status(201).json(result);
});
