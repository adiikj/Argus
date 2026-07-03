/** @type {import('next').NextConfig} */
const nextConfig = {
  // minimal self-contained server bundle for the production Docker image (§16)
  output: 'standalone',
};

export default nextConfig;
