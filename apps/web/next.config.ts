import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared package is compiled to dist/ by `npm run build:types`; listing
  // it keeps it bundled the same way under every bundler.
  transpilePackages: ['@hiflow/shared-types'],
};

export default nextConfig;
