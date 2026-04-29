import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    after: true, // Enable after() for post-response background tasks (n8n webhook)
  },
};

export default nextConfig;
