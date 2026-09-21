import { allFranchises } from '../lib/franchise.js';

// A small list the Content Studio reads to show every franchise and its poster progress.
export async function GET(){
  const all = await allFranchises();
  const list = all.map(f => ({
    slug: f.slug,
    title: f.title,
    films: f.release.length,
    posters: Object.values(f.films).filter(m => m.poster).length
  })).sort((a, b) => a.title.localeCompare(b.title));
  return new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } });
}
