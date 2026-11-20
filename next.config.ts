import type { NextConfig } from "next"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const nextConfig: NextConfig = {
  /* config options here */
  // reactStrictMode: false,
  output: "export",
  basePath,
  assetPrefix: `${basePath}/`,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  distDir: "dist",
  images: {
    unoptimized: true,
  },
  async headers() {
    // Next.js automatically prefixes header routes with basePath.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        source: "/engine/(.*)",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ]
  }
}

export default nextConfig