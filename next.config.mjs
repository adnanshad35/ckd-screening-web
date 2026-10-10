/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the Next.js badge shown in the corner during development.
  devIndicators: false,
  // Keep the addresses of the earlier static site working.
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/predict.html", destination: "/check", permanent: true },
      { source: "/research.html", destination: "/#model", permanent: true },
    ];
  },
};

export default nextConfig;
