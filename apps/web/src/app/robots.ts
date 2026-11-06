import type { MetadataRoute } from 'next';

import { siteUrl } from '@/server/site-url';

// Search engines may read the job board and nothing else: the rest is behind a sign-in.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      { userAgent: '*', allow: '/careers', disallow: ['/api/', '/login'] },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
