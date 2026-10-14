import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.app.github.dev"],
  experimental: {
    serverActions: {
      allowedOrigins:
        process.env.NODE_ENV === "development"
          ? ["localhost:3000", "*.app.github.dev"]
          : [],
    },
  },
};

export default nextConfig;
