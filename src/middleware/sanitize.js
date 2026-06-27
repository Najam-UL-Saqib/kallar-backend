import sanitizeHtml from "sanitize-html";

// Strips all HTML/script content from free-text fields before they reach the
// DB or get echoed back — content is plain text only, no rich formatting.
export function sanitizeText(value) {
  if (typeof value !== "string") return value;
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}
