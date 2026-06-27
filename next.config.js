/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['docxtemplater', 'pizzip', 'jszip'],
  },
};

module.exports = nextConfig;
