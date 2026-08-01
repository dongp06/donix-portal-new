import type { NextConfig } from "next";
import path from "path";

const apiOrigin = process.env.API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['36.50.135.169', 'localhost:3000'],
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
