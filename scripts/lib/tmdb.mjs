/* Shared by the TMDB scripts: a small TMDB client, and matching TMDB films
   against the films already on the site. */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function tmdbClient(KEY, BASE = 'https://api.themoviedb.org/3'){
  if (!KEY) { console.error('No TMDB_API_KEY set. Add it as a repository secret.'); process.exit(1); }
  return async function tmdb(pathAndQuery, attempt = 1){
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
  };
}

// "Mission: Impossible – Dead Reckoning" and "Mission Impossible Dead Reckoning"
// are the same film, and so are "Fantastic 4" and "Fantastic Four".
export const NUMBERS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
export const norm = t => t.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
  .split(' ').map(w => NUMBERS.includes(w) ? String(NUMBERS.indexOf(w)) : w).join(' ');

// Two normalised titles name the same film if they're identical, or every word
// of the shorter title is inside the longer one
// ("Star Wars" / "Star Wars: A New Hope", "Demon Slayer: Infinity Castle" /
// "Demon Slayer: Kimetsu no Yaiba Infinity Castle"). The shorter title needs two
// real words, or "The Ring" would match The Fellowship of the Ring, and a
// Japanese title that strips down to "0 0" would match M3GAN 2.0.
export const FILLER = new Set(['the', 'a', 'an', 'of', 'and']);
export function sameTitle(a, b){
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const shortWords = short.split(' ');
  const real = new Set(shortWords.filter(w => !FILLER.has(w) && /[a-z]/.test(w)));
  if (real.size < 2) return false;
  const words = new Set(long.split(' '));
  return shortWords.every(w => words.has(w));
}

// Every film on the site, with the franchise it appears in, plus matchers bound to them.
export async function siteFilms(DIR){
  const films = [];
  for (const file of (await readdir(DIR)).filter(f => f.endsWith('.json')).sort()){
    const slug = file.replace(/\.json$/, '');
    const card = JSON.parse(await readFile(path.join(DIR, file), 'utf8'));
    for (const m of Object.values(card.films))
      for (const t of new Set([m.t, ...Object.values(m.aka || {})])) films.push({ slug, title: card.title, t, n: norm(t), y: m.y });
  }

  // Same year (or one either side, as release dates vary by country), and the same title.
  function matches(movie){
    const year = Number((movie.release_date || '').slice(0, 4));
    if (!year) return [];
    const names = [...new Set([movie.title, movie.original_title].filter(Boolean).map(norm))];
    return films.filter(f => Math.abs(f.y - year) <= 1 && names.some(n => sameTitle(n, f.n)));
  }

  // Last resort: the film is named after the franchise. "Resident Evil" (2026)
  // or "Moana" (2026) exactly, or "Toy Story 5" starting with a two-word name.
  const franchiseNames = [...new Map(films.map(f => [f.slug, norm(f.title)]))];
  function byFranchiseName(movie){
    const n = norm(movie.title);
    return new Set(franchiseNames.filter(([, name]) =>
      n === name || (name.split(' ').filter(w => !FILLER.has(w)).length >= 2 && n.startsWith(name + ' '))
    ).map(([slug]) => slug));
  }

  return { films, matches, byFranchiseName };
}
