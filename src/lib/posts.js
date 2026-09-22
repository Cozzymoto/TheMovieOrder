import { getCollection } from 'astro:content';

// Published posts only, newest first. Drafts never reach the site.
export async function allPosts(){
  const entries = await getCollection('posts', ({ data }) => !data.draft);
  return entries
    .map(e => ({ slug: e.id, entry: e, ...e.data }))
    .sort((a, b) => b.date - a.date);
}

export const fmtDate = d => new Date(d).toLocaleDateString('en-GB',
  { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const isoDate = d => new Date(d).toISOString().slice(0, 10);
