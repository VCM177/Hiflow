import type { NextConfig } from 'next';

import { securityHeaders } from './src/server/security-headers';

const nextConfig: NextConfig = {
  // The shared package is compiled to dist/ by `npm run build:types`; listing
  // it keeps it bundled the same way under every bundler.
  transpilePackages: ['@hiflow/shared-types'],
  // No "X-Powered-By: Next.js": there is no reason to tell strangers what runs here.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(process.env.NODE_ENV === 'production'),
      },
    ];
  },
};

export default nextConfig;
