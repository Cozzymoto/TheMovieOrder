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
  contactEmail: "hello@themovieorder.com", // where the Contact page sends reports and suggestions

  // Streaming services that get their own button, by name. Paste your
  // affiliate link into "affiliate" for a region and every button for that
  // service starts earning; until then it goes to the service's own site.
  // Prime Video uses the Amazon tags above. Any other service links to JustWatch.
  services: {
    "Disney+":    { url: "https://www.disneyplus.com/",    affiliate: { uk: "", us: "" } },
    "Paramount+": { url: "https://www.paramountplus.com/", affiliate: { uk: "", us: "" } },
    "Hulu":       { url: "https://www.hulu.com/",          affiliate: { uk: "", us: "" } },
    "Peacock":    { url: "https://www.peacocktv.com/",     affiliate: { uk: "", us: "" } },
    "Prime Video": { amazon: true }
  }
};
export const REGIONS = Object.keys(CONFIG.regions);

export function watchURL(title, region = CONFIG.defaultRegion){
  return `https://www.justwatch.com/${CONFIG.regions[region].justwatch}/search?q=${encodeURIComponent(title)}`;
}
// Where a streaming service's button goes for a film: the affiliate link if
// you have one, the service's site if not, or JustWatch for unlisted services.
export function serviceURL(name, title, region){
  const svc = CONFIG.services[name];
  const r = CONFIG.regions[region];
  if (svc && svc.amazon) {
    const tag = r.amazonTag ? `&tag=${encodeURIComponent(r.amazonTag)}` : "";
    return { href: `https://${r.amazon}/s?k=${encodeURIComponent(title)}&i=instant-video${tag}`, earns: !!r.amazonTag };
  }
  if (svc) return { href: svc.affiliate[region] || svc.url, earns: !!svc.affiliate[region] };
  return { href: watchURL(title, region), earns: false };
}
// A service's own page (for the franchise box): affiliate link, the service's site, or nothing.
export function serviceHome(name, region){
  const svc = CONFIG.services[name];
  const r = CONFIG.regions[region];
  if (svc && svc.amazon) {
    const tag = r.amazonTag ? `?tag=${encodeURIComponent(r.amazonTag)}` : "";
    return { href: `https://${r.amazon}/gp/video/storefront${tag}`, earns: !!r.amazonTag };
  }
  if (svc) return { href: svc.affiliate[region] || svc.url, earns: !!svc.affiliate[region] };
  return null;
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
