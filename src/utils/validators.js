import { z } from "zod";

export const CATEGORIES = [
  "Community", "Culture", "Events", "News", "Heritage",
  "General", "DoYouKnow", "LostFound",
];

export const postCreateSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  content: z.string().trim().min(1, "Content is required").max(1000, "Content must be 1000 characters or fewer"),
  category: z.enum(CATEGORIES).optional().default("General"),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  poll_options: z.array(z.string().trim().min(1).max(120)).min(2).max(4).optional().nullable(),
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
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  poll_options: z.array(z.string().trim().min(1).max(120)).min(2).max(4).optional().nullable(),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1, "Comment text required").max(1000, "Comment too long"),
  authorName: z.string().trim().max(40).optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
});

export const reportSchema = z.object({
  reason: z.string().trim().max(300).optional().default(""),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1),
});

export const directorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(50),
  phone: z.string().trim().max(30).optional().nullable(),
  whatsapp: z.string().trim().max(30).optional().nullable(),
  description: z.string().trim().max(300).optional().nullable(),
});

// Categories a regular user can pick from when suggesting a directory listing.
// Kept as a fixed enum (unlike the admin schema's free-text category) so
// submissions stay tidy and easy to triage in the moderation queue.
export const DIRECTORY_CATEGORIES = ["Shop", "Doctor", "Restaurant", "Service", "Education", "Other"];

export const directorySubmitSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    category: z.enum(DIRECTORY_CATEGORIES).optional().default("Other"),
    phone: z.string().trim().max(30).optional().nullable(),
    whatsapp: z.string().trim().max(30).optional().nullable(),
    description: z.string().trim().max(300).optional().nullable(),
  })
  .refine((d) => !!(d.phone || d.whatsapp), {
    message: "Add a phone or WhatsApp number so people can reach them",
    path: ["phone"],
  });

export const MARKETPLACE_CATEGORIES = [
  "Electronics", "Furniture", "Vehicles", "Clothing",
  "Home & Garden", "Books & Hobbies", "Property", "Other",
];

export const marketplaceListingSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(1000),
  price: z.coerce.number().nonnegative().optional().nullable(),
  category: z.enum(MARKETPLACE_CATEGORIES).optional().default("Other"),
  condition: z.enum(["new", "used"]).optional().default("used"),
  location: z.string().trim().max(120).optional().nullable(),
  contact_phone: z.string().trim().max(30).optional().nullable(),
  contact_whatsapp: z.string().trim().max(30).optional().nullable(),
});

export const MAX_RAW_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB — raw upload ceiling (compression brings it to ≤1 MB)
export const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MB — post-compression ceiling
export const MAX_USER_POSTS_PER_DAY = 5;
export const MAX_USER_LISTINGS_PER_DAY = 5;

// Admin-authored trivia questions — deliberately not user-submitted (unlike
// directory listings), since a wrong "fact" presented as trivia is worse
// than no trivia at all.
export const triviaQuestionSchema = z
  .object({
    question: z.string().trim().min(1, "Question is required").max(300),
    options: z.array(z.string().trim().min(1).max(100)).min(2, "At least 2 options").max(4, "At most 4 options"),
    correct_index: z.number().int().min(0),
    category: z.string().trim().min(1).max(40).optional().default("General"),
    active: z.boolean().optional().default(true),
  })
  .refine((d) => d.correct_index < d.options.length, {
    message: "correct_index must point at one of the options",
    path: ["correct_index"],
  });
