import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // edge-tts opens a WebSocket with `ws` (optional native addons), and web-push signs with Node's crypto:
  // load them from node_modules, unbundled
  serverExternalPackages: ['mapbox-gl', '@andresaya/edge-tts', 'ws', 'web-push'],
};

export default nextConfig;
