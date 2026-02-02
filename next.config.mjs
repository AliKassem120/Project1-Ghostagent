/** @type {import('next').NextConfig} */
const nextConfig = {
    // Config options for Next.js 16+
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
