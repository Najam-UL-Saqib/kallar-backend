import { z } from "zod";

export const CATEGORIES = ["Community", "Culture", "Events", "News", "Heritage", "General", "DoYouKnow"];

export const postCreateSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  content: z.string().trim().min(1, "Content is required").max(1000, "Content must be 1000 characters or fewer"),
  category: z.enum(CATEGORIES).optional().default("General"),
});

export const postUpdateSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  content: z.string().trim().min(1, "Content is required").max(1000, "Content must be 1000 characters or fewer"),
  category: z.enum(CATEGORIES).optional().default("General"),
});

export const postAdminUpsertSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  content: z.string().trim().min(1).max(1000),
  category: z.enum(CATEGORIES).optional().default("General"),
  image_url: z.string().trim().url().optional().nullable(),
  author_name: z.string().trim().min(1).max(80),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1, "Comment text required").max(1000, "Comment too long"),
  authorName: z.string().trim().max(40).optional().nullable(),
});

export const reportSchema = z.object({
  reason: z.string().trim().max(300).optional().default(""),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1),
});

export const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1MB
export const MAX_USER_POSTS_PER_DAY = 5;
