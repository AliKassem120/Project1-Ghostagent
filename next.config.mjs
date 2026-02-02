/** @type {import('next').NextConfig} */
const nextConfig = {
    // Config options for Next.js 16+
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: "script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http:; object-src 'none';",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
