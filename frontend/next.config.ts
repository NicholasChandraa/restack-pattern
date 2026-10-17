import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Next.js to compile and bundle the @restack/shared package as if it were part of the frontend's own source code
  transpilePackages: ["@restack/shared"],
  // Enables static route typing for Next JS App Router navigation
  // when use <Link> or router.push(), the editor will check or autocomplete valid routes and catch typos at compile time.
  typedRoutes: true,
};

export default nextConfig;
