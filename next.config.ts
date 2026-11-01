import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // edge-tts opens a WebSocket with `ws` (optional native addons): load them from node_modules, unbundled
  serverExternalPackages: ['mapbox-gl', '@andresaya/edge-tts', 'ws'],
};

export default nextConfig;
