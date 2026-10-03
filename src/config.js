// The only file you edit once you have accounts set up.
export const CONFIG = {
  // Visitors in the US get US links; everyone else gets the default region.
  // A switch in the footer lets anyone change it.
  defaultRegion: "uk",
  regions: {
    uk: {
      name: "UK",
      justwatch: "uk",
      amazon: "www.amazon.co.uk",
      amazonTag: ""   // e.g. "themovieorder-21" once Amazon Associates UK approve you
    },
    us: {
      name: "US",
      justwatch: "us",
      amazon: "www.amazon.com",
      amazonTag: ""   // e.g. "themovieorder-20" once Amazon Associates US approve you
    }
  },
  contactEmail: "hello@themovieorder.com" // where the Contact page sends reports and suggestions
};
export const REGIONS = Object.keys(CONFIG.regions);

export function watchURL(title, region = CONFIG.defaultRegion){
  return `https://www.justwatch.com/${CONFIG.regions[region].justwatch}/search?q=${encodeURIComponent(title)}`;
}
export function buyURL(title, region = CONFIG.defaultRegion){
  const r = CONFIG.regions[region];
  const tag = r.amazonTag ? `&tag=${encodeURIComponent(r.amazonTag)}` : "";
  return `https://${r.amazon}/s?k=${encodeURIComponent(title + " blu-ray")}${tag}`;
}

// A film or franchise's name in a region: its "aka" for that region if it has one.
export function titleIn(item, region){
  return (item.aka && item.aka[region]) || item.t || item.title;
}
// Every name something goes by, for search and for page titles.
export function allNames(item){
  return [...new Set([item.t || item.title, ...Object.values(item.aka || {})])];
}

export function shortTitle(t){
  if(t.includes(":")) return t.split(":").slice(1).join(":").trim();
  return t.replace(/^(The Lord of the Rings|Harry Potter and the) /, "").trim();
}
export function yearSpan(f){
  const ys = Object.values(f.films).map(m => m.y);
  return Math.min(...ys) + "–" + Math.max(...ys);
}
