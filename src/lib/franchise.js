import { getCollection } from 'astro:content';

// Every page gets its franchises through here, so sorting rules live in one place.
export async function allFranchises(){
  const entries = await getCollection('franchises');
  const list = entries.map(e => ({ slug: e.id, ...e.data }));

  // Two files for the same franchise would publish two pages. Refuse instead.
  const seen = new Map();
  for (const f of list) {
    const key = f.title.trim().toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Two cards share the title "${f.title}": ${seen.get(key)}.json and ${f.slug}.json. Delete one.`);
    }
    seen.set(key, f.slug);
  }

  return list.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.title.localeCompare(b.title));
}
export async function byTitle(){
  return (await allFranchises()).sort((a, b) => a.title.localeCompare(b.title));
}
