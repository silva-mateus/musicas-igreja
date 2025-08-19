/** @type {import('next').NextConfig} */
const path = require('path')

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

    // Disable experimental features that might cause routing issues
    experimental: {
        esmExternals: false,
    },

    // Output standalone para Docker
    output: 'standalone',

    // Ensure trailing slashes for consistent routing
    trailingSlash: false,

    // Generate all static routes at build time
    generateBuildId: () => 'musicas-igreja-build',

    // Garantir alias '@' -> 'src' no webpack
    webpack: (config) => {
        const srcPath = path.resolve(process.cwd(), 'src')

        // Configurar aliases
        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            '@': srcPath,
            '@/lib': path.resolve(process.cwd(), 'lib'),
            '@/components': path.join(srcPath, 'components'),
            '@/hooks': path.join(srcPath, 'hooks'),
            '@/types': path.join(srcPath, 'types'),
        }

        return config
    }
}

module.exports = nextConfig