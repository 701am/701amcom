// Markdown alternate route for dispatches.
// AI agents that prefer markdown over HTML can request /notes/{slug}.md
// and get the raw markdown source with frontmatter.

import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export async function getStaticPaths() {
  const notes = await getCollection('notes', ({ data }) => !data.draft);
  return notes.map((note) => ({
    params: { slug: note.id },
    props: { note },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const note = (props as any).note;
  if (!note) {
    return new Response('Not found', { status: 404 });
  }

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(note.data.title)}`,
    `deck: ${JSON.stringify(note.data.deck)}`,
    `number: ${note.data.number}`,
    `date: ${note.data.date instanceof Date ? note.data.date.toISOString() : note.data.date}`,
    `topic: ${JSON.stringify(note.data.topic)}`,
    note.data.tags && note.data.tags.length > 0
      ? `tags: [${note.data.tags.map((t: string) => JSON.stringify(t)).join(', ')}]`
      : null,
    note.data.readingTime ? `readingTime: ${JSON.stringify(note.data.readingTime)}` : null,
    `author: David Krug`,
    `source: https://701am.com/notes/${note.id}`,
    '---',
    '',
  ]
    .filter(Boolean)
    .join('\n');

  const body = note.body || '';
  const content = frontmatter + body;
  const tokens = Math.ceil(content.length / 4); // rough estimate

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Markdown-Tokens': String(tokens),
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
