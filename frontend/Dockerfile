# Multi-stage build for Next.js
FROM node:20-alpine AS deps
WORKDIR /app
# Update npm to version 10+ for lockfileVersion 3 compatibility
RUN npm install -g npm@10
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
# Update npm to version 10+ (same as deps stage)
RUN npm install -g npm@10
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app .
EXPOSE 3000
CMD ["npm", "start"]


