import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    dek: z.string(),                       // one-line summary shown in the index + post header
    date: z.coerce.date(),
    collection: z.string().default('notes'), // editorial collection / category (Varstatt-style)
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    author: z.string().default('David Krug'),
  }),
});

export const collections = { blog };
