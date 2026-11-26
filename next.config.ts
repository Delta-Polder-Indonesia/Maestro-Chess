import type { NextConfig } from "next"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
// `next build --output=export` always writes its build intermediates to
// `.next`, while the static export goes to `dist`. If `next dev` also used
// `.next`, running a build while the dev server is open would overwrite its
// chunks (the "Failed to load chunk" error). Give dev its own directory.
const isDev = process.env.NODE_ENV === "development"

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
  distDir: isDev ? ".next-dev" : "dist",
  images: {
    unoptimized: true,
  },
  // Stockfish Lite is single-threaded and does not need cross-origin isolation.
  // COEP require-corp is a hardening candidate: the only cross-origin embedded
  // resource (Chess.com avatars, images.chesscomfiles.com) is verified to send
  // Cross-Origin-Resource-Policy: cross-origin. Activation is deferred until
  // browser compatibility testing (Chrome/Firefox/Safari) confirms avatars,
  // workers and WASM still load; header evidence alone is not sufficient.
}

export default nextConfig