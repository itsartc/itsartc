/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Downtown was a generated city that briefly served `/`. It is gone, but
      // the link it was developed at is kept alive rather than left to 404.
      { source: "/downtown", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
