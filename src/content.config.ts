import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* ============================================================
   THE RULES CARD
   Every file in src/data/franchises/ is checked against this
   before the site is built. If one is wrong, the build stops
   and names the file — nothing broken ever reaches the site.
   ============================================================ */

const film = z.object({
  t: z.string().min(1, 'film needs a title'),
  y: z.number().int().min(1880).max(2100),
  set: z.string().min(1, 'film needs a "set" note — use "—" if there is nothing useful to say'),
  poster: z.string().regex(/^(https?:\/\/|\/)/, 'poster must be a TMDB path (/abc.jpg), your own file (/img/name.jpg), or a full https address').optional(),
  // Only needed where a franchise mixes animated and live-action films:
  // each film then gets a small label on its row.
  format: z.enum(['animated', 'live-action', 'photoreal']).optional(),
  remake: z.boolean().optional()
});

const franchises = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/franchises' }),
  schema: z.object({
    title: z.string().min(1),
    short: z.string().min(1),
    hue: z.number().int().min(0).max(359),
    blurb: z.string().min(1),
    rank: z.number().int().positive().optional(),
    poster: z.string().regex(/^(https?:\/\/|\/)/).optional(),
    tmdb: z.number().int().positive().optional(),
    films: z.record(film).refine(o => Object.keys(o).length > 0, 'needs at least one film'),
    release: z.array(z.string()).min(1),
    chrono: z.array(z.string()).min(1),
    // Optional: split the page into sections, e.g. the animated films and the
    // live-action remake. Each film belongs to exactly one group; release and
    // chrono still hold the order, and each section shows its own films in it.
    groups: z.array(z.object({
      title: z.string().min(1),
      films: z.array(z.string()).min(1)
    })).min(2).optional(),
    note: z.string().optional()
  }).superRefine((f, ctx) => {
    const ids = Object.keys(f.films);

    if (f.groups) {
      const grouped = f.groups.flatMap(g => g.films);
      const missing = ids.filter(id => !grouped.includes(id));
      const unknown = grouped.filter(id => !ids.includes(id));
      const dupes = grouped.filter((id, i) => grouped.indexOf(id) !== i);
      if (missing.length) ctx.addIssue({ code: 'custom',
        message: `"groups" leaves out ${missing.join(', ')} — every film needs a group` });
      if (unknown.length) ctx.addIssue({ code: 'custom',
        message: `"groups" lists ${unknown.join(', ')}, which is not in "films" — typo?` });
      if (dupes.length) ctx.addIssue({ code: 'custom',
        message: `"groups" puts ${dupes.join(', ')} in more than one group` });
    }

    // The silent killer: a film in one ordering but not the other.
    for (const [name, list] of [['release', f.release], ['chrono', f.chrono]] as const) {
      const missing = ids.filter(id => !list.includes(id));
      const unknown = list.filter(id => !ids.includes(id));
      const dupes = list.filter((id, i) => list.indexOf(id) !== i);

      if (missing.length) ctx.addIssue({ code: 'custom',
        message: `"${name}" is missing ${missing.length} film(s) that exist in "films": ${missing.join(', ')}` });
      if (unknown.length) ctx.addIssue({ code: 'custom',
        message: `"${name}" lists ${unknown.join(', ')}, which is not in "films" — typo?` });
      if (dupes.length) ctx.addIssue({ code: 'custom',
        message: `"${name}" lists ${dupes.join(', ')} more than once` });
    }
  })
});

/* Blog posts: one Markdown file each in src/data/posts/.
   Set draft: true to hide a post without deleting it. */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/posts' }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    standfirst: z.string().min(1),
    draft: z.boolean().optional()
  })
});

export const collections = { franchises, posts };
