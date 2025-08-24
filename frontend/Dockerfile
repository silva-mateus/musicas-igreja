# Multi-stage build for Next.js
FROM node:20-alpine AS deps
WORKDIR /app
# Update npm to version 10+ for lockfileVersion 3 compatibility
RUN npm install -g npm@11.5.2
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
# Update npm to version 10+ (same as deps stage)
RUN npm install -g npm@11.5.2
ENV NODE_ENV=production
# Accept build args for environment variables
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Create app user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static files for Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Create public directory (Next.js apps need this)
RUN mkdir -p ./public

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]


