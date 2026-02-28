import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chặn Webpack không tìm kiếm các thư viện lõi của Node.js khi build giao diện
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        os: false,
        path: false,
        stream: false,
        events: false,
        dns: false,
      };
    }
    return config;
  },
};

export default nextConfig;