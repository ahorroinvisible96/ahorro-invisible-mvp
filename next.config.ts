import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  env: {
    APP_NAME: 'Ahorro Invisible',
    APP_VERSION: '1.0.0',
  },
  images: {
    domains: ['localhost'],
  },
};

export default nextConfig;
