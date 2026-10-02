/* Reports recent films that belong to a franchise on the site but aren't on
   its page yet. Changes nothing — it only prints a list to review.

   For each franchise, every film is looked up on TMDB to find the TMDB
   collections it belongs to. Any film in those collections released since
   SINCE that isn't on the page is reported. Then each franchise's own name is
   searched for in recent years, to catch reboots TMDB files separately
   (Resident Evil, 2026). */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmdbClient, sleep, siteFilms, norm, FILLER } from './lib/tmdb.mjs';

const KEY   = process.env.TMDB_API_KEY;
const BASE  = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const DIR   = process.env.FRANCHISE_DIR || 'src/data/franchises';
const SINCE = Number(process.env.SINCE || 2025);
const REPORT = process.env.REPORT_FILE || '';      // when set, write a Markdown summary here if anything released is missing
const IGNORE = JSON.parse(await readFile(process.env.IGNORE_FILE || 'scripts/missing-films-ignore.json', 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const tmdb = tmdbClient(KEY, BASE);
const { matches } = await siteFilms(DIR);

const year = d => Number((d || '').slice(0, 4));
const found = new Map();                           // slug -> Map(tmdb id -> film)
function report(slug, m, via){
  if ((IGNORE[slug] || []).some(x => x.id === m.id)) return;
  if (!found.has(slug)) found.set(slug, new Map());
  if (found.get(slug).has(m.id)) return;
  found.get(slug).set(m.id, {
    id: m.id, title: m.title, date: m.release_date || '', status: m.release_date && m.release_date <= today ? 'released' : 'upcoming',
    poster: m.poster_path || null, via, overview: (m.overview || '').slice(0, 220)
  });
}

const collections = new Map();                     // collection id -> parts
async function collectionOf(title, y){
  const q = `/search/movie?query=${encodeURIComponent(title)}`;
  let data = await tmdb(`${q}&primary_release_year=${y}`);
  if (!(data.results || []).length) data = await tmdb(`${q}&year=${y}`);
  const hit = (data.results || [])[0];
  await sleep(40);
  if (!hit) return null;
  const details = await tmdb(`/movie/${hit.id}?language=en-US`);
  await sleep(40);
  const c = details.belongs_to_collection;
  if (!c) return null;
  if (!collections.has(c.id)){
    collections.set(c.id, { name: c.name, parts: (await tmdb(`/collection/${c.id}?language=en-US`)).parts || [] });
    await sleep(40);
  }
  return c.id;
}

const files = (await readdir(DIR)).filter(f => f.endsWith('.json')).sort();
let done = 0;
for (const file of files){
  const slug = file.replace(/\.json$/, '');
  const card = JSON.parse(await readFile(path.join(DIR, file), 'utf8'));

  // 1. Films in the same TMDB collections as this franchise's films.
  const ids = new Set();
  for (const m of Object.values(card.films)){
    try { const id = await collectionOf(m.t, m.y); if (id) ids.add(id); }
    catch (e) { console.error(`  ! ${slug} — ${m.t}: ${e.message}`); }
  }
  for (const id of ids){
    const { name, parts } = collections.get(id);
    // Skip parts from a year this franchise already has a film for: almost always
    // the same film under another title (Zootopia 2 is Zootropolis 2 in the UK).
    const years = new Set(Object.values(card.films).map(m => m.y));
    for (const p of parts) if (year(p.release_date) >= SINCE && !years.has(year(p.release_date)) && !matches(p).length) report(slug, p, `collection: ${name}`);
  }

  // 2. Recent films named after the franchise ("Resident Evil", "Toy Story 5").
  const name = norm(card.title);
  const twoWords = name.split(' ').filter(w => !FILLER.has(w)).length >= 2;
  for (let y = SINCE; y <= SINCE + 2; y++){
    try {
      const data = await tmdb(`/search/movie?query=${encodeURIComponent(card.title)}&primary_release_year=${y}`);
      await sleep(40);
      for (const r of data.results || []){
        const n = norm(r.title);
        if ((n === name || (twoWords && n.startsWith(name + ' '))) && (r.popularity || 0) >= 2 && !matches(r).length)
          report(slug, r, 'franchise name');
      }
    } catch (e) { console.error(`  ! ${slug} — name search ${y}: ${e.message}`); }
  }

  if (++done % 50 === 0) console.log(`…checked ${done} of ${files.length} franchises`);
}

console.log(`\nFilms since ${SINCE} that aren't on their franchise page yet:\n`);
let count = 0;
for (const [slug, list] of [...found].sort()){
  console.log(slug);
  for (const f of [...list.values()].sort((a, b) => a.date.localeCompare(b.date))){
    count++;
    console.log(`   ${f.status === 'released' ? '●' : '○'} ${f.title} (${f.date || 'no date'})  [${f.via}]`);
  }
}
console.log(`\n${count} films across ${found.size} franchises. ● released   ○ not out yet`);

// A Markdown summary for the weekly GitHub issue. Only written when a film
// that's already out is missing; films still to come are listed underneath.
const all = [...found].sort().flatMap(([slug, list]) => [...list.values()].map(f => ({ slug, ...f })));
const out = all.filter(f => f.status === 'released'), soon = all.filter(f => f.status === 'upcoming');
if (REPORT && out.length){
  const line = f => `- **${f.title}** (${f.date || 'no date'}) → \`${f.slug}\` · [TMDB](https://www.themoviedb.org/movie/${f.id})`;
  const md = [
    `${out.length} film${out.length === 1 ? '' : 's'} released since ${SINCE} ${out.length === 1 ? 'isn\'t' : 'aren\'t'} on their franchise page yet.`,
    '', '## Out now', ...out.map(line),
    ...(soon.length ? ['', '<details><summary>Coming later (' + soon.length + ')</summary>', '', ...soon.map(line), '', '</details>'] : []),
    '', 'If one of these doesn\'t belong, add its TMDB id to `scripts/missing-films-ignore.json` and it won\'t be flagged again.',
    '', `_Checked ${today} by the "Find missing films" workflow._`
  ].join('\n');
  await writeFile(REPORT, md + '\n');
  console.log(`\nWrote ${REPORT}.`);
}

// Machine-readable copy, for adding the films.
console.log('\n----- JSON -----');
console.log(JSON.stringify(Object.fromEntries([...found].map(([s, l]) => [s, [...l.values()]]))));
