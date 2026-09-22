import slugs from '../data/trending.json';
// Published copy of the trending list, so the Studio can show what's live.
export async function GET(){
  return new Response(JSON.stringify(slugs), { headers: { 'Content-Type': 'application/json' } });
}
