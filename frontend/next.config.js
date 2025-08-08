/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,

    // Configuração para comunicação com o backend Flask
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000') + '/api/:path*',
            },
        ]
    },

    // Configuração para arquivos estáticos e PDFs
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                ],
            },
        ]
    },

    // Configuração para imagens otimizadas
    images: {
        domains: ['localhost'],
        unoptimized: true,
    },

    // Output standalone para Docker
    output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
}

module.exports = nextConfig