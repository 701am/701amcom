import { getCollection } from 'astro:content';

export async function GET() {
  const notes = await getCollection('notes', ({ data }) => !data.draft);
  const docs = notes
    .map((n) => ({
      slug: n.id,
      title: n.data.title,
      deck: n.data.deck,
      number: n.data.number,
      topic: n.data.topic,
      date: n.data.date.toISOString(),
      tags: n.data.tags ?? [],
    }))
    .sort((a, b) => b.number - a.number);

  return new Response(JSON.stringify(docs), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
}
