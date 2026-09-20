import { getCollection } from 'astro:content';

// Every page gets its franchises through here, so sorting rules live in one place.
export async function allFranchises(){
  const entries = await getCollection('franchises');
  return entries
    .map(e => ({ slug: e.id, ...e.data }))
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.title.localeCompare(b.title));
}
export async function byTitle(){
  return (await allFranchises()).sort((a, b) => a.title.localeCompare(b.title));
}
