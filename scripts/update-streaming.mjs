/* Rewrites src/data/streaming.json: where every film on the site can be
   streamed, rented or bought in each region, from TMDB's watch-provider data
   (supplied to TMDB by JustWatch, who must be credited wherever it's shown).

   Each film is matched to TMDB once by title and year, and its TMDB id is
   kept in the file so later runs only fetch availability. Nothing else is
   touched. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmdbClient, sleep } from './lib/tmdb.mjs';

const KEY   = process.env.TMDB_API_KEY;
const BASE  = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const DIR   = process.env.FRANCHISE_DIR || 'src/data/franchises';
const OUT   = process.env.STREAMING_FILE || 'src/data/streaming.json';
const DRY   = process.env.DRY_RUN === 'true';
const LIMIT = Number(process.env.ONLY_FIRST || 0);   // franchises, for a trial run
const REGIONS = { uk: 'GB', us: 'US' };              // site region -> TMDB country code

const tmdb = tmdbClient(KEY, BASE);
let old = { films: {} };
try { old = JSON.parse(await readFile(OUT, 'utf8')); } catch {}

// The year matters: there are three different films called "Halloween".
async function findId(title, year){
  const q = `/search/movie?query=${encodeURIComponent(title)}`;
  let data = await tmdb(`${q}&primary_release_year=${year}`);
  if (!(data.results || []).length) data = await tmdb(`${q}&year=${year}`);
  return (data.results || [])[0]?.id || null;
}

const providers = {};          // TMDB provider id -> { n: name, l: logo path }
const films = {};              // "franchise/film" -> { id, uk: {s,r,b}, us: {s,r,b} }
let looked = 0, matched = 0, failed = 0;

const files = (await readdir(DIR)).filter(f => f.endsWith('.json')).sort();
for (const file of LIMIT ? files.slice(0, LIMIT) : files){
  const slug = file.replace(/\.json$/, '');
  const card = JSON.parse(await readFile(path.join(DIR, file), 'utf8'));
  for (const [fid, m] of Object.entries(card.films)){
    const key = `${slug}/${fid}`;
    looked++;
    try {
      let id = old.films[key]?.id;
      if (!id) { id = await findId(m.t, m.y); await sleep(40); }
      if (!id) { failed++; continue; }
      const data = await tmdb(`/movie/${id}/watch/providers?`);
      await sleep(40);
      const entry = { id };
      for (const [region, country] of Object.entries(REGIONS)){
        const r = (data.results || {})[country];
        if (!r) continue;
        const ids = list => (list || []).map(p => {
          providers[p.provider_id] = { n: p.provider_name, l: p.logo_path };
          return p.provider_id;
        });
        const s = [...new Set([...ids(r.flatrate), ...ids(r.free), ...ids(r.ads)])];
        const rent = ids(r.rent), buy = ids(r.buy);
        if (s.length || rent.length || buy.length) entry[region] = { s, r: rent, b: buy };
      }
      films[key] = entry;
      matched++;
    } catch (e) {
      failed++;
      if (old.films[key]) films[key] = old.films[key];          // keep last week's data rather than lose it
      console.error(`  ! ${key} (${m.t}): ${e.message}`);
    }
  }
}

const next = { updated: new Date().toISOString().slice(0, 10), providers, films };
const same = JSON.stringify({ ...old, updated: '' }) === JSON.stringify({ ...next, updated: '' });

const count = region => Object.values(films).filter(f => f[region]?.s.length).length;
console.log(`Looked up ${looked} films: ${matched} matched on TMDB, ${failed} not found or failed.`);
for (const region of Object.keys(REGIONS)) console.log(`  ${region.toUpperCase()}: ${count(region)} films on at least one subscription service.`);
const top = Object.entries(providers).map(([id, p]) => [p.n, Object.values(films).filter(f => f.uk?.s.includes(+id)).length])
  .sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('  Biggest UK subscription services:', top.map(([n, c]) => `${n} (${c})`).join(', '));

if (same) console.log('\nNo change since last run.');
else if (DRY) console.log('\nDRY RUN — nothing was written.');
else { await writeFile(OUT, JSON.stringify(next) + '\n'); console.log(`\nWrote ${OUT}.`); }
