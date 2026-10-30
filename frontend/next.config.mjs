/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pages retired in the v4 redesign keep working links.
  async redirects() {
    return [
      { source: "/responsible-ai", destination: "/about#responsible-ai", permanent: false },
      { source: "/assistant", destination: "/ask", permanent: false },
      { source: "/opportunities/:path*", destination: "/explore", permanent: false },
      { source: "/pathways", destination: "/topics", permanent: false },
      { source: "/matches", destination: "/explore", permanent: false },
      { source: "/researchers/:path*", destination: "/explore", permanent: false },
    ];
  },
};

export default nextConfig;
