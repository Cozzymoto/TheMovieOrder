import { getCollection } from 'astro:content';
import trendingSlugs from '../data/trending.json';

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

/* Trending comes from src/data/trending.json — an ordered list of franchise
   file names. Change that one file to change the homepage. A name that
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
