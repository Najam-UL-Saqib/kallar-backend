import { HttpError } from "../middleware/errorHandler.js";
import { getOrFetchDaily } from "../cache/dailyContentCache.js";

// Wikimedia's API etiquette asks for a descriptive User-Agent identifying
// the calling application — some endpoints throttle/reject generic ones.
const WIKI_UA = "ApnaKallarSyedan/1.0 (https://apnakallarsyedan.com)";

// Kept to a small, generally family-friendly allowlist — combined with the
// nsfw/spoiler filter below, not a guarantee, but a reasonable default for
// a small-town community app with no manual moderation queue.
const MEME_SUBREDDITS = "wholesomememes+memes+funny";

// The original boredapi.com has a history of going down; this community
// fork is the commonly-used replacement. Try both, in order.
const BORED_API_URLS = [
  "https://bored-api.appbrewery.com/random",
  "https://www.boredapi.com/api/activity",
];

export async function getOnThisDay() {
  return getOrFetchDaily("on-this-day", async () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}`,
      { headers: { "User-Agent": WIKI_UA } },
    );
    if (!res.ok) throw new HttpError(502, "Couldn't load On This Day");
    const body = await res.json();
    const events = Array.isArray(body?.events) ? body.events : [];

    return events
      .filter((e) => e?.text)
      .sort(() => Math.random() - 0.5) // Wikipedia lists oldest-first; mix it up
      .slice(0, 8)
      .map((e) => {
        const page = e.pages?.[0];
        return {
          year:      e.year ?? null,
          text:      e.text,
          title:     page?.title ?? null,
          thumbnail: page?.thumbnail?.source ?? null,
          url:       page?.content_urls?.desktop?.page ?? null,
        };
      })
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  });
}

export async function getRandomCat() {
  const res = await fetch("https://api.thecatapi.com/v1/images/search");
  if (!res.ok) throw new HttpError(502, "Couldn't load a cat right now");
  const body = await res.json();
  const url = body?.[0]?.url;
  if (!url) throw new HttpError(502, "Couldn't load a cat right now");
  return { url };
}

export async function getRandomDog() {
  const res = await fetch("https://dog.ceo/api/breeds/image/random");
  if (!res.ok) throw new HttpError(502, "Couldn't load a dog right now");
  const body = await res.json();
  if (body?.status !== "success" || !body?.message) throw new HttpError(502, "Couldn't load a dog right now");
  return { url: body.message };
}

export async function getRandomMeme() {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(`https://meme-api.com/gimme/${MEME_SUBREDDITS}`);
    } catch {
      continue;
    }
    if (!res.ok) continue;
    const body = await res.json();
    if (body?.nsfw || body?.spoiler) continue; // re-roll rather than show it
    if (body?.url) {
      return {
        url:       body.url,
        title:     body.title ?? null,
        subreddit: body.subreddit ?? null,
        postLink:  body.postLink ?? null,
      };
    }
  }
  throw new HttpError(502, "Couldn't load a meme right now");
}

export async function getBoredActivity() {
  for (const url of BORED_API_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = await res.json();
      if (body?.activity) {
        return { activity: body.activity, type: body.type ?? null, participants: body.participants ?? null };
      }
    } catch {
      // try the next mirror
    }
  }
  throw new HttpError(502, "Couldn't load an activity right now");
}

export async function getApod(nasaApiKey) {
  return getOrFetchDaily("apod", async () => {
    const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(nasaApiKey)}`);
    if (!res.ok) throw new HttpError(502, "Couldn't load today's space photo");
    const body = await res.json();
    if (!body?.url) throw new HttpError(502, "Couldn't load today's space photo");
    return {
      title:       body.title ?? null,
      explanation: body.explanation ?? null,
      url:         body.url,
      hdurl:       body.hdurl ?? null,
      mediaType:   body.media_type ?? "image",
      date:        body.date ?? null,
      copyright:   body.copyright ?? null,
    };
  });
}
