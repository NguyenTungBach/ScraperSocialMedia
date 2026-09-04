const path = require('path');

/** @type {import('next').NextConfig} */
if (!process.env.PORT && process.env.FE_PORT) {
  process.env.PORT = process.env.FE_PORT;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3400/api';

const nextConfig = {
  output: 'standalone',

  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ];
    }
    return [];
  },
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Hoyocodes',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  poweredByHeader: false,
  sassOptions: {
    includePaths: [path.join(__dirname, 'src')],
  },
};

module.exports = nextConfig;
