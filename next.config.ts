import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow accessing dev resources (/_next/*) from LAN hosts like phones.
  // This fixes mobile LAN access where scripts/HMR are blocked by default.
  allowedDevOrigins: ['192.168.31.125', 'localhost', '127.0.0.1'],
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
