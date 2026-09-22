/* Fills in missing posters for every franchise card, from TMDB.
   Only ever ADDS a `poster` field. Titles, years, settings, orderings
   and notes are never touched, and posters already chosen are kept. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KEY   = process.env.TMDB_API_KEY;
const BASE  = process.env.TMDB_BASE || 'https://api.themoviedb.org/3';
const DIR   = process.env.FRANCHISE_DIR || 'src/data/franchises';
const DRY   = process.env.DRY_RUN === 'true';
const LIMIT = Number(process.env.ONLY_FIRST || 0);   // for a small test run

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
  if (res.status === 429) {                       // rate limited — back off and retry
    if (attempt > 4) throw new Error('TMDB rate limit, gave up');
    await sleep(2000 * attempt);
    return tmdb(pathAndQuery, attempt + 1);
  }
  if (res.status === 401) throw new Error('TMDB rejected the key. Check it is the API Key (v3), not the Read Access Token.');
  if (!res.ok) throw new Error(`TMDB returned ${res.status}`);
  return res.json();
}

// The year matters: there are three different films called "Halloween".
async function findPoster(title, year){
  const q = `/search/movie?query=${encodeURIComponent(title)}`;
  let data = year ? await tmdb(`${q}&primary_release_year=${year}`) : await tmdb(q);
  if (year && !(data.results || []).length) data = await tmdb(`${q}&year=${year}`);
  const hit = (data.results || []).find(r => r.poster_path);
  return hit ? hit.poster_path : null;
}

// Keep the same key order the Content Studio writes, so files stay consistent.
function tidy(card){
  const out = {};
  for (const k of ['title','short','hue','blurb','rank','poster','tmdb']) if (card[k] !== undefined) out[k] = card[k];
  out.films = card.films; out.release = card.release; out.chrono = card.chrono;
  if (card.note !== undefined) out.note = card.note;
  return out;
}

const files = (await readdir(DIR)).filter(f => f.endsWith('.json')).sort();
const todo = LIMIT ? files.slice(0, LIMIT) : files;
let added = 0, changedFiles = 0, scanned = 0;
const missed = [];

for (const file of todo){
  const full = path.join(DIR, file);
  const card = JSON.parse(await readFile(full, 'utf8'));
  let touched = false;

  for (const id of card.release){
    const film = card.films[id];
    if (!film || film.poster) continue;            // already has one — leave it alone
    scanned++;
    let poster = null;
    try { poster = await findPoster(film.t, film.y); }
    catch (e) { console.error(`  ! ${file} ${film.t}: ${e.message}`); }
    if (poster){ film.poster = poster; added++; touched = true; }
    else missed.push(`${file.replace('.json','')} — ${film.t}${film.y ? ` (${film.y})` : ''}`);
    await sleep(60);                               // be polite to TMDB
  }

  if (!card.poster){                               // franchise cover = first film with art
    const first = card.release.map(id => card.films[id]).find(m => m && m.poster);
    if (first){ card.poster = first.poster; touched = true; }
  }

  if (touched){
    changedFiles++;
    if (!DRY) await writeFile(full, JSON.stringify(tidy(card), null, 2) + '\n');
    console.log(`${card.poster ? '✓' : '·'} ${file.padEnd(38)} ${Object.values(card.films).filter(m => m.poster).length}/${card.release.length}`);
  }
}

console.log(`\nLooked up ${scanned} films across ${todo.length} franchises.`);
console.log(`Added ${added} posters, changed ${changedFiles} files.`);
if (missed.length){
  console.log(`\nNot found (${missed.length}) — these keep their coloured tile:`);
  missed.forEach(m => console.log('  ' + m));
}
if (DRY) console.log('\nDRY RUN — nothing was written.');
