import { REGIONS, serviceURL, titleIn } from '../config.js';

/* Where each film can be watched, from src/data/streaming.json (written
   weekly by scripts/update-streaming.mjs). Data is JustWatch's, via TMDB,
   and must be credited wherever it's shown. Missing data just means no
   streaming info is shown. */
const files = import.meta.glob('../data/streaming.json', { eager: true, import: 'default' });
const data = Object.values(files)[0] || { updated: null, providers: {}, films: {} };

export const streamingUpdated = data.updated;

/* TMDB lists one service under many names: plans ("Paramount Plus Premium"),
   ad tiers ("Netflix Standard with Ads") and resellers ("HBO Max Amazon
   Channel"). Collapse them so each service appears once. */
const ALIASES = {
  'amazon prime video': 'Prime Video', 'disney plus': 'Disney+', 'paramount plus': 'Paramount+', 'paramount+': 'Paramount+',
  'now tv': 'NOW', 'mgm plus': 'MGM+', 'mgm+': 'MGM+', 'amc plus': 'AMC+', 'amc+': 'AMC+', 'tubi tv': 'Tubi',
  'channel 4 plus': 'Channel 4', 'youtube free': 'YouTube (free)', 'plex channel': 'Plex', 'studiocanal presents': 'Studiocanal Presents',
  'arrow video': 'ARROW', 'fandango at home free': 'Fandango at Home (free)'
};
export function serviceKey(name){
  let n = name
    .replace(/ (Amazon|Apple TV|Roku Premium) Channel$/i, '')
    .replace(/ (Standard |Basic |Free )?with Ads$/i, '')
    .replace(/ (Premium Plus|Premium|Essential|Kids|Cinema)$/i, '')
    .trim();
  return ALIASES[n.toLowerCase()] || n;
}

// One logo per service, taken from its main listing rather than a reseller
// ("Paramount Plus" rather than "Paramount+ Amazon Channel") where possible.
const logos = new Map();
for (const p of Object.values(data.providers)){
  if (!p.l) continue;
  const key = serviceKey(p.n);
  const main = !/ (Amazon|Apple TV|Roku Premium) Channel$/i.test(p.n);
  if (!logos.has(key) || (main && !logos.get(key).main)) logos.set(key, { main, url: `https://image.tmdb.org/t/p/w45${p.l}` });
}
const logo = name => logos.get(name)?.url || null;

// One film in one region: the subscription services it's on, and whether it can be rented or bought.
export function filmAvailability(slug, fid, film, region){
  const entry = data.films[`${slug}/${fid}`];
  const here = entry && entry[region];
  if (!entry) return null;                                  // never looked up
  const title = titleIn(film, region);
  const seen = new Set();
  const stream = [];
  for (const id of here?.s || []){
    const name = serviceKey(data.providers[id]?.n || 'Unknown');
    if (seen.has(name)) continue;
    seen.add(name);
    stream.push({ name, logo: logo(name), ...serviceURL(name, title, region) });
  }
  return { stream, rentOrBuy: !!(here && (here.r.length || here.b.length)) };
}

// A whole franchise in one region: subscription services ranked by how many of its films they carry.
export function franchiseAvailability(f, region){
  const counts = new Map();
  let known = 0, nowhere = 0;
  for (const fid of f.release){
    const a = filmAvailability(f.slug, fid, f.films[fid], region);
    if (!a) continue;
    known++;
    if (!a.stream.length) nowhere++;
    for (const s of a.stream){
      const c = counts.get(s.name) || { ...s, films: 0 };
      c.films++; counts.set(s.name, c);
    }
  }
  if (!known) return null;
  const services = [...counts.values()].sort((a, b) => b.films - a.films);
  // The service's own link for the box (not a film-specific search), where we have one.
  return { services, nowhere, total: f.release.length };
}

export { REGIONS };
