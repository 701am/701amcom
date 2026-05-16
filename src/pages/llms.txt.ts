import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://701am.com';

export const GET: APIRoute = async () => {
  const notes = (await getCollection('notes', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const dispatchList = notes
    .map(
      (n) => `- [${n.data.title}](${SITE}/notes/${n.id}): ${n.data.deck}`
    )
    .join('\n');

  const body = `# 701am

> An earned-media office that builds press coverage from public data. We work backward from 7:01 a.m. — the minute after the alarm, when a hundred million people decide what matters today.

The 701am method: find an angle inside public data that a working journalist would actually open. Build the methodology. Pitch the placement. Earn the coverage that compounds into authority.

## Site map

- [Home](${SITE}/): the brand and the offer
- [The Scroll](${SITE}/legend-maker): the field manual — the full earned-media method in long form
- [Earned Media Skills](${SITE}/skills): twenty-eight open-source markdown skills for AI agents to read, MIT licensed, on GitHub at 701am/earned-media-skills
- [Build a Data Story](${SITE}/build): a free interactive workshop that turns five questions into a strategy memo with a winning headline, dataset hints, and a four-week roadmap
- [Discovery call](${SITE}/discovery): book a thirty-minute sunrise call with the desk
- [About the office](${SITE}/about): who we are and how we work
- [Contact](${SITE}/contact): four ways to reach the office
- [Dispatches](${SITE}/notes): the running record of essays and field notes

## Dispatches

${dispatchList}

## Founder

David Krug — founder and CTO of 701am. Earned media operator and builder of the systems that make data-driven press coverage repeatable.

## Discovery

- [Sitemap index](${SITE}/sitemap-index.xml)
- [RSS feed](${SITE}/rss.xml)
- [Sitemap (HTML)](${SITE}/sitemap)

## Editorial principles

- We are not in the business of content. We are in the business of earned truth.
- Generic is a form of dishonesty.
- Every pitch is written for a specific reporter on a specific beat. None of the work is sent at scale.
- All Skills and the Scroll are free. We make money from done-for-you engagements only.
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
