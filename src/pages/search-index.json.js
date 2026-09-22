import { allFranchises } from '../lib/franchise.js';

/* The search catalogue. Fetched only when someone uses the search box,
   so the homepage stays light however many franchises there are. */
export async function GET(){
  const all = await allFranchises();
  const data = all.map(f => ({
    s: f.slug, t: f.title, d: f.short, n: f.release.length, h: f.hue,
    p: f.poster || Object.values(f.films).find(m => m.poster)?.poster || null,
    k: Object.values(f.films).map(m => m.t).join(' ').toLowerCase()
  }));
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}
