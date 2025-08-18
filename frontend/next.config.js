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

    // Output standalone para Docker
    output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

    // Garantir alias '@' -> 'src' no webpack (corrige build em ambiente Docker)
    webpack: (config) => {
        // Debug dos caminhos no build
        console.log('=== Webpack Debug ===')
        console.log('process.cwd():', process.cwd())
        console.log('__dirname:', __dirname)
        
        const srcPath = path.resolve(process.cwd(), 'src')
        console.log('srcPath:', srcPath)
        
        // Verificar se src existe
        const fs = require('fs')
        console.log('src exists:', fs.existsSync(srcPath))
        console.log('api.ts exists:', fs.existsSync(path.join(srcPath, 'lib', 'api.ts')))
        console.log('utils.ts exists:', fs.existsSync(path.join(srcPath, 'lib', 'utils.ts')))
        
        // Configurar aliases de múltiplas formas
        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            '@': srcPath,
            '@/lib': path.join(srcPath, 'lib'),
            '@/components': path.join(srcPath, 'components'),
            '@/hooks': path.join(srcPath, 'hooks'),
            '@/types': path.join(srcPath, 'types'),
        }
        
        console.log('Final aliases:', config.resolve.alias)
        console.log('=== End Debug ===')
        
        return config
    }
}

module.exports = nextConfig