import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "@napi-rs/canvas-linux-x64-gnu"],
};

export default nextConfig;
