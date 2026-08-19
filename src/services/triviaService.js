import { supabaseAdmin } from "../config/supabase.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getOrFetchDaily, invalidateDaily } from "../cache/dailyContentCache.js";

const ACTIVE_CACHE_KEY = "trivia:active-questions";

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Cheap string hash so the day->question mapping isn't just "day of year
// mod count" (which would repeat in the exact same order every year).
function dayHash(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return h;
}

async function getActiveQuestions() {
  return getOrFetchDaily(ACTIVE_CACHE_KEY, async () => {
    const { data, error } = await supabaseAdmin
      .from("trivia_questions")
      .select("id, question, options, correct_index, category")
      .eq("active", true)
      .order("created_at");
    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  });
}

// Deterministic pick: every visitor sees the same question on a given UTC
// day, and it advances at midnight with no cron job needed.
async function todaysQuestionRow() {
  const list = await getActiveQuestions();
  if (list.length === 0) return null;
  return list[dayHash(todayKey()) % list.length];
}

export async function getTodayQuestion(userId) {
  const q = await todaysQuestionRow();
  if (!q) return { question: null, answered: null };

  let answered = null;
  if (userId) {
    const { data, error } = await supabaseAdmin
      .from("trivia_answers")
      .select("selected_index, correct")
      .eq("user_id", userId)
      .eq("quiz_date", todayKey())
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    answered = data ?? null;
  }

  return {
    question: {
      id: q.id,
      question: q.question,
      options: q.options,
      category: q.category,
      // Only reveal the answer key once this user has already answered today
      // — otherwise a curious look at the network tab would spoil it.
      correct_index: answered ? q.correct_index : null,
    },
    answered: answered ? { selected_index: answered.selected_index, correct: answered.correct } : null,
  };
}

export async function submitAnswer(userId, questionId, selectedIndex) {
  const q = await todaysQuestionRow();
  if (!q || q.id !== questionId) throw new HttpError(400, "That's not today's question");
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= q.options.length) {
    throw new HttpError(400, "Invalid answer");
  }

  const date = todayKey();
  const { data: existing, error: existErr } = await supabaseAdmin
    .from("trivia_answers")
    .select("id")
    .eq("user_id", userId)
    .eq("quiz_date", date)
    .maybeSingle();
  if (existErr) throw new HttpError(500, existErr.message);
  if (existing) throw new HttpError(409, "You've already answered today's question");

  const correct = selectedIndex === q.correct_index;
  const { error: insErr } = await supabaseAdmin
    .from("trivia_answers")
    .insert({ user_id: userId, question_id: q.id, quiz_date: date, selected_index: selectedIndex, correct });
  if (insErr) throw new HttpError(500, insErr.message);

  const [streak, totalCorrect] = await Promise.all([computeStreak(userId), computeTotalCorrect(userId)]);
  return { correct, correct_index: q.correct_index, streak, total_correct: totalCorrect };
}

async function computeTotalCorrect(userId) {
  const { count, error } = await supabaseAdmin
    .from("trivia_answers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("correct", true);
  if (error) throw new HttpError(500, error.message);
  return count ?? 0;
}

async function computeStreak(userId) {
  const { data, error } = await supabaseAdmin
    .from("trivia_answers")
    .select("quiz_date")
    .eq("user_id", userId)
    .order("quiz_date", { ascending: false })
    .limit(60);
  if (error) throw new HttpError(500, error.message);
  if (!data || data.length === 0) return 0;

  const dates = new Set(data.map((r) => r.quiz_date));
  let streak = 0;
  const cursor = new Date(`${todayKey()}T00:00:00Z`);
  // We just recorded today's answer, so today must be in the set — walk
  // backward one day at a time while consecutive dates keep showing up.
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function getLeaderboard(limit = 10) {
  // Small-town scale — a few thousand answer rows at most — so aggregating
  // in JS is fine; the cap just guards against unbounded growth over years.
  const { data, error } = await supabaseAdmin
    .from("trivia_answers")
    .select("user_id, correct")
    .eq("correct", true)
    .limit(20_000);
  if (error) throw new HttpError(500, error.message);

  const counts = new Map();
  for (const row of data ?? []) counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return [];

  const { data: profiles, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", top.map(([id]) => id));
  if (profErr) throw new HttpError(500, profErr.message);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return top.map(([user_id, score], i) => ({
    rank: i + 1,
    user_id,
    name: profileById.get(user_id)?.name ?? "Community Member",
    avatar_url: profileById.get(user_id)?.avatar_url ?? null,
    score,
  }));
}

// ─── Admin question management ────────────────────────────────────────────

export async function adminListQuestions() {
  const { data, error } = await supabaseAdmin
    .from("trivia_questions")
    .select("id, question, options, correct_index, category, active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, error.message);
  return data ?? [];
}

export async function createQuestion({ question, options, correct_index, category, active }) {
  const { data, error } = await supabaseAdmin
    .from("trivia_questions")
    .insert({ question, options, correct_index, category, active })
    .select()
    .single();
  if (error) throw new HttpError(500, error.message);
  invalidateDaily(ACTIVE_CACHE_KEY);
  return data;
}

export async function updateQuestion(id, { question, options, correct_index, category, active }) {
  const { data, error } = await supabaseAdmin
    .from("trivia_questions")
    .update({ question, options, correct_index, category, active })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new HttpError(500, error.message);
  invalidateDaily(ACTIVE_CACHE_KEY);
  return data;
}

export async function deleteQuestion(id) {
  const { error } = await supabaseAdmin.from("trivia_questions").delete().eq("id", id);
  if (error) throw new HttpError(500, error.message);
  invalidateDaily(ACTIVE_CACHE_KEY);
  return { ok: true };
}
