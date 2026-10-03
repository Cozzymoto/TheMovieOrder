import { getCollection } from 'astro:content';
import trendingSlugs from '../data/trending.json';
import relatedGroups from '../data/related.json';
import orderMattersData from '../data/order-matters.json';

// Every franchise, alphabetical. Refuses to build if two cards share a title.
export async function allFranchises(){
  const entries = await getCollection('franchises');
  const list = entries.map(e => ({ slug: e.id, ...e.data }));
  const seen = new Map();
  for (const f of list) {
    const key = f.title.trim().toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Two cards share the title "${f.title}": ${seen.get(key)}.json and ${f.slug}.json. Delete one.`);
    }
    seen.set(key, f.slug);
  }
  return list.sort((a, b) => a.title.localeCompare(b.title));
}

export async function byTitle(){ return allFranchises(); }

/* A franchise page's sections. Without groups it's one section holding every
   film; with groups, each group shows its own films in release and chrono
   order, and groups appear in the order their first film came out. */
export function sections(f){
  if (!f.groups) return [{ title: null, release: f.release, chrono: f.chrono }];
  return f.groups
    .map(g => ({ title: g.title, release: f.release.filter(id => g.films.includes(id)), chrono: f.chrono.filter(id => g.films.includes(id)) }))
    .sort((a, b) => f.release.indexOf(a.release[0]) - f.release.indexOf(b.release[0]));
}

// How many films sit in a different place in chronological order (within their section).
export function movedCount(f){
  return sections(f).reduce((n, s) => n + s.release.filter((id, i) => s.chrono.indexOf(id) !== i).length, 0);
}

/* Trending comes from src/data/trending.json — an ordered list of franchise
   file names. A GitHub Action (update-trending.yml) rewrites it every Monday
   from TMDB's trending films; you can still edit it by hand. A name that
   doesn't match a franchise stops the build rather than silently vanishing. */
export async function trending(){
  const all = await allFranchises();
  const bySlug = new Map(all.map(f => [f.slug, f]));
  const missing = trendingSlugs.filter(s => !bySlug.has(s));
  if (missing.length) {
    throw new Error(`trending.json names ${missing.join(', ')}, but there is no franchise file with that name. Check the spelling against src/data/franchises/.`);
  }
  const list = trendingSlugs.map(s => bySlug.get(s));
  return list.length ? list : all.slice(0, 8);
}

/* Related franchises come from src/data/related.json: groups of franchise
   file names that belong together (shared universe, crossovers, remakes).
   Every franchise in a group links to the others. Returns the groups this
   franchise is in, each with the other franchises, skipping repeats. */
export async function related(slug){
  const all = await allFranchises();
  const bySlug = new Map(all.map(f => [f.slug, f]));
  const missing = relatedGroups.flatMap(g => g.franchises).filter(s => !bySlug.has(s));
  if (missing.length) {
    throw new Error(`related.json names ${[...new Set(missing)].join(', ')}, but there is no franchise file with that name. Check the spelling against src/data/franchises/.`);
  }
  const shown = new Set([slug]);
  const groups = [];
  for (const g of relatedGroups) {
    if (!g.franchises.includes(slug)) continue;
    const list = g.franchises.filter(s => !shown.has(s)).map(s => bySlug.get(s));
    list.forEach(f => shown.add(f.slug));
    if (list.length) groups.push({ label: g.label, list });
  }
  return groups;
}

/* The "order matters" page comes from src/data/order-matters.json: sections
   of franchises where release and chronological order differ, each with a
   verdict and a one-line reason. Names are checked like trending.json. */
export async function orderMatters(){
  const all = await allFranchises();
  const bySlug = new Map(all.map(f => [f.slug, f]));
  const listed = orderMattersData.flatMap(s => s.franchises.map(e => e.slug));
  const missing = listed.filter(s => !bySlug.has(s));
  if (missing.length) {
    throw new Error(`order-matters.json names ${missing.join(', ')}, but there is no franchise file with that name. Check the spelling against src/data/franchises/.`);
  }
  const dupes = listed.filter((s, i) => listed.indexOf(s) !== i);
  if (dupes.length) throw new Error(`order-matters.json lists ${dupes.join(', ')} more than once.`);

  const moved = movedCount;
  const unlisted = all.filter(f => moved(f) > 0 && !listed.includes(f.slug)).map(f => f.slug);
  if (unlisted.length) console.warn(`[order-matters] Orders differ but not on the page yet: ${unlisted.join(', ')}`);

  return orderMattersData.map(s => ({
    ...s,
    franchises: s.franchises.map(e => {
      const f = bySlug.get(e.slug);
      return { ...e, f, moved: moved(f), films: f.release.length };
    })
  }));
}
