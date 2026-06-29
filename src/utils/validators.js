import { z } from "zod";

export const CATEGORIES = [
  "Community", "Culture", "Events", "News", "Heritage",
  "General", "DoYouKnow", "LostFound",
];

export const postCreateSchema = z.object({
  title:        z.string().trim().max(200).optional().nullable(),
  content:      z.string().trim().min(1, "Content is required").max(1000, "Content must be 1000 characters or fewer"),
  category:     z.enum(CATEGORIES).optional().default("General"),
  event_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  poll_options: z.array(z.string().trim().min(1).max(120)).min(2).max(4).optional().nullable(),
});

export const postUpdateSchema = z.object({
  title:    z.string().trim().max(200).optional().nullable(),
  content:  z.string().trim().min(1, "Content is required").max(1000, "Content must be 1000 characters or fewer"),
  category: z.enum(CATEGORIES).optional().default("General"),
});

export const postAdminUpsertSchema = z.object({
  title:        z.string().trim().max(200).optional().nullable(),
  content:      z.string().trim().min(1).max(1000),
  category:     z.enum(CATEGORIES).optional().default("General"),
  image_url:    z.string().trim().url().optional().nullable(),
  author_name:  z.string().trim().min(1).max(80),
  event_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  poll_options: z.array(z.string().trim().min(1).max(120)).min(2).max(4).optional().nullable(),
});

export const commentSchema = z.object({
  text:       z.string().trim().min(1, "Comment text required").max(1000, "Comment too long"),
  authorName: z.string().trim().max(40).optional().nullable(),
  parent_id:  z.string().uuid().optional().nullable(),
});

export const reportSchema = z.object({
  reason: z.string().trim().max(300).optional().default(""),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1),
});

export const directorySchema = z.object({
  name:        z.string().trim().min(1).max(120),
  category:    z.string().trim().min(1).max(50),
  phone:       z.string().trim().max(30).optional().nullable(),
  whatsapp:    z.string().trim().max(30).optional().nullable(),
  description: z.string().trim().max(300).optional().nullable(),
});

export const MAX_IMAGE_BYTES     = 1 * 1024 * 1024; // 1 MB
export const MAX_USER_POSTS_PER_DAY = 5;
