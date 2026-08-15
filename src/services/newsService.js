import { HttpError } from "../middleware/errorHandler.js";
import { getOrFetchWithTtl } from "../cache/ttlCache.js";

// Real Urdu-language outlets — free, no API key, no request quota, unlike
// most "news API" products (which either require a signup+key, cap out at
// ~100-200 requests/day on the free tier, or explicitly forbid production
// use on their free plan). Both already publish in Urdu, so there's no
// translation step needed.
const NEWS_SOURCES = [
  // BBC's Urdu-language edition — a single stable, authoritative source.
  { name: "BBC Urdu", url: "https://feeds.bbci.co.uk/urdu/rss.xml" },
  // Google News' Pakistan/Urdu edition — aggregates Dawn, Jang, Geo, Express
  // and other local outlets, giving broader regional coverage than one site.
  { name: "Google News (Pakistan)", url: "https://news.google.com/rss?hl=ur-PK&gl=PK&ceid=PK:ur" },
];

const NEWS_TTL_MS = 20 * 60_000; // 20 min — news should feel fresh, not hammer the feeds
const ITEMS_PER_SOURCE = 8;
const MAX_ITEMS = 20;

// A generic User-Agent identifying a real browser — some feeds throttle
// obviously-scripted clients more aggressively than a normal reader request.
const UA = "Mozilla/5.0 (compatible; ApnaKallarSyedanBot/1.0; +https://apnakallarsyedan.com)";

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;/g, "'")
    .replace(/<[^>]+>/g, "") // strip any residual markup (some feeds put HTML in <description>)
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return null;
  let val = m[1].trim();
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) val = cdata[1].trim();
  return decodeEntities(val) || null;
}

// Minimal, dependency-free RSS 2.0 item extractor — deliberately not a full
// XML parser, just enough structure to read <item><title>/<link>/<pubDate>.
function parseRssItems(xml, sourceName, limit) {
  const items = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) && items.length < limit) {
    const block = m[1];
    const title = extractTag(block, "title");
    const link  = extractTag(block, "link");
    if (!title || !link) continue;
    items.push({
      title,
      link,
      pubDate: extractTag(block, "pubDate"),
      source:  sourceName,
    });
  }
  return items;
}

async function fetchSource({ name, url }) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${name} responded ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, name, ITEMS_PER_SOURCE);
}

export async function getUrduNews() {
  return getOrFetchWithTtl("urdu-news", NEWS_TTL_MS, async () => {
    const results = await Promise.allSettled(NEWS_SOURCES.map(fetchSource));
    const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (items.length === 0) throw new HttpError(502, "Couldn't load news right now");

    items.sort((a, b) => {
      const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
      const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });

    return { items: items.slice(0, MAX_ITEMS), updatedAt: new Date().toISOString() };
  });
}
