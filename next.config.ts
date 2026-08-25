import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Node.js runtime, not Edge. Fluid Compute runs full Node in the same regions at the same
  // price, and the ledger hash verification needs node:crypto.
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
