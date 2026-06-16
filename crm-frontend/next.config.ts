import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        destination: 'https://topgreen-ecosystem.onrender.com/:path*',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
