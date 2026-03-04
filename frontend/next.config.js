/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
    // Temporary: core submodule has different @types/react/csstype causing type conflicts
    typescript: { ignoreBuildErrors: true },
    reactStrictMode: false,
    swcMinify: true,

    env: {
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:5000',
    },

    transpilePackages: ['@core'],

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

    // Monorepo: root de tracing inclui ../core usado via @core alias
    outputFileTracingRoot: path.join(__dirname, '..'),

    // Ensure trailing slashes for consistent routing
    trailingSlash: false,

    // Garantir alias '@' -> 'src' no webpack
    webpack: (config) => {
        const srcPath = path.resolve(process.cwd(), 'src')

        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            '@': srcPath,
            '@core': path.resolve(process.cwd(), '..', 'core', 'frontend'),
            '@/lib': path.resolve(process.cwd(), 'lib'),
            '@/components': path.join(srcPath, 'components'),
            '@/hooks': path.join(srcPath, 'hooks'),
            '@/types': path.join(srcPath, 'types'),
        }

        config.resolve.modules = [
            'node_modules',
            path.resolve(process.cwd(), 'node_modules'),
        ]

        return config
    }
}

module.exports = nextConfig