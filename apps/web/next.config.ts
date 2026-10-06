import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BRAIN_URL ?? "http://localhost:8000"}/api/:path*`,
      },
      {
        source: "/sandbox/:path*",
        destination: `${process.env.SANDBOX_URL ?? "http://localhost:8001"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
