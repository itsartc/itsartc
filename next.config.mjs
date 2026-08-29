/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Downtown was built at a parallel route while the imported world still
      // served `/`. It is now the app itself; this keeps the old link working.
      { source: "/downtown", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
