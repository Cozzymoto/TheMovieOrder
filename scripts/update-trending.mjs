/* Rewrites src/data/trending.json from TMDB's weekly trending films.
   Each trending film is matched to the franchises it belongs to (by title
   and year), and franchises are ranked by how many of their films are
   trending and how high. Any empty spots are filled from the current list,
   so the homepage row is always full. Nothing else is touched. */
import { readFile, writeFile } from 'node:fs/promises';
import { tmdbClient, sleep, siteFilms } from './lib/tmdb.mjs';

const KEY   = process.env.TMDB_API_KEY;
const BASE  = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const DIR   = process.env.FRANCHISE_DIR || 'src/data/franchises';
const OUT   = process.env.TRENDING_FILE || 'src/data/trending.json';
const DRY   = process.env.DRY_RUN === 'true';
const SLOTS = Number(process.env.SLOTS || 8);
const PAGES = 5;                                   // 20 films a page, so the top 100

const tmdb = tmdbClient(KEY, BASE);
const { films, matches, byFranchiseName } = await siteFilms(DIR);
const slugs = new Set(films.map(f => f.slug));

const trending = [];
for (let page = 1; page <= PAGES; page++){
  const data = await tmdb(`/trending/movie/week?page=${page}`);
  trending.push(...(data.results || []));
  await sleep(100);
}

// Which franchises a trending film belongs to. First by matching the film
// itself; if it's a new release the site doesn't list yet (Avengers: Doomsday),
// by TMDB's collection: if any other film in its collection is on a franchise
// page, the new film counts for that franchise.
const collections = new Map();
async function franchisesFor(movie){
  const direct = new Set(matches(movie).map(f => f.slug));
  if (direct.size || !movie.id) return { slugs: direct, via: 'title' };
  const details = await tmdb(`/movie/${movie.id}?language=en-US`);
  await sleep(60);
  const c = details.belongs_to_collection;
  if (c){
    if (!collections.has(c.id)){
      collections.set(c.id, (await tmdb(`/collection/${c.id}?language=en-US`)).parts || []);
      await sleep(60);
    }
    const slugs = new Set(collections.get(c.id).filter(p => p.id !== movie.id).flatMap(p => matches(p).map(f => f.slug)));
    if (slugs.size) return { slugs, via: c.name };
  }
  return { slugs: byFranchiseName(movie), via: 'franchise name' };
}

const found = [];
for (const movie of trending){
  try { found.push(await franchisesFor(movie)); }
  catch (e) { console.error(`  ! ${movie.title}: ${e.message}`); found.push({ slugs: new Set(), via: null }); }
}

// A film at number 1 scores 100, number 100 scores 1. Franchises add up their films.
const score = new Map(), why = new Map();
trending.forEach((movie, i) => {
  for (const slug of found[i].slugs){
    score.set(slug, (score.get(slug) || 0) + (trending.length - i));
    why.set(slug, [...(why.get(slug) || []), `#${i + 1} ${movie.title}`]);
  }
});

const ranked = [...score.keys()].sort((a, b) => score.get(b) - score.get(a));
const current = JSON.parse(await readFile(OUT, 'utf8')).filter(s => slugs.has(s));
const next = [...new Set([...ranked, ...current])].slice(0, SLOTS);

console.log(`This week's top 25 on TMDB, and the franchise each one counts for:`);
trending.slice(0, 25).forEach((m, i) => {
  const { slugs, via } = found[i];
  const to = slugs.size ? `→ ${[...slugs].join(', ')}${via !== 'title' ? ` (via ${via})` : ''}` : '';
  console.log(`  ${String(i + 1).padStart(2)}. ${`${m.title} (${(m.release_date || '').slice(0, 4) || '?'})`.padEnd(44)} ${to}`);
});
console.log(`\nChecked ${trending.length} trending films against ${films.length} films on the site.\n`);
next.forEach((slug, i) => console.log(
  `${String(i + 1).padStart(2)}. ${slug.padEnd(36)} ${why.has(slug) ? why.get(slug).join(', ') : '(kept from the previous list)'}`));

if (JSON.stringify(next) === JSON.stringify(current)) console.log('\nNo change to the trending list.');
else if (DRY) console.log('\nDRY RUN — nothing was written.');
else {
  await writeFile(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log(`\nWrote ${OUT}.`);
}
