import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getTodayQuestion, submitAnswer, getLeaderboard } from "../services/triviaService.js";

export const today = asyncHandler(async (req, res) => {
  res.json(await getTodayQuestion(req.userId ?? null));
});

export const answer = asyncHandler(async (req, res) => {
  const questionId = req.body?.question_id;
  const selectedIndex = Number(req.body?.selected_index);
  if (typeof questionId !== "string" || !questionId) throw new HttpError(400, "question_id is required");
  res.json(await submitAnswer(req.userId, questionId, selectedIndex));
});

export const leaderboard = asyncHandler(async (req, res) => {
  res.json(await getLeaderboard());
});
