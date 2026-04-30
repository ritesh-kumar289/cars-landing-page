/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow loading large GLB models without bloat warnings
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glb|gltf|bin|hdr|exr)$/,
      type: 'asset/resource',
    });
    return config;
  },
};

module.exports = nextConfig;
