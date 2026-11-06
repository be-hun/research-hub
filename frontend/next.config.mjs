/** @type {import('next').NextConfig} */
// The browser calls /api/... on the site's own origin; Next forwards it to the backend, so CORS never applies.
// Behind nginx (which serves /api/ itself) this rewrite is simply never reached.
const BACKEND_URL = process.env.API_URL || "http://localhost:8000";

const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
  // Pages retired in the v4 redesign keep working links.
  async redirects() {
    return [
      { source: "/responsible-ai", destination: "/about#responsible-ai", permanent: false },
      { source: "/assistant", destination: "/ask", permanent: false },
      { source: "/pathways", destination: "/topics", permanent: false },
      { source: "/matches", destination: "/explore", permanent: false },
      { source: "/profile", destination: "/account", permanent: false },
    ];
  },
};

export default nextConfig;
