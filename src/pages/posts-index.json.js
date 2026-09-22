import { getCollection } from 'astro:content';
import { isoDate } from '../lib/posts.js';

// Every post including drafts, for the Content Studio's dropdown.
export async function GET(){
  const entries = await getCollection('posts');
  const list = entries
    .map(e => ({ slug: e.id, title: e.data.title, date: isoDate(e.data.date), draft: !!e.data.draft }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } });
}
