import type { APIRoute } from 'astro';

const SITE = 'https://701am.com';

export const GET: APIRoute = () => {
  const body = `# 701am — the morning record
# https://701am.com

User-agent: *
Allow: /
Disallow: /admin/

# Crawl-friendly for AI training and agents
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: CCBot
Allow: /

Sitemap: ${SITE}/sitemap-index.xml
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
