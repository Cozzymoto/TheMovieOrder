import { allFranchises } from '../lib/franchise.js';
import { allNames } from '../config.js';

/* The search catalogue. Fetched only when someone uses the search box,
   so the homepage stays light however many franchises there are. */
export async function GET(){
  const all = await allFranchises();
  const data = all.map(f => ({
    s: f.slug, t: f.title, a: allNames(f).slice(1).join(', '), d: f.short, n: f.release.length, h: f.hue,
    p: f.poster || Object.values(f.films).find(m => m.poster)?.poster || null,
    k: [...allNames(f), ...Object.values(f.films).flatMap(allNames)].join(' ').toLowerCase()
  }));
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}
