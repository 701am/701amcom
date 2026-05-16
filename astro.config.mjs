import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve a sitemap URL to its source file path, then to a lastmod date.
 * Tries git log first (most reliable), then file mtime, then now.
 */
function getLastmod(url) {
  try {
    const pathname = new URL(url).pathname.replace(/^\//, '').replace(/\/$/, '');

    // Dispatch pages live in src/content/notes/
    if (pathname.startsWith('notes/') && pathname !== 'notes') {
      const slug = pathname.replace(/^notes\//, '');
      for (const ext of ['md', 'mdx']) {
        const candidate = join(__dirname, 'src/content/notes', `${slug}.${ext}`);
        if (existsSync(candidate)) {
          return gitLastModified(candidate) || statSync(candidate).mtime;
        }
      }
    }

    // Regular Astro pages — try a few path conventions
    const pageCandidates = [
      join(__dirname, 'src/pages', pathname ? `${pathname}.astro` : 'index.astro'),
      join(__dirname, 'src/pages', pathname || '', 'index.astro'),
    ];
    for (const candidate of pageCandidates) {
      if (existsSync(candidate)) {
        return gitLastModified(candidate) || statSync(candidate).mtime;
      }
    }
  } catch {
    /* fall through */
  }
  return new Date();
}

function gitLastModified(filePath) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${filePath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    return out ? new Date(out) : null;
  } catch {
    return null;
  }
}

// https://astro.build/config
export default defineConfig({
  site: 'https://701am.com',
  integrations: [
    mdx(),
    sitemap({
      entryLimit: 1000,
      changefreq: 'weekly',
      priority: 0.7,
      filter: (page) => !page.includes('/admin') && !page.endsWith('.md'),
      serialize(item) {
        const lastmod = getLastmod(item.url);
        return {
          ...item,
          lastmod: lastmod.toISOString(),
          priority:
            item.url === 'https://701am.com/' ? 1.0
            : item.url.includes('/build') ? 0.95
            : item.url.includes('/discovery') ? 0.9
            : item.url.includes('/skills') || item.url.includes('/legend-maker') ? 0.85
            : item.url.includes('/notes/') ? 0.7
            : 0.6,
        };
      },
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
    },
  },
  trailingSlash: 'ignore',
});
