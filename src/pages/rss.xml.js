import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const notes = (await getCollection('notes', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'Dispatches from 701am',
    description: 'The morning record from the office of earned media.',
    site: context.site,
    items: notes.map((note) => ({
      title: note.data.title,
      pubDate: note.data.date,
      description: note.data.deck,
      link: `/notes/${note.id}/`,
      categories: [note.data.topic, ...note.data.tags],
    })),
    customData: `<language>en-us</language>`,
  });
}
