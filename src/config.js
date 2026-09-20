// The only file you edit once you have accounts set up.
export const CONFIG = {
  region: "uk",      // "uk" or "us" — sets the JustWatch and Amazon region
  amazonTag: ""      // e.g. "themovieorder-21" once Amazon Associates approve you
};

export function watchURL(title){
  return `https://www.justwatch.com/${CONFIG.region}/search?q=${encodeURIComponent(title)}`;
}
export function buyURL(title){
  const dom = CONFIG.region === "us" ? "www.amazon.com" : "www.amazon.co.uk";
  const tag = CONFIG.amazonTag ? `&tag=${encodeURIComponent(CONFIG.amazonTag)}` : "";
  return `https://${dom}/s?k=${encodeURIComponent(title + " blu-ray")}${tag}`;
}
export function shortTitle(t){
  if(t.includes(":")) return t.split(":").slice(1).join(":").trim();
  return t.replace(/^(The Lord of the Rings|Harry Potter and the) /, "").trim();
}
export function yearSpan(f){
  const ys = Object.values(f.films).map(m => m.y);
  return Math.min(...ys) + "–" + Math.max(...ys);
}
