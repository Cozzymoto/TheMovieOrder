# The Movie Order

Franchise watch orders — release order and in-universe chronology, side by side.
Built with Astro, deployed to Cloudflare Workers.

## Editing content

Everything lives in two files. No need to run anything locally.

- `src/data/franchises.js` — the franchises and their films
- `src/data/posts.js` — blog posts

Edit either on GitHub, commit, and Cloudflare rebuilds the site automatically.

The Content Studio at `/studio.html` generates correctly-formatted entries to paste in.

## Settings

`src/config.js` holds the region and the Amazon Associates tag.

## Pages

One page is generated per franchise at `/<slug>/`, plus the homepage,
`/franchises/`, `/blog/`, `/about/` and a sitemap.
