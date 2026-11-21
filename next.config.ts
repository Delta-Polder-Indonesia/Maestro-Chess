import type { NextConfig } from "next"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const nextConfig: NextConfig = {
  /* config options here */
  // reactStrictMode: false,
  output: "export",
  // Export route directories (e.g. /attributions/index.html) so direct
  // reloads and static hosts do not need extensionless-URL rewrites.
  trailingSlash: true,
  basePath,
  assetPrefix: `${basePath}/`,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  distDir: "dist",
  images: {
    unoptimized: true,
  },
  // Stockfish Lite is single-threaded and does not need cross-origin isolation.
  // Avoid COEP so public player avatars from external sites can load normally.
}

export default nextConfig