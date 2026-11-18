import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/students",
        destination: "/academic?tab=students",
        permanent: false,
      },
      {
        source: "/subjects",
        destination: "/academic?tab=subjects",
        permanent: false,
      },
      {
        source: "/enrollment",
        destination: "/academic?tab=enrollment",
        permanent: false,
      },
      {
        source: "/classroom",
        destination: "/academic?tab=classrooms",
        permanent: false,
      },
      {
        source: "/sessions",
        destination: "/attendance?tab=ledger",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
