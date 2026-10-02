/* Rewrites src/data/trending.json from TMDB's weekly trending films.
   Each trending film is matched to the franchises it belongs to (by title
   and year), and franchises are ranked by how many of their films are
   trending and how high. Any empty spots are filled from the current list,
   so the homepage row is always full. Nothing else is touched. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KEY   = process.env.TMDB_API_KEY;
const BASE  = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const DIR   = process.env.FRANCHISE_DIR || 'src/data/franchises';
const OUT   = process.env.TRENDING_FILE || 'src/data/trending.json';
const DRY   = process.env.DRY_RUN === 'true';
const SLOTS = Number(process.env.SLOTS || 8);
const PAGES = 5;                                   // 20 films a page, so the top 100

if (!KEY) { console.error('No TMDB_API_KEY set. Add it as a repository secret.'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tmdb(pathAndQuery, attempt = 1){
  const url = `${BASE}${pathAndQuery}&api_key=${encodeURIComponent(KEY)}`;
  let res;
  try { res = await fetch(url); }
  catch (e) {
    if (attempt < 3) { await sleep(1000 * attempt); return tmdb(pathAndQuery, attempt + 1); }
    throw e;
  }
  if (res.status === 429) {
    if (attempt > 4) throw new Error('TMDB rate limit, gave up');
    await sleep(2000 * attempt);
    return tmdb(pathAndQuery, attempt + 1);
  }
  if (res.status === 401) throw new Error('TMDB rejected the key. Check it is the API Key (v3), not the Read Access Token.');
  if (!res.ok) throw new Error(`TMDB returned ${res.status}`);
  return res.json();
}

// "Mission: Impossible – Dead Reckoning" and "Mission Impossible Dead Reckoning"
// are the same film, and so are "Fantastic 4" and "Fantastic Four".
const NUMBERS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
const norm = t => t.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
  .split(' ').map(w => NUMBERS.includes(w) ? String(NUMBERS.indexOf(w)) : w).join(' ');

// Every film on the site, with the franchises it appears in.
const films = [];
for (const file of (await readdir(DIR)).filter(f => f.endsWith('.json')).sort()){
  const slug = file.replace(/\.json$/, '');
  const card = JSON.parse(await readFile(path.join(DIR, file), 'utf8'));
  for (const m of Object.values(card.films)) films.push({ slug, title: card.title, t: m.t, n: norm(m.t), y: m.y });
}
const slugs = new Set(films.map(f => f.slug));

// Same year (or one either side, as release dates vary by country), and the
// same title, or every word of the shorter title inside the longer one
// ("Star Wars" / "Star Wars: A New Hope", "Demon Slayer: Infinity Castle" /
// "Demon Slayer: Kimetsu no Yaiba Infinity Castle"). The shorter title needs two
// real words, or "The Ring" would match The Fellowship of the Ring, and a
// Japanese title that strips down to "0 0" would match M3GAN 2.0.
const FILLER = new Set(['the', 'a', 'an', 'of', 'and']);
function sameTitle(a, b){
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const shortWords = short.split(' ');
  const real = new Set(shortWords.filter(w => !FILLER.has(w) && /[a-z]/.test(w)));
  if (real.size < 2) return false;
  const words = new Set(long.split(' '));
  return shortWords.every(w => words.has(w));
}
function matches(movie){
  const year = Number((movie.release_date || '').slice(0, 4));
  if (!year) return [];
  const names = [...new Set([movie.title, movie.original_title].filter(Boolean).map(norm))];
  return films.filter(f => Math.abs(f.y - year) <= 1 && names.some(n => sameTitle(n, f.n)));
}

const trending = [];
for (let page = 1; page <= PAGES; page++){
  const data = await tmdb(`/trending/movie/week?page=${page}`);
  trending.push(...(data.results || []));
  await sleep(100);
}

// A film at number 1 scores 100, number 100 scores 1. Franchises add up their films.
const score = new Map(), why = new Map();
trending.forEach((movie, i) => {
  const hit = new Set(matches(movie).map(f => f.slug));
  for (const slug of hit){
    score.set(slug, (score.get(slug) || 0) + (trending.length - i));
    why.set(slug, [...(why.get(slug) || []), `#${i + 1} ${movie.title}`]);
  }
});

const ranked = [...score.keys()].sort((a, b) => score.get(b) - score.get(a));
const current = JSON.parse(await readFile(OUT, 'utf8')).filter(s => slugs.has(s));
const next = [...new Set([...ranked, ...current])].slice(0, SLOTS);

console.log(`Checked ${trending.length} trending films against ${films.length} films on the site.\n`);
next.forEach((slug, i) => console.log(
  `${String(i + 1).padStart(2)}. ${slug.padEnd(36)} ${why.has(slug) ? why.get(slug).join(', ') : '(kept from the previous list)'}`));

if (JSON.stringify(next) === JSON.stringify(current)) console.log('\nNo change to the trending list.');
else if (DRY) console.log('\nDRY RUN — nothing was written.');
else {
  await writeFile(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log(`\nWrote ${OUT}.`);
}
