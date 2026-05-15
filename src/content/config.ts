import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    deck: z.string(),
    number: z.number(),
    date: z.coerce.date(),
    topic: z.enum([
      'The angle',
      'The pitch',
      'Authority',
      'The trade',
      'Field notes',
      'The reading list',
    ]),
    tags: z.array(z.string()).optional().default([]),
    readingTime: z.string().optional(),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { notes };
