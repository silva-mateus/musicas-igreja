/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false, // Desabilitado para evitar execuções duplas em desenvolvimento
    swcMinify: true,

    // Remover rewrites conflitantes - usar API routes específicas

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