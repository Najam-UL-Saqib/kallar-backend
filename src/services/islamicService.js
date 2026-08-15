import { HttpError } from "../middleware/errorHandler.js";
import { getOrFetchDaily } from "../cache/dailyContentCache.js";

// Total ayahs in the Quran / hadiths in the standard Sahih al-Bukhari
// numbering used by these APIs — used only to pick which number to request.
const TOTAL_AYAHS    = 6236;
const BUKHARI_COUNT  = 7563;

// Deterministic per-day pick so every visitor sees the same Ayah/Hadith all
// day (and it changes tomorrow) without needing a database row for it.
function dailySeed(salt) {
  const day = new Date().toISOString().slice(0, 10); // UTC date
  const str = day + salt;
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (Math.imul(hash, 31) + str.charCodeAt(i)) >>> 0;
  return hash;
}

async function fetchAyah() {
  const ayahNumber = 1 + (dailySeed("ayah") % TOTAL_AYAHS);
  const res = await fetch(
    `https://api.alquran.cloud/v1/ayah/${ayahNumber}/editions/quran-uthmani,en.sahih,ur.jalandhry`,
  );
  if (!res.ok) throw new HttpError(502, "Couldn't load Ayah of the Day");
  const body = await res.json();
  const editions = Array.isArray(body?.data) ? body.data : [];
  const byEdition = (id) => editions.find((e) => e?.edition?.identifier === id);

  const arabic = byEdition("quran-uthmani");
  const en     = byEdition("en.sahih");
  const ur     = byEdition("ur.jalandhry");
  if (!arabic?.text) throw new HttpError(502, "Couldn't load Ayah of the Day");

  return {
    surahName:     arabic.surah?.englishName ?? null,
    surahNumber:   arabic.surah?.number ?? null,
    ayahNumber:    arabic.numberInSurah ?? null,
    reference:     arabic.surah ? `${arabic.surah.englishName} ${arabic.surah.number}:${arabic.numberInSurah}` : null,
    arabic:        arabic.text,
    translationEn: en?.text ?? null,
    translationUr: ur?.text ?? null,
  };
}

async function fetchHadith() {
  const number = 1 + (dailySeed("hadith") % BUKHARI_COUNT);
  const res = await fetch(`https://api.hadith.gading.dev/books/bukhari/${number}`);
  if (!res.ok) throw new HttpError(502, "Couldn't load Hadith of the Day");
  const body = await res.json();
  const hadith = body?.data?.hadiths?.[0];
  if (!hadith?.arab) throw new HttpError(502, "Couldn't load Hadith of the Day");

  // The source API only ships an Arabic text field (its "translation" field
  // is Indonesian, not English/Urdu) — rather than guessing at a translation
  // ourselves, we show the Arabic + a citation and link out to the book on
  // sunnah.com for readers who want a translated version.
  return {
    book:      body?.data?.name ?? "Sahih al-Bukhari",
    number:    hadith.number ?? number,
    arabic:    hadith.arab,
    sourceUrl: "https://sunnah.com/bukhari",
  };
}

// Never throws — a single failed source just comes back null so the UI can
// show one card successfully even if the other source is down.
export async function getIslamicContent() {
  const [ayahResult, hadithResult] = await Promise.allSettled([
    getOrFetchDaily("ayah",   fetchAyah),
    getOrFetchDaily("hadith", fetchHadith),
  ]);
  return {
    ayah:   ayahResult.status   === "fulfilled" ? ayahResult.value   : null,
    hadith: hadithResult.status === "fulfilled" ? hadithResult.value : null,
  };
}
